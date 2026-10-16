import {
  MAX_TOOL_LOG_ENTRIES,
  mockAdapter,
  openrouterAdapter,
  run as runBenchmark,
  type Benchmark,
} from "benchmark-core";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { benchmark, createBenchmark } from "./benchmark.js";
import { enrichRunReport } from "./report.js";

const tools = [
  {
    name: "list_tasks",
    description: "List benchmark task ids and prompts.",
    inputSchema: {
      type: "object",
      properties: { tasks: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_task",
    description: "Get one benchmark task.",
    inputSchema: {
      type: "object",
      properties: { taskId: { type: "string" }, tasks: { type: "string" } },
      required: ["taskId"],
      additionalProperties: false,
    },
  },
  {
    name: "score_answer",
    description: "Score a trace with the deterministic benchmark grader.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        submission: { type: "object" },
        seed: { type: "number" },
        tasks: { type: "string" },
      },
      required: ["taskId", "submission"],
      additionalProperties: false,
    },
  },
  {
    name: "run_benchmark",
    description: "Run every task through an OpenRouter model or the offline mock.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        provider: { type: "string", enum: ["mock", "openrouter"] },
        tasks: { type: "string" },
      },
      required: ["model"],
      additionalProperties: false,
    },
  },
  { name: "get_provenance", description: "Get benchmark data provenance.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
];

const content = (value: unknown, isError = false) => ({
  content: [{ type: "text", text: JSON.stringify(value) }],
  ...(isError ? { isError: true } : {}),
});

function args(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function benchFor(input: Record<string, unknown>): Benchmark {
  return typeof input.tasks === "string" ? createBenchmark(input.tasks) : benchmark;
}

export function createMcpServer(defaultBench: Benchmark = benchmark) {
  const server = new Server(
    { name: defaultBench.definition.id, version: defaultBench.definition.version },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...tools] }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const input = args(request.params.arguments);
      const bench = benchFor(input);
      if (request.params.name === "list_tasks") return content({ tasks: await bench.listTasks() });
      if (request.params.name === "get_task") {
        if (typeof input.taskId !== "string") return content({ error: "taskId is required." }, true);
        const task = await bench.getTask(input.taskId);
        return task ? content({ task }) : content({ error: "Task not found." }, true);
      }
      if (request.params.name === "score_answer") {
        if (typeof input.taskId !== "string" || !input.submission || typeof input.submission !== "object" || Array.isArray(input.submission)) {
          return content({ error: "taskId and submission are required." }, true);
        }
        const submittedLog = Reflect.get(input.submission, "toolLog");
        if (Array.isArray(submittedLog) && submittedLog.length > MAX_TOOL_LOG_ENTRIES) {
          return content({ error: `toolLog may not exceed ${MAX_TOOL_LOG_ENTRIES} entries.` }, true);
        }
        const task = await bench.getTask(input.taskId);
        return task
          ? content({ taskId: task.id, ...await bench.score(task, input.submission, typeof input.seed === "number" ? { seed: input.seed } : {}) })
          : content({ error: "Task not found." }, true);
      }
      if (request.params.name === "run_benchmark") {
        if (typeof input.model !== "string") return content({ error: "model is required." }, true);
        const provider = typeof input.provider === "string" ? input.provider : "openrouter";
        if (provider === "mock") {
          const report = await enrichRunReport(await runBenchmark(bench, mockAdapter({
            seed: 1,
            ...bench.definition.mockPolicies ? { policies: bench.definition.mockPolicies } : {},
          })), bench);
          return content(report);
        }
        if (!process.env.OPENROUTER_API_KEY) return content({ error: "OPENROUTER_API_KEY is required to run a benchmark." }, true);
        const report = await enrichRunReport(await runBenchmark(bench, openrouterAdapter({ model: input.model })), bench);
        return content(report);
      }
      if (request.params.name === "get_provenance") return content({ provenance: defaultBench.definition.provenance });
      return content({ error: `Unknown tool: ${request.params.name}` }, true);
    } catch (caught) {
      return content({ error: caught instanceof Error ? caught.message : "Unknown error." }, true);
    }
  });
  return server;
}

export async function startMcp() {
  await createMcpServer().connect(new StdioServerTransport());
}
