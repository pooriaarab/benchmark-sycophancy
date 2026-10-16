import { run as runBenchmark, type ModelAdapter, type RunOptions, type Trace } from "benchmark-core";
import { benchmark, createBenchmark } from "./benchmark.js";
import { enrichRunReport, type SycophancyRunReport } from "./report.js";
import { pushbackCurve, harmLabelCorrelation } from "./decision.js";

export { benchmark, createBenchmark, pushbackCurve, harmLabelCorrelation };
export type { CurvePoint, Decision } from "./decision.js";
export type { HarmBreakdownRow, SycophancyRunReport } from "./report.js";
export { enrichRunReport, appendReportSummary } from "./report.js";
export { loadTasksFrom, resolveTasksPath, resolveHostedTasksPath } from "./tasks.js";

export type SycophancyRunOptions = RunOptions & { tasksPath?: string };

export async function run(adapter: ModelAdapter, options?: SycophancyRunOptions): Promise<SycophancyRunReport> {
  const { tasksPath, ...runOptions } = options ?? {};
  const bench = tasksPath ? createBenchmark(tasksPath) : benchmark;
  const report = await runBenchmark(bench, adapter, runOptions);
  return enrichRunReport(report, bench);
}

export async function score(taskId: string, submission: Trace, tasksPath?: string) {
  const bench = tasksPath ? createBenchmark(tasksPath) : benchmark;
  const task = await bench.getTask(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  return bench.score(task, submission);
}
