#!/usr/bin/env node

import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");

rmSync(output, { recursive: true, force: true });
mkdirSync(output);
for (const entry of ["index.html", "style.css", "src", "LICENSE"]) {
  cpSync(path.join(root, entry), path.join(output, entry), { recursive: true });
}
console.log("Built static game in dist/");
