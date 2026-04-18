#!/usr/bin/env node

import { runFastTests } from "./run_fast_tests.mjs";

try {
  runFastTests("combat");
} catch (error) {
  console.error("Combat smoke checks failed.\n");
  console.error(
    `${error.result?.stderr || error.message}\n\nRepair path: keep graze, burst, pickup, weakpoint, chain, and loop-two rules aligned with the combat economy implementation.`
  );
  process.exit(error.result?.status || 1);
}
