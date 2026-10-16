import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { writeHiddenPlans } from "./gen-hidden-plans.mjs";

const DEFAULT_PUBLIC_SEED = 20261015;

const { values } = parseArgs({
  options: {
    seed: { type: "string" },
    split: { type: "string", default: "public" },
    plans: { type: "string" },
    "fixture-hidden": { type: "boolean", default: false },
    force: { type: "boolean", default: false },
  },
});

const split = values.split;
if (split !== "public" && split !== "hidden") {
  throw new Error("--split must be public or hidden");
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let plansPath;
let outputPath;
let idPrefix;

if (split === "public") {
  plansPath = resolve(root, "data/plans.json");
  outputPath = resolve(root, "data/tasks.jsonl");
  idPrefix = "public";
} else {
  plansPath = resolve(
    values.plans ?? process.env.BENCHMARK_SYCOPHANCY_HIDDEN_PLANS ?? resolve(root, ".hidden/plans.hidden.json"),
  );
  outputPath = resolve(root, ".hidden/tasks.jsonl");
  idPrefix = "hidden";
  await mkdir(dirname(outputPath), { recursive: true });

  let plansPresent = true;
  try {
    await access(plansPath);
  } catch {
    plansPresent = false;
  }

  if (!plansPresent) {
    if (values["fixture-hidden"] && process.env.BENCHMARK_SYCOPHANCY_FIXTURE_HIDDEN === "1") {
      const fixtureSeed = Number(values.seed ?? process.env.BENCHMARK_SYCOPHANCY_FIXTURE_HIDDEN_SEED ?? 9001);
      if (!Number.isSafeInteger(fixtureSeed)) throw new Error("fixture hidden seed must be a safe integer");
      await writeHiddenPlans(fixtureSeed, plansPath);
      console.warn("generated fixture hidden plans for CI only; do not use for real evaluations");
    } else {
      throw new Error(
        "Hidden plans file is missing. Author .hidden/plans.hidden.json (gitignored), set BENCHMARK_SYCOPHANCY_HIDDEN_PLANS, or pass --plans. For CI fixture generation only, set BENCHMARK_SYCOPHANCY_FIXTURE_HIDDEN=1 with --fixture-hidden.",
      );
    }
  } else if (values.force && values["fixture-hidden"] && process.env.BENCHMARK_SYCOPHANCY_FIXTURE_HIDDEN === "1") {
    const fixtureSeed = Number(values.seed ?? process.env.BENCHMARK_SYCOPHANCY_FIXTURE_HIDDEN_SEED ?? 9001);
    if (!Number.isSafeInteger(fixtureSeed)) throw new Error("fixture hidden seed must be a safe integer");
    await writeHiddenPlans(fixtureSeed, plansPath);
    console.warn("regenerated fixture hidden plans because --force was set");
  }
}

const seed = Number(
  values.seed
  ?? (split === "public" ? DEFAULT_PUBLIC_SEED : process.env.BENCHMARK_SYCOPHANCY_HIDDEN_SEED),
);
if (!Number.isSafeInteger(seed)) {
  throw new Error(split === "hidden" ? "--seed or BENCHMARK_SYCOPHANCY_HIDDEN_SEED is required for hidden splits" : "--seed must be a safe integer");
}

const plans = JSON.parse(await readFile(plansPath, "utf8"));
const tasks = plans.flatMap((plan) =>
  plan.levels.map((level) => ({
    id: `${idPrefix}-${plan.id}-${level.harm}`,
    kind: "episode",
    prompt: level.prompt,
    expected: level.expectedDecision,
    metadata: {
      planId: plan.id,
      planTitle: plan.title,
      harm: level.harm,
      expectedDecision: level.expectedDecision,
      labelReason: level.reason,
      seed,
      split,
    },
  })),
);

function mulberry32(value) {
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(seed ^ (split === "hidden" ? 0x51c0ffee : 0));
for (let index = tasks.length - 1; index > 0; index--) {
  const target = Math.floor(random() * (index + 1));
  [tasks[index], tasks[target]] = [tasks[target], tasks[index]];
}

await writeFile(outputPath, `${tasks.map((task) => JSON.stringify(task)).join("\n")}\n`);
console.log(`generated ${tasks.length} ${split} tasks with seed ${seed} -> ${outputPath}`);
