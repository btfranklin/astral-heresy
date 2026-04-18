#!/usr/bin/env node

import { runFastTests } from "./run_fast_tests.mjs";

try {
  runFastTests("runtime");
} catch (error) {
  console.error("Runtime smoke checks failed.\n");
  console.error(
    `${error.result?.stderr || error.message}\n\nRepair path: keep start flow, restart behavior, render-study wiring, and HUD sync aligned with the runtime controller and interface controller.`
  );
  process.exit(error.result?.status || 1);
}
