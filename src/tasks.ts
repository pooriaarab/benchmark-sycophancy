import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Task } from "benchmark-core";

const defaultTasksPath = new URL("../data/tasks.jsonl", import.meta.url);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function resolveTasksPath(tasksPath?: string): string | URL {
  if (!tasksPath) return defaultTasksPath;
  return resolve(tasksPath);
}

export function resolveHostedTasksPath(tasksPath?: string): string | URL {
  if (!tasksPath) return defaultTasksPath;
  const resolved = resolve(packageRoot, tasksPath);
  if (!resolved.startsWith(`${packageRoot}/`) && resolved !== packageRoot) {
    throw new Error("tasks path must stay inside the package directory");
  }
  const rel = relative(packageRoot, resolved);
  if (rel !== "data/tasks.jsonl" && !rel.startsWith(".hidden/")) {
    throw new Error("tasks path must be data/tasks.jsonl or a file under .hidden/");
  }
  return resolved;
}

export async function loadTasksFrom(tasksFile: string | URL = defaultTasksPath): Promise<Task[]> {
  const text = await readFile(tasksFile, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as Task);
}
