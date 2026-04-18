#!/usr/bin/env node

import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(SCRIPT_DIR);
const TEST_ROOT = path.join(REPO_ROOT, "tests");

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".test.mjs")) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function toRelativePosix(filePath) {
  return path.relative(REPO_ROOT, filePath).split(path.sep).join("/");
}

const groupFilters = {
  all: () => true,
  unit: (relativePath) => relativePath.startsWith("tests/unit/"),
  content: (relativePath) =>
    relativePath.startsWith("tests/unit/content/") ||
    relativePath.startsWith("tests/contract/content/") ||
    relativePath.startsWith("tests/scenario/content/"),
  combat: (relativePath) =>
    relativePath.startsWith("tests/unit/combat/") ||
    relativePath.startsWith("tests/scenario/combat/"),
  powerups: (relativePath) =>
    relativePath.startsWith("tests/scenario/powerups/") ||
    relativePath === "tests/unit/combat/core-and-state.test.mjs" ||
    relativePath === "tests/unit/content/data.test.mjs",
  runtime: (relativePath) =>
    relativePath.startsWith("tests/unit/runtime/") ||
    relativePath.startsWith("tests/scenario/runtime/"),
};

export function listTestFiles(group = "all") {
  const filter = groupFilters[group];
  if (!filter) {
    throw new Error(`Unknown fast-test group: ${group}. Use one of ${Object.keys(groupFilters).join(", ")}.`);
  }

  return walk(TEST_ROOT).filter((filePath) => filter(toRelativePosix(filePath)));
}

export function runFastTests(group = "all", { stdio = "inherit" } = {}) {
  const files = listTestFiles(group);
  if (files.length === 0) {
    throw new Error(`No test files matched fast-test group: ${group}.`);
  }

  const result = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...files], {
    cwd: REPO_ROOT,
    stdio,
    encoding: "utf-8",
  });

  if (result.status !== 0) {
    const error = new Error(`Fast test group failed: ${group}`);
    error.result = result;
    throw error;
  }

  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const group = process.argv[2] || "all";
  try {
    runFastTests(group);
  } catch (error) {
    console.error(error.result?.stderr || error.message);
    process.exit(error.result?.status || 1);
  }
}
