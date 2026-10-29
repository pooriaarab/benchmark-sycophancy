# Calibrated pushback study plan
Registered locally before data collection, 2026-10-29. No external registration or deposit is authorized.
Source: benchmark-sycophancy 0.2.0 at the commit in config.json. No study results exist yet.
Prior knowledge: source inspection, existing E2E assertions, and family paper describe the public set and scoring.
H1: the label-informed packaged-good control exceeds every constant-decision control in mean score.
H2: the harm-rank shortcut fails some exact labels because harm level does not uniquely determine a decision.
H3 (simulated): a global pushback floor reduces under-response but increases over-response versus no floor.
Design: all public plans and all four levels; no hidden fixture counts as independent evidence.
Controls: empty, constant-text, echo, text-refuse, first-tool, packaged-good, packaged-bad, four constant decisions, harm-rank, oracle-no-alternative, oracle-rude.
All controls use the SDK episode runner. Label access is disclosed for packaged-good and oracle ablations.
The harm-rank control reads public harm metadata. It is a shortcut diagnostic, not a text-only baseline.
Additional virtual experiment: simulated population with compliance bias q in {0, .25, .5, .75, 1}, seeds 1..20.
For each task, a seeded draw below q replaces the oracle decision with comply; otherwise retain the oracle decision.
Compare no layer, a global push_back floor, and global refuse. These simulated layers do not inspect prompt meaning.
Use the same draws in all three layers. Preserve a generic rationale and alternative. Label access makes this a synthetic sensitivity study.
Run each condition twice; compare semantic traces excluding timing. Repeats do not increase sample size.
Primary metric: package mean score. Secondary: exact band, invalid, under-response, over-response, and pushback curve.
Invalid outputs stay in the denominator and score zero. Under/over rates count valid lower/higher bands over all tasks.
Do not treat missing decisions as safe. Report invalid rate beside direction rates.
Use 95% percentile bootstrap intervals over whole plans for baseline means and paired differences, 2000 draws.
Report Wilson intervals for descriptive binary rates; these assume independent items and do not resolve plan clustering.
For simulated cells, bootstrap whole seeds over the fixed task set; pair layer differences within seed. No population-of-plans inference.
Report all cells and nulls. No p-values or selective best-cell claims. Record boundary interval collapse.
Runner settings: seed 1, concurrency 1, retries 0, maxTurns 1, maxToolCalls 1, budgetUsd 0.
Stop after the fixed grid and repeats. An infrastructure error stops the study; fix and document before rerunning.
No paid inference. Hosted free inference is omitted: no guarded endpoint is configured for this study; availability is untested.
Failure checks before implementation: label leak masquerading as inference, invalid decisions hidden by means, plan dependence, ignored duplicate calls, omitted alternative, courtesy penalty, nondeterministic repeats, source drift.
Figures: harm/decision coverage, baseline scores with uncertainty, pushback curves, simulated floor effects.
Release raw reports, repeat hashes, generated summaries, source hashes, and a PDF. No venue submission or model leaderboard.
