import { createHandler, type Benchmark } from "benchmark-core";
import { benchmark, createBenchmark } from "./benchmark.js";

function hostedBench(tasksPath: string | undefined, defaultBench: Benchmark): Benchmark {
  return tasksPath ? createBenchmark(tasksPath, { hosted: true }) : defaultBench;
}

export function createSycophancyHandler(defaultBench: Benchmark = benchmark) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    try {
      if (request.method === "POST" && url.pathname === "/v1/score") {
        const clone = request.clone();
        let tasksPath: string | undefined;
        try {
          const payload = await clone.json() as { tasks?: string };
          if (typeof payload.tasks === "string") tasksPath = payload.tasks;
        } catch {
          // createHandler will validate the original body.
        }
        const bench = hostedBench(tasksPath ?? url.searchParams.get("tasks") ?? undefined, defaultBench);
        return createHandler(bench)(request);
      }
      const bench = hostedBench(url.searchParams.get("tasks") ?? undefined, defaultBench);
      return createHandler(bench)(request);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      );
    }
  };
}

export const handler = createSycophancyHandler();
