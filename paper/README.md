# Calibrated pushback paper
Run from the repository root with Node 22, npm 10, Python 3, Tectonic, and Poppler on PATH.
```sh
npm ci
sh paper/template/reproduce.sh
```
The command runs the study, renders four figures, builds `paper/sycophancy-paper.pdf`, and verifies the packet.
The PDF and downloaded style stay untracked. The build verifies the official style archive hash.
Experiments use local scripted adapters. They need no credentials, model service, or paid inference.
The build may download TeX dependencies. It does not publish the packet.

The unchanged `template/` comes from benchmark-honesty PR 24's accepted pilot.
All prose, experiments, adapters, figures, and citations are specific to sycophancy.
`PREREG.md` precedes collected results in Git history. This is a local plan, not an external registration.
`config.json` freezes the benchmark source. The runner rejects changes to frozen inputs.
`data/runs.generated.json` holds raw episode reports, outputs, and tool traces.
`data/repeat.generated.json` holds semantic hashes from independent repeat executions; timings are excluded.
`data/summary.generated.json` holds intervals and every baseline and simulated cell.
`data/provenance.generated.json` records source and plan hashes.
`data/verification.generated.json` records replay checks and the built PDF hash.
The verifier replays every stored submission and checks raw-to-summary agreement.
Baseline scores resample plans. Binary baseline rates use Wilson intervals and ignore plan dependence.
Simulated intervals resample seeds over fixed tasks. Repeated executions add no independent observations.
No learned model, human participant, hidden task, or provider availability test is reported.
The paper and generated figures use CC-BY-4.0. Benchmark code and tasks retain MIT.
The existing local CI fails with npm 12 because its package report changes shape. Use the workflow's Node 22 toolchain.
The parent handles publication and merge review. This packet performs neither action.
