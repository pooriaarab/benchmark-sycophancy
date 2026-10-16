import type { Benchmark, RunReport, Trace } from "benchmark-core";
import { harmLabelCorrelation, pushbackCurve, type CurvePoint } from "./decision.js";

export type HarmBreakdownRow = {
  harm: "low" | "medium" | "high" | "severe";
  meanScore: number;
  tasks: number;
};

export type EnrichedRunRow = RunReport["rows"][number] & {
  harm: string | null;
  grading: unknown;
};

export type SycophancyRunReport = RunReport & {
  pushbackCurve: CurvePoint[];
  harmBreakdown: HarmBreakdownRow[];
  harmLabelCorrelation: number | null;
  rows: EnrichedRunRow[];
};

const HARMS = ["low", "medium", "high", "severe"] as const;

export async function enrichRunReport(
  report: RunReport,
  bench: Benchmark,
): Promise<SycophancyRunReport> {
  const rows: EnrichedRunRow[] = await Promise.all(report.rows.map(async (row) => {
    const task = await bench.getTask(row.taskId);
    let grading: unknown;
    if (task && row.submission) {
      grading = (await bench.score(task, row.submission, { seed: report.seed })).details;
    }
    return {
      ...row,
      harm: typeof task?.metadata?.harm === "string" ? task.metadata.harm : null,
      grading,
    };
  }));

  const harmBreakdown = HARMS.map((harm) => {
    const harmRows = rows.filter((entry) => entry.taskId.endsWith(`-${harm}`));
    const meanScore = harmRows.length
      ? harmRows.reduce((sum, entry) => sum + entry.score, 0) / harmRows.length
      : 0;
    return { harm, meanScore, tasks: harmRows.length };
  });

  const curveReport = { ...report, rows };
  return {
    ...report,
    rows,
    pushbackCurve: pushbackCurve(curveReport),
    harmBreakdown,
    harmLabelCorrelation: harmLabelCorrelation(curveReport),
  };
}

export function appendReportSummary(report: SycophancyRunReport): string {
  const lines = [
    "",
    "## Pushback curve",
    ...report.pushbackCurve.map((point) =>
      `- ${point.harm}: mean pushback ${point.meanPushback?.toFixed(2) ?? "n/a"} (${point.observed}/${point.observed + point.missing} tasks)`),
    "",
    "## Harm breakdown",
    ...report.harmBreakdown.map((row) =>
      `- ${row.harm}: mean score ${(row.meanScore * 100).toFixed(1)}% (${row.tasks} tasks)`),
    "",
    `Harm-label correlation (Pearson): ${report.harmLabelCorrelation?.toFixed(3) ?? "n/a"}`,
  ];
  return lines.join("\n");
}

export function traceFromSubmission(submission: Trace) {
  return submission;
}
