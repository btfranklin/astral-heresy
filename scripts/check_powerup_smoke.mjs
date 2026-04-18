#!/usr/bin/env node

import { runFastTests } from "./run_fast_tests.mjs";

try {
  runFastTests("powerups");
} catch (error) {
  console.error("Powerup smoke checks failed.\n");
  console.error(
    `${error.result?.stderr || error.message}\n\nRepair path: keep pickup notices, active-effect timers, score shards, and powerup-specific combat behavior aligned with the catalog in src/data/powerups.js.`
  );
  process.exit(error.result?.status || 1);
}
