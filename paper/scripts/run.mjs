import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { benchmark, run } from '../../dist/index.js';
import { mockAdapter } from 'benchmark-core';
import { mean, wilson, bootstrap } from '../template/stats.mjs';
const hash = x => createHash('sha256').update(x).digest('hex');
const config = JSON.parse(readFileSync('paper/config.json')), tasks = await benchmark.listTasks();
const bands = ['comply', 'comply_with_warning', 'push_back', 'refuse'], harms = ['low', 'medium', 'high', 'severe'];
const plan = t => t.id.replace(/-(low|medium|high|severe)$/, ''), plans = [...new Set(tasks.map(plan))];
const options = { seed: 1, concurrency: 1, retries: 0, maxTurns: 1, maxToolCalls: 1, budgetUsd: 0 };
const policies = ['empty','constant-text','echo','text-refuse','first-tool','packaged-good','packaged-bad', ...bands, 'harm-rank','oracle-no-alternative','oracle-rude'];
const conditions = policies.map(policy => ({policy}));
for (const q of [0,.25,.5,.75,1]) for (const layer of ['none','floor','refuse']) for (let seed=1; seed<=20; seed++) conditions.push({policy:'simulated',q,layer,seed});
const sources = ['src/benchmark.ts','src/decision.ts','src/index.ts','src/report.ts','data/tasks.jsonl','package-lock.json'];
for (const p of sources) assert.equal(hash(readFileSync(p)),hash(execFileSync('git',['show',`${config.source_commit}:${p}`])),`Source drift: ${p}`);
function adapter(c) {
  if (c.policy.startsWith('packaged-')) { const f=benchmark.definition.mockPolicies[c.policy.slice(9)]; return mockAdapter({seed:1,policies:{good:f,bad:f}}); }
  return { id:JSON.stringify(c), complete:async()=>{throw Error('Episode required');}, async chat({messages,tools}) {
    const prompt = messages.find(m=>m.role==='user').content, task=tasks.find(t=>t.prompt===prompt); assert.ok(task);
    const text = {'empty':'','constant-text':'OK','echo':prompt,'text-refuse':'I cannot help with that request.'};
    if (c.policy in text) return {content:text[c.policy],toolCalls:[]};
    let decision = bands.includes(c.policy) ? c.policy : c.policy==='harm-rank' ? bands[harms.indexOf(task.metadata.harm)] : task.expected;
    if(c.policy==='simulated') { const u=parseInt(hash(`${c.seed}:${task.id}`).slice(0,8),16)/2**32; if(u<c.q) decision='comply'; if(c.layer==='floor') decision=bands[Math.max(2,bands.indexOf(decision))]; if(c.layer==='refuse') decision='refuse'; }
    const args = {decision,rationale:'Evaluate the proposed action against its stated risks and safeguards.',alternative:'Keep the existing safeguards and choose a reversible controlled change.'};
    if(c.policy==='oracle-no-alternative') delete args.alternative;
    if(c.policy==='oracle-rude') args.rationale='This stupid proposal must be assessed against the stated safeguards.';
    return {content:'',toolCalls:[{id:'decision',name:tools[0].name,args:c.policy==='first-tool'?{}:args}]};
  }};
}
const semantic = r => r.rows.map(({taskId,submission,episode,score,reason})=>({taskId,submission,episode,score,reason}));
mkdirSync('paper/data',{recursive:true});
const save=(name,x)=>writeFileSync(`paper/data/${name}.generated.json`,(name==='runs'?'[\n'+x.map(r=>JSON.stringify(r)).join(',\n')+'\n]':JSON.stringify(x,null,2))+'\n');
const reports=[], repeats=[];
for(const c of conditions) {
  const report=await run(adapter(c),options), repeat=await run(adapter(c),options);
  for(const r of [report,repeat]) { assert.deepEqual(r.rows.map(x=>x.taskId),tasks.map(t=>t.id)); assert.ok(r.rows.every(x=>!x.error)); assert.equal(r.totals.costUsd??0,0); }
  const a=hash(JSON.stringify(semantic(report))), b=hash(JSON.stringify(semantic(repeat))); assert.equal(a,b);
  reports.push({...c,report}); repeats.push({...c,sha256:a,repeatSha256:b});
}
save('runs',reports); save('repeat',repeats);
const observed=r=>r.grading?.observedPushbackLevel;
const rowMetrics=r=>({score:r.score,exact:+(r.grading?.distance===0),invalid:+(observed(r)===undefined),under:+(observed(r)<r.grading?.expectedPushbackLevel),over:+(observed(r)>r.grading?.expectedPushbackLevel)});
const cluster=(rows,key)=>bootstrap([plans.map(p=>mean(rows.filter(r=>plan({id:r.taskId})===p).map(r=>rowMetrics(r)[key])))],g=>mean(g[0]));
const stats=reports.filter(c=>c.policy!=='simulated').map(({policy,report})=>({policy,score:cluster(report.rows,'score'),...Object.fromEntries(['exact','invalid','under','over'].map(k=>[k,wilson(report.rows.reduce((s,r)=>s+rowMetrics(r)[k],0),tasks.length)])),curve:report.pushbackCurve,correlation:report.harmLabelCorrelation}));
const simulations=[];
for(const q of [0,.25,.5,.75,1]) for(const layer of ['none','floor','refuse']) {
  const rs=reports.filter(c=>c.policy==='simulated'&&c.q===q&&c.layer===layer), base=reports.filter(c=>c.policy==='simulated'&&c.q===q&&c.layer==='none');
  const metric=(r,k)=>mean(r.report.rows.map(x=>rowMetrics(x)[k]));
  simulations.push({q,layer,seeds:rs.length,...Object.fromEntries(['score','exact','invalid','under','over'].map(k=>[k,bootstrap([rs.map(r=>metric(r,k))],g=>mean(g[0]))])),contrasts:Object.fromEntries(['score','under','over'].map(k=>[k,bootstrap([rs.map((r,i)=>metric(r,k)-metric(base[i],k))],g=>mean(g[0]))]))});
}
const reference=reports.find(r=>r.policy==='packaged-good').report;
const contrasts=reports.filter(r=>r.policy!=='simulated').map(({policy,report})=>({policy,score:bootstrap([plans.map(p=>mean(report.rows.map((r,i)=>({p:plan({id:r.taskId}),d:r.score-reference.rows[i].score})).filter(r=>r.p===p).map(r=>r.d)))],g=>mean(g[0]))}));
const coverage=harms.map(harm=>({harm,counts:bands.map(b=>tasks.filter(t=>t.metadata.harm===harm&&t.expected===b).length)}));
const scoringSource=readFileSync('src/decision.ts','utf8'), adjacent=Number(scoringSource.match(/distance === 1 \? ([\d.]+)/)[1]), courtesy=Number(scoringSource.match(/score - ([\d.]+)/)[1]);
save('summary',{kind:'scripted-and-simulated',options,tasks:tasks.length,plans:plans.length,policies:policies.length,conditions:conditions.length,episodes:conditions.length*tasks.length*2,costUsd:0,scoring:{adjacent,courtesy},coverage,stats,simulations,contrasts,freeModels:{status:'not-run',reason:'No guarded endpoint configured for this study; provider availability untested.'}});
const inputs=[...sources,'paper/PREREG.md','paper/config.json','paper/scripts/run.mjs','paper/template/stats.mjs'];
save('provenance',{source_commit:config.source_commit,prereg_commit:execFileSync('git',['log','--reverse','--format=%H','--','paper/PREREG.md'],{encoding:'utf8'}).trim().split('\n')[0],node:process.version,files:Object.fromEntries(inputs.map(p=>[p,hash(readFileSync(p))])),runs_sha256:hash(readFileSync('paper/data/runs.generated.json'))});
console.log(`${conditions.length} conditions, ${conditions.length*tasks.length*2} episodes, all repeats agree, API cost USD 0`);
