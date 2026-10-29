import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {benchmark} from '../../dist/index.js';
const read=n=>JSON.parse(readFileSync(`paper/data/${n}.generated.json`)), s=read('summary'), runs=read('runs'), repeats=read('repeat'), provenance=read('provenance');
const hash=x=>createHash('sha256').update(x).digest('hex'), mean=a=>a.reduce((x,y)=>x+y,0)/a.length, close=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
const tasks=await benchmark.listTasks(); assert.equal(runs.length,s.conditions); assert.equal(repeats.length,runs.length);
let replayed=0;
for(let i=0;i<runs.length;i++) { const {report}=runs[i]; assert.equal(report.rows.length,tasks.length); close(mean(report.rows.map(r=>r.score)),report.mean);
  for(const row of report.rows) {const task=tasks.find(t=>t.id===row.taskId), graded=await benchmark.score(task,row.submission,{seed:report.seed}); close(graded.score,row.score); assert.equal(graded.reason,row.reason); replayed++;}
  const semantic=report.rows.map(({taskId,submission,episode,score,reason})=>({taskId,submission,episode,score,reason})); assert.equal(hash(JSON.stringify(semantic)),repeats[i].sha256); assert.equal(repeats[i].sha256,repeats[i].repeatSha256);
}
for(const row of s.stats) {const r=runs.find(r=>r.policy===row.policy).report; close(row.score.value,r.mean); let count=0;
  for(const [key,test] of Object.entries({exact:r=>r.grading?.distance===0,invalid:r=>r.grading?.observedPushbackLevel===undefined,under:r=>r.grading?.observedPushbackLevel<r.grading?.expectedPushbackLevel,over:r=>r.grading?.observedPushbackLevel>r.grading?.expectedPushbackLevel})) {const k=r.rows.filter(test).length; assert.equal(k,row[key].k); close(row[key].value,k/tasks.length); count+=k;} assert.equal(count,tasks.length);
}
for(const row of s.simulations) {const rs=runs.filter(r=>r.policy==='simulated'&&r.q===row.q&&r.layer===row.layer); assert.equal(rs.length,row.seeds); close(row.score.value,mean(rs.map(r=>r.report.mean)));}
for(const [p,h] of Object.entries(provenance.files)) assert.equal(hash(readFileSync(p)),h); assert.equal(hash(readFileSync('paper/data/runs.generated.json')),provenance.runs_sha256);
const meta=JSON.parse(readFileSync('paper/meta.json')); assert.ok(/^[\x00-\x7f]*$/.test(meta.abstract)&&meta.abstract.length<=1920); assert.equal(meta.license,'CC-BY-4.0');
const text=execFileSync('pdftotext',['-layout',`paper/${meta.artifact_name}`,'-'],{encoding:'utf8'}), pages=text.split('\f').filter(x=>x.trim()).length;
assert.ok(pages>=8); assert.ok(!text.includes('??')); assert.ok(!readFileSync('paper/paper.tex','utf8').includes('—')); assert.ok(!/Overfull|undefined references|undefined citations/.test(readFileSync('paper/paper.log','utf8')));
const firstResult=execFileSync('git',['log','--reverse','--format=%H','--','paper/data/runs.generated.json'],{encoding:'utf8'}).trim().split('\n')[0]; if(firstResult) {assert.notEqual(firstResult,provenance.prereg_commit); execFileSync('git',['merge-base','--is-ancestor',provenance.prereg_commit,firstResult]);}
const evidence={status:'pass',pages,replayed,conditions:s.conditions,episodes:s.episodes,repeat_hashes_match:true,raw_to_summary:true,pdf_sha256:hash(readFileSync(`paper/${meta.artifact_name}`)),source_commit:provenance.source_commit,prereg_commit:provenance.prereg_commit};
writeFileSync('paper/data/verification.generated.json',JSON.stringify(evidence,null,2)+'\n'); console.log(JSON.stringify(evidence));
