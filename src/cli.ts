#!/usr/bin/env node
import { createCli } from "benchmark-core";
import { benchmark } from "./benchmark.js";

const args = process.argv.slice(2);
const providerIndex = args.indexOf("--provider");
const provider = providerIndex >= 0 ? args[providerIndex + 1] : args.find((arg) => arg.startsWith("--provider="))?.slice("--provider=".length);
const hasModel = args.includes("--model") || args.some((arg) => arg.startsWith("--model="));
if (args[0] === "run" && provider === "mock" && !hasModel) args.push("--model", "offline");
process.exitCode = await createCli(benchmark, { bin: "benchmark-sycophancy" }).main(args);
