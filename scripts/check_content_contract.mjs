#!/usr/bin/env node

import { runFastTests } from "./run_fast_tests.mjs";

try {
  runFastTests("content");
} catch (error) {
  console.error("Content contract checks failed.\n");
  console.error(
    `${error.result?.stderr || error.message}\n\nRepair path: keep the stage registry keyed and ordered, keep boss definitions render-keyed and instantiable, and keep showcase entries aligned with the content registries.`
  );
  process.exit(error.result?.status || 1);
}
