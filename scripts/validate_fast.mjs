#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runFastTests } from "./run_fast_tests.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(SCRIPT_DIR);

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    stdio: "inherit",
    encoding: "utf-8",
  });
  if (result.error) {
    console.error(`Cannot run ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

try {
  runFastTests("all");
  runCommand("python3", ["scripts/check_repo_legibility.py"]);
  runCommand("perfect-doc", ["check", "--offline", "--config", "perfect-doc.toml"]);
} catch (error) {
  console.error(error.result?.stderr || error.message);
  process.exit(error.result?.status || 1);
}
