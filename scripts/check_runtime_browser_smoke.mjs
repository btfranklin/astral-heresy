#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "test:browser"],
  { cwd: repoRoot, stdio: "inherit" }
);

if (result.error) {
  console.error(`Unable to start the browser contract suite: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
