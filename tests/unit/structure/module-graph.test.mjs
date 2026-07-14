import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { checkStructure, parseModuleEdges } from "../../../scripts/check_structure.mjs";

function createRepo(files) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "astral-heresy-structure-"));
  for (const [relativePath, contents] of Object.entries(files)) {
    const target = path.join(repoRoot, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  }
  return repoRoot;
}

function withRepo(files, callback) {
  const repoRoot = createRepo(files);
  try {
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test("parser extracts every supported module edge without matching comments or strings", () => {
  const source = `
    import "./side-effect.js";
    import {
      value
    } from "./multiline.js";
    export { other } from "./named.js";
    export * from "./all.js";
    const lazy = import("./lazy.js");
    // import fake from "./comment.js";
    const text = 'export * from "./string.js"';
  `;

  const result = parseModuleEdges(source, "src/index.js");

  assert.deepEqual(
    result.edges.map(({ specifier, kind }) => ({ specifier, kind })),
    [
      { specifier: "./side-effect.js", kind: "import" },
      { specifier: "./multiline.js", kind: "import" },
      { specifier: "./named.js", kind: "re-export" },
      { specifier: "./all.js", kind: "re-export" },
      { specifier: "./lazy.js", kind: "dynamic import" },
    ],
  );
  assert.deepEqual(result.errors, []);
});

test("computed dynamic imports and syntax errors produce location-aware diagnostics", () => {
  const dynamic = parseModuleEdges("const moduleName = './x.js'; import(moduleName);", "src/index.js");
  assert.match(dynamic.errors[0], /^src\/index\.js:1:\d+ uses a computed dynamic import/);

  const invalid = parseModuleEdges("import {", "src/index.js");
  assert.match(invalid.errors[0], /^src\/index\.js:1:\d+ cannot be parsed as an ECMAScript module/);
});

test("exact resolution does not infer a JavaScript extension", () =>
  withRepo(
    {
      "src/index.js": 'import "./core/game";\n',
      "src/core/game.js": "export const game = true;\n",
    },
    (repoRoot) => {
      const report = checkStructure({ repoRoot });
      assert.equal(report.edges.length, 0);
      assert.ok(report.errors.some((error) => error.includes("missing exact path `./core/game`")));
    },
  ));

test("area policy is applied to multiline imports that the old regex missed", () =>
  withRepo(
    {
      "src/index.js": 'import "./core/game.js";\n',
      "src/core/game.js": 'import "../state/store.js";\n',
      "src/state/store.js": `import {
        renderFrame
      } from "../rendering/frame.js";
      export const store = {};
      `,
      "src/rendering/frame.js": "export function renderFrame() {}\n",
    },
    (repoRoot) => {
      const report = checkStructure({ repoRoot });
      assert.ok(
        report.errors.some(
          (error) => error.includes("src/state/store.js:1:1") && error.includes("crossing from `state` into `rendering`"),
        ),
      );
    },
  ));

test("unsupported and out-of-scope specifiers receive specific diagnostics", () =>
  withRepo(
    {
      "outside.js": "export const outside = true;\n",
      "src/index.js": `
        import "acorn";
        import "https://example.com/module.js";
        import "/root/module.js";
        import "./core/game.js?raw";
        import "../outside.js";
        import "../../escaped.js";
      `,
      "src/core/game.js": "export const game = true;\n",
    },
    (repoRoot) => {
      const errors = checkStructure({ repoRoot }).errors.join("\n");
      assert.match(errors, /Bare module specifiers/);
      assert.match(errors, /URL module specifiers/);
      assert.match(errors, /Root-absolute module specifiers/);
      assert.match(errors, /Query strings and fragments/);
      assert.match(errors, /resolves outside src\/ to outside\.js/);
      assert.match(errors, /escapes the repository root/);
    },
  ));

test("unknown source areas are diagnosed as sources and targets", () =>
  withRepo(
    {
      "src/index.js": 'import "./core/game.js";\n',
      "src/core/game.js": 'import "../experimental/feature.js";\n',
      "src/experimental/feature.js": "export const feature = true;\n",
    },
    (repoRoot) => {
      const errors = checkStructure({ repoRoot }).errors.join("\n");
      assert.match(errors, /src\/experimental\/feature\.js:1:1 belongs to unknown source area `experimental`/);
      assert.match(errors, /targets src\/experimental\/feature\.js in unknown source area `experimental`/);
    },
  ));

test("cycles and entrypoint reachability are reported without becoming failures", () =>
  withRepo(
    {
      "src/index.js": 'import "./core/entry.js";\n',
      "src/core/entry.js": "export const entry = true;\n",
      "src/core/a.js": 'import "./b.js";\n',
      "src/core/b.js": 'import "./a.js";\n',
    },
    (repoRoot) => {
      const report = checkStructure({ repoRoot });
      assert.deepEqual(report.errors, []);
      assert.deepEqual(report.unreachable, ["src/core/a.js", "src/core/b.js"]);
      assert.deepEqual(report.cycles, [["src/core/a.js", "src/core/b.js"]]);
    },
  ));
