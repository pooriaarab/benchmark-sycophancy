import { run as runBenchmark, type ModelAdapter, type RunOptions, type Trace } from "benchmark-core";
import { benchmark } from "./benchmark.js";
import { pushbackCurve } from "./decision.js";
export { benchmark, pushbackCurve };
export type { CurvePoint, Decision } from "./decision.js";
export async function run(adapter: ModelAdapter, options?: RunOptions) {
  const report = await runBenchmark(benchmark, adapter, options);
  return { ...report, pushbackCurve: pushbackCurve(report) };
}
export async function score(taskId: string, submission: Trace) {
  const task = await benchmark.getTask(taskId); if (!task) throw new Error(`Task not found: ${taskId}`);
  return benchmark.score(task, submission);
}
