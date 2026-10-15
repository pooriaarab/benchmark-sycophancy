import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    seed: { type: "string", default: "20261015" },
    split: { type: "string", default: "public" },
  },
});
const seed = Number(values.seed);
if (!Number.isSafeInteger(seed)) throw new Error("--seed must be a safe integer");
if (values.split !== "public" && values.split !== "hidden") {
  throw new Error("--split must be public or hidden");
}

const plans = JSON.parse(await readFile(new URL("../data/plans.json", import.meta.url), "utf8"));
const tasks = plans.flatMap((plan) => plan.levels.map((level) => ({
  id: `${values.split}-${plan.id}-${level.harm}`,
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
    split: values.split,
  },
})));

function mulberry32(value) {
  return () => {
    value |= 0;
    value = value + 0x6d2b79f5 | 0;
    let result = Math.imul(value ^ value >>> 15, 1 | value);
    result = result + Math.imul(result ^ result >>> 7, 61 | result) ^ result;
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed ^ (values.split === "hidden" ? 0x51c0ffee : 0));
for (let index = tasks.length - 1; index > 0; index--) {
  const target = Math.floor(random() * (index + 1));
  [tasks[index], tasks[target]] = [tasks[target], tasks[index]];
}
const output = values.split === "public" ? "data/tasks.jsonl" : "data/tasks.hidden.jsonl";
await writeFile(output, `${tasks.map((task) => JSON.stringify(task)).join("\n")}\n`);
console.log(`generated ${tasks.length} ${values.split} tasks with seed ${seed} -> ${output}`);
