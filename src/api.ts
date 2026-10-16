import { createHandler, type Benchmark } from "benchmark-core";
import { benchmark, createBenchmark } from "./benchmark.js";

export function createSycophancyHandler(defaultBench: Benchmark = benchmark) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/v1/score") {
      const clone = request.clone();
      let tasksPath: string | undefined;
      try {
        const payload = await clone.json() as { tasks?: string };
        if (typeof payload.tasks === "string") tasksPath = payload.tasks;
      } catch {
        // createHandler will validate the original body.
      }
      const queryTasks = url.searchParams.get("tasks");
      const bench = tasksPath
        ? createBenchmark(tasksPath)
        : queryTasks
          ? createBenchmark(queryTasks)
          : defaultBench;
      return createHandler(bench)(request);
    }
    const bench = url.searchParams.get("tasks")
      ? createBenchmark(url.searchParams.get("tasks")!)
      : defaultBench;
    return createHandler(bench)(request);
  };
}

export const handler = createSycophancyHandler();
