#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parse } from "acorn";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.dirname(SCRIPT_DIR);
export const SRC_ROOT = path.join(REPO_ROOT, "src");

export const ALLOWED_TARGET_AREAS = {
  index: new Set(["core"]),
  core: new Set(["core", "state", "entities", "systems", "data", "rendering", "audio", "ui", "debug"]),
  state: new Set(["state"]),
  entities: new Set(["entities"]),
  systems: new Set(["systems", "core", "state", "entities", "audio", "data"]),
  data: new Set(["data", "core"]),
  rendering: new Set(["rendering", "core"]),
  audio: new Set(["audio", "core"]),
  ui: new Set(["ui", "state", "core"]),
  debug: new Set(["debug", "state", "data", "systems", "core"]),
};

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function repoRelative(repoRoot, candidate) {
  return toPosix(path.relative(repoRoot, candidate));
}

export function areaForPath(sourcePath, srcRoot = SRC_ROOT) {
  const relative = toPosix(path.relative(srcRoot, sourcePath));
  if (relative === "index.js") return "index";
  return relative.split("/")[0];
}

function locationLabel(sourceRelative, node) {
  const line = node.loc?.start.line ?? 1;
  const column = (node.loc?.start.column ?? 0) + 1;
  return `${sourceRelative}:${line}:${column}`;
}

function walkAst(node, visit) {
  if (!node || typeof node !== "object") return;
  if (typeof node.type === "string") visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === "loc" || key === "start" || key === "end") continue;
    if (Array.isArray(value)) {
      for (const child of value) walkAst(child, visit);
    } else if (value && typeof value === "object") {
      walkAst(value, visit);
    }
  }
}

function staticSpecifier(node) {
  return typeof node.source?.value === "string" ? node.source.value : null;
}

export function parseModuleEdges(sourceText, sourceRelative = "<source>") {
  let ast;
  try {
    ast = parse(sourceText, {
      ecmaVersion: "latest",
      sourceType: "module",
      locations: true,
      allowHashBang: true,
    });
  } catch (error) {
    const line = error.loc?.line ?? 1;
    const column = (error.loc?.column ?? 0) + 1;
    return {
      edges: [],
      errors: [`${sourceRelative}:${line}:${column} cannot be parsed as an ECMAScript module: ${error.message}`],
    };
  }

  const edges = [];
  const errors = [];
  walkAst(ast, (node) => {
    if (node.type === "ImportDeclaration") {
      edges.push({ specifier: staticSpecifier(node), kind: "import", node });
    } else if (node.type === "ExportNamedDeclaration" && node.source) {
      edges.push({ specifier: staticSpecifier(node), kind: "re-export", node });
    } else if (node.type === "ExportAllDeclaration") {
      edges.push({ specifier: staticSpecifier(node), kind: "re-export", node });
    } else if (node.type === "ImportExpression") {
      if (typeof node.source?.value === "string") {
        edges.push({ specifier: node.source.value, kind: "dynamic import", node });
      } else {
        errors.push(
          `${locationLabel(sourceRelative, node)} uses a computed dynamic import. ` +
            "Use a literal module specifier or document and implement an explicit dynamic-import policy.",
        );
      }
    }
  });

  return { edges, errors };
}

function iterSourceFiles(srcRoot) {
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(candidate);
      else if (entry.isFile() && candidate.endsWith(".js")) files.push(candidate);
    }
  }
  if (fs.existsSync(srcRoot)) visit(srcRoot);
  return files.sort();
}

function classifySpecifier(specifier) {
  if (specifier.includes("?") || specifier.includes("#")) return "query-or-fragment";
  if (/^[a-zA-Z][a-zA-Z+.-]*:/.test(specifier) || specifier.startsWith("//")) return "url";
  if (specifier.startsWith("/")) return "root-absolute";
  if (!specifier.startsWith(".")) return "bare";
  return "relative";
}

function findCycles(files, adjacency) {
  let nextIndex = 0;
  const indices = new Map();
  const lowlinks = new Map();
  const stack = [];
  const onStack = new Set();
  const cycles = [];

  function connect(file) {
    indices.set(file, nextIndex);
    lowlinks.set(file, nextIndex);
    nextIndex += 1;
    stack.push(file);
    onStack.add(file);

    for (const target of adjacency.get(file) ?? []) {
      if (!indices.has(target)) {
        connect(target);
        lowlinks.set(file, Math.min(lowlinks.get(file), lowlinks.get(target)));
      } else if (onStack.has(target)) {
        lowlinks.set(file, Math.min(lowlinks.get(file), indices.get(target)));
      }
    }

    if (lowlinks.get(file) !== indices.get(file)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== file);

    const selfCycle = component.length === 1 && (adjacency.get(file) ?? new Set()).has(file);
    if (component.length > 1 || selfCycle) cycles.push(component.sort());
  }

  for (const file of files) {
    if (!indices.has(file)) connect(file);
  }
  return cycles.sort((left, right) => left[0].localeCompare(right[0]));
}

function findReachable(entry, adjacency) {
  const reachable = new Set();
  const pending = entry ? [entry] : [];
  while (pending.length) {
    const file = pending.pop();
    if (reachable.has(file)) continue;
    reachable.add(file);
    pending.push(...(adjacency.get(file) ?? []));
  }
  return reachable;
}

