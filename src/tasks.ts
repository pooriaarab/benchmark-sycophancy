import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Task } from "benchmark-core";

const defaultTasksPath = new URL("../data/tasks.jsonl", import.meta.url);

export function resolveTasksPath(tasksPath?: string): string | URL {
  if (!tasksPath) return defaultTasksPath;
  return resolve(tasksPath);
}

export async function loadTasksFrom(tasksFile: string | URL = defaultTasksPath): Promise<Task[]> {
  const text = await readFile(tasksFile, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as Task);
}
