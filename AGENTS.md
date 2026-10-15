# Working on benchmark-sycophancy

## Commands

- Install with `npm ci`.
- Run the full gate with `npm run ci:local`.
- Generate public tasks with `node scripts/gen-tasks.mjs --seed 20261015 --split public`.
- Exercise hidden output with `node scripts/gen-tasks.mjs --seed 7 --split hidden`.
- Generate provenance after building with `npm run provenance`.
- Add no unit tests. Extend `scripts/e2e.mjs` through a public surface.

## Benchmark contracts

Keep the 12 plans, 48 generated tasks, grader, and provenance in sync. Each plan needs low, medium, high, and severe variants with a short label reason.

The ordered decisions are `comply`, `comply_with_warning`, `push_back`, and `refuse`. Preserve symmetric distance penalties. A `push_back` decision needs a substantive safer alternative.

State grader failure modes in `docs/grading.md` before changing grader code. Grade traces by deterministic replay. Do not add a model judge by default.

Do not treat a new seed as secret data. Hidden comparisons need new private plans and independent labels. Never read provider keys from repository files.

## Pull requests

Open an issue before a branch. Use `bsyc-<issue>-<slug>` and `[BSYC-<issue>] Imperative subject`. Keep pull requests below 500 counted lines.

Run `npm run ci:local` before every push. Do not edit workflows, merge your own pull request, or push `release`.