export function checkStructure({ repoRoot = REPO_ROOT, srcRoot = path.join(repoRoot, "src") } = {}) {
  const sourceFiles = iterSourceFiles(srcRoot);
  const sourceSet = new Set(sourceFiles);
  const errors = [];
  const graphEdges = [];
  const adjacency = new Map(sourceFiles.map((file) => [file, new Set()]));

  if (!sourceFiles.length) {
    errors.push(`No JavaScript source files found under ${repoRelative(repoRoot, srcRoot)}.`);
  }

  for (const sourcePath of sourceFiles) {
    const sourceRelative = repoRelative(repoRoot, sourcePath);
    const sourceArea = areaForPath(sourcePath, srcRoot);
    const allowedTargets = ALLOWED_TARGET_AREAS[sourceArea];
    if (!allowedTargets) {
      errors.push(
        `${sourceRelative}:1:1 belongs to unknown source area \`${sourceArea}\`. ` +
          "Add the area to the documented architecture and checker policy, or move the module into an existing area.",
      );
    }

    const parsed = parseModuleEdges(fs.readFileSync(sourcePath, "utf8"), sourceRelative);
    errors.push(...parsed.errors);

    for (const edge of parsed.edges) {
      const at = locationLabel(sourceRelative, edge.node);
      const specifier = edge.specifier;
      const classification = classifySpecifier(specifier);
      if (classification !== "relative") {
        const guidance = {
          bare: "Bare module specifiers are not supported by this browser-native ESM source tree.",
          url: "URL module specifiers are not part of the repository module graph.",
          "root-absolute": "Root-absolute module specifiers are deployment-dependent.",
          "query-or-fragment": "Query strings and fragments are not supported in source module specifiers.",
        }[classification];
        errors.push(`${at} ${edge.kind} uses unsupported specifier \`${specifier}\`. ${guidance}`);
        continue;
      }

      const targetPath = path.resolve(path.dirname(sourcePath), specifier);
      if (!isWithin(repoRoot, targetPath)) {
        errors.push(`${at} ${edge.kind} \`${specifier}\` escapes the repository root.`);
        continue;
      }
      if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
        errors.push(
          `${at} ${edge.kind} points to missing exact path \`${specifier}\`. ` +
            "Browser-native ESM imports must include the real filename; this checker does not infer extensions or index files.",
        );
        continue;
      }
      if (!isWithin(srcRoot, targetPath)) {
        errors.push(`${at} ${edge.kind} \`${specifier}\` resolves outside src/ to ${repoRelative(repoRoot, targetPath)}.`);
        continue;
      }
      if (!targetPath.endsWith(".js")) {
        errors.push(`${at} ${edge.kind} \`${specifier}\` does not resolve to a JavaScript module.`);
        continue;
      }
      if (!sourceSet.has(targetPath)) {
        errors.push(`${at} ${edge.kind} \`${specifier}\` resolves to an unscanned source module.`);
        continue;
      }

      const targetArea = areaForPath(targetPath, srcRoot);
      const targetRelative = repoRelative(repoRoot, targetPath);
      graphEdges.push({
        source: sourceRelative,
        target: targetRelative,
        specifier,
        kind: edge.kind,
        line: edge.node.loc.start.line,
        column: edge.node.loc.start.column + 1,
      });
      adjacency.get(sourcePath).add(targetPath);

      if (!ALLOWED_TARGET_AREAS[targetArea]) {
        errors.push(
          `${at} ${edge.kind} targets ${targetRelative} in unknown source area \`${targetArea}\`. ` +
            "Document and configure the area before importing it.",
        );
      } else if (allowedTargets && !allowedTargets.has(targetArea)) {
        errors.push(
          `${at} ${edge.kind} targets ${targetRelative}, crossing from \`${sourceArea}\` into \`${targetArea}\`. ` +
            "Move shared logic to an allowed layer or update docs/ARCHITECTURE.md and this checker together if the boundary changed intentionally.",
        );
      }

      if (targetArea === "debug" && !new Set(["core", "index", "debug"]).has(sourceArea)) {
        errors.push(
          `${at} ${edge.kind} targets debug-only code at ${targetRelative}. ` +
            "Route runtime inspection surfaces through src/core/game.js instead of depending on src/debug/ directly.",
        );
      }
    }
  }

  const entry = path.join(srcRoot, "index.js");
  if (sourceFiles.length && !sourceSet.has(entry)) {
    errors.push(`${repoRelative(repoRoot, entry)} is missing; the module graph has no browser bootstrap entry.`);
  }
  const reachable = findReachable(sourceSet.has(entry) ? entry : null, adjacency);
  const unreachable = sourceFiles.filter((file) => !reachable.has(file)).map((file) => repoRelative(repoRoot, file));
  const cycles = findCycles(sourceFiles, adjacency).map((component) =>
    component.map((file) => repoRelative(repoRoot, file)),
  );

  return {
    errors,
    files: sourceFiles.map((file) => repoRelative(repoRoot, file)),
    edges: graphEdges,
    unreachable,
    cycles,
  };
}

function printHumanReport(report) {
  if (report.errors.length) {
    console.error("Structural module graph checks failed:\n");
    for (const error of report.errors) console.error(`- ${error}`);
  } else {
    console.log("Structural module graph checks passed.");
  }
  console.log(
    `Module graph: ${report.files.length} modules, ${report.edges.length} edges, ` +
      `${report.unreachable.length} unreachable modules, ${report.cycles.length} cycles.`,
  );
  if (report.unreachable.length) {
    console.log(`Unreachable from src/index.js: ${report.unreachable.join(", ")}`);
  }
  for (const cycle of report.cycles) console.log(`Cycle component: ${cycle.join(", ")}`);
}

function main() {
  const report = checkStructure();
  if (process.argv.includes("--json")) console.log(JSON.stringify(report));
  else printHumanReport(report);
  process.exitCode = report.errors.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
