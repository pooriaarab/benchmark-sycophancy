#!/usr/bin/env node
import {
  bootstrapCI,
  createCli,
  mockAdapter,
  openaiCompatAdapter,
  openrouterAdapter,
  renderCard,
  renderMarkdown,
  run as runBenchmark,
  serve,
  type Benchmark,
} from "benchmark-core";
import { createSycophancyHandler } from "./api.js";
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { benchmark, createBenchmark } from "./benchmark.js";
import { appendReportSummary, enrichRunReport } from "./report.js";

const UsageError = class extends Error {};

function stripTasks(argv: string[]) {
  const args = [...argv];
  let tasksPath: string | undefined;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--tasks" && args[index + 1]) {
      tasksPath = args[index + 1];
      args.splice(index, 2);
      index--;
      continue;
    }
    const tasksArg = args[index];
    if (tasksArg?.startsWith("--tasks=")) {
      tasksPath = tasksArg.slice("--tasks=".length);
      args.splice(index, 1);
      index--;
    }
  }
  return { args, tasksPath };
}

function benchFor(tasksPath?: string): Benchmark {
  return tasksPath ? createBenchmark(tasksPath) : benchmark;
}

function adapter(provider: string, model: string, bench: Benchmark, seed: number) {
  if (provider === "mock") {
    return mockAdapter({
      seed,
      ...bench.definition.mockPolicies ? { policies: bench.definition.mockPolicies } : {},
    });
  }
  if (provider === "openrouter") return openrouterAdapter({ model });
  if (provider === "openai") return openaiCompatAdapter({ model });
  throw new UsageError("--provider must be openrouter, openai, or mock.");
}

function isReport(value: unknown) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Array.isArray(Reflect.get(value, "rows"));
}

async function runCommand(rest: string[], jsonOutput: boolean, tasksPath?: string) {
  const parsed = parseArgs({
    args: rest,
    options: {
      model: { type: "string" },
      provider: { type: "string" },
      concurrency: { type: "string" },
      timeout: { type: "string" },
      retries: { type: "string" },
      seed: { type: "string" },
      "max-turns": { type: "string" },
      "max-tool-calls": { type: "string" },
      budget: { type: "string" },
    },
    strict: true,
  });
  const model = parsed.values.model;
  const provider = parsed.values.provider;
  if (!model || !provider) throw new UsageError("run needs --model and --provider.");
  const seed = Number(parsed.values.seed ?? 1);
  const bench = benchFor(tasksPath);
  const report = await enrichRunReport(await runBenchmark(bench, adapter(provider, model, bench, seed), {
    ...parsed.values.concurrency ? { concurrency: Number(parsed.values.concurrency) } : {},
    ...parsed.values.timeout ? { timeoutMs: Number(parsed.values.timeout) } : {},
    ...parsed.values.retries ? { retries: Number(parsed.values.retries) } : {},
    seed,
    ...parsed.values["max-turns"] ? { maxTurns: Number(parsed.values["max-turns"]) } : {},
    ...parsed.values["max-tool-calls"] ? { maxToolCalls: Number(parsed.values["max-tool-calls"]) } : {},
    ...parsed.values.budget ? { budgetUsd: Number(parsed.values.budget) } : {},
  }), bench);
  console.log(jsonOutput ? JSON.stringify(report) : `${renderMarkdown(report)}${appendReportSummary(report)}`);
  return report.rows.some((row) => row.error) ? 2 : 0;
}

async function scoreCommand(rest: string[], jsonOutput: boolean, tasksPath?: string) {
  const file = rest[0];
  if (!file) throw new UsageError("score needs a results JSON file.");
  const original = JSON.parse(await readFile(file, "utf8"));
  if (!isReport(original)) throw new UsageError("File is not a run report.");
  const bench = benchFor(tasksPath);
  const rows = [];
  for (const row of original.rows) {
    const task = await bench.getTask(row.taskId);
    if (!task || row.submission === undefined) throw new UsageError(`Cannot score task ${row.taskId}.`);
    const grade = await bench.score(task, row.submission, { seed: original.seed });
    rows.push({ ...row, score: grade.score, reason: grade.reason });
  }
  const scores = rows.map((row) => row.score);
  const base = {
    ...original,
    rows,
    mean: scores.reduce((left, right) => left + right, 0) / scores.length,
    confidenceInterval95: bootstrapCI(scores, original.seed),
  };
  const report = await enrichRunReport(base, bench);
  console.log(jsonOutput ? JSON.stringify(report) : `${renderMarkdown(report)}${appendReportSummary(report)}`);
  return 0;
}

async function main(argv: string[]) {
  const providerIndex = argv.indexOf("--provider");
  const provider = providerIndex >= 0
    ? argv[providerIndex + 1]
    : argv.find((arg) => arg.startsWith("--provider="))?.slice("--provider=".length);
  const hasModel = argv.includes("--model") || argv.some((arg) => arg.startsWith("--model="));
  if (argv[0] === "run" && provider === "mock" && !hasModel) argv.push("--model", "offline");

  const { args, tasksPath } = stripTasks(argv);
  const command = args[0];
  const rest = args.slice(1);
  const jsonOutput = rest.includes("--json");
  const clean = rest.filter((arg) => arg !== "--json");

  if (command === "run") return runCommand(clean, jsonOutput, tasksPath);
  if (command === "score") return scoreCommand(clean, jsonOutput, tasksPath);
  if (command === "serve") {
    const parsed = parseArgs({
      args: clean,
      options: { host: { type: "string" } },
      allowPositionals: true,
      strict: true,
    });
    if (parsed.positionals.length > 1) throw new UsageError("serve accepts at most one port.");
    const port = Number(parsed.positionals[0] ?? process.env.PORT ?? 3000);
    const hostname = parsed.values.host ?? "127.0.0.1";
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new UsageError("serve port must be an integer from 0 to 65535.");
    await serve(createSycophancyHandler(benchFor(tasksPath)), { port, hostname });
    console.log(jsonOutput ? JSON.stringify({ listening: port, host: hostname }) : `Listening on http://${hostname}:${port}`);
    return 0;
  }

  if (command === "mcp") {
    const { startMcp } = await import("./mcp.js");
    await startMcp();
    return 0;
  }

  if (tasksPath) {
    const delegated = createCli(benchFor(tasksPath), { bin: "benchmark-sycophancy" });
    return delegated.main(args);
  }
  if (command === "card") {
    const file = clean[0];
    if (!file) throw new UsageError("card needs a report JSON file.");
    const svg = renderCard(JSON.parse(await readFile(file, "utf8")));
    const output = clean[1];
    if (output) {
      await writeFile(output, svg);
      console.log(jsonOutput ? JSON.stringify({ output }) : output);
    } else {
      console.log(jsonOutput ? JSON.stringify({ svg }) : svg);
    }
    return 0;
  }

  return createCli(benchmark, { bin: "benchmark-sycophancy" }).main(args);
}

const rawArgs = process.argv.slice(2);
try {
  process.exitCode = await main(rawArgs);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
