import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

async function reservePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  server.close();
  await once(server, "close");
  return port;
}

async function waitForServer(url) {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      return await fetch(url);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw lastError;
}

test("local server always returns current module bytes without caching", async (t) => {
  const port = await reservePort();
  const url = `http://127.0.0.1:${port}/src/data/powerups.js`;
  const server = spawn(
    "python3",
    ["scripts/serve_local.py", String(port), "--directory", "."],
    { cwd: REPO_ROOT, stdio: "ignore" }
  );

  t.after(async () => {
    if (server.exitCode === null) {
      server.kill("SIGTERM");
      await once(server, "exit");
    }
  });

  const initialResponse = await waitForServer(url);
  assert.equal(initialResponse.status, 200);
  assert.equal(initialResponse.headers.get("cache-control"), "no-store");
  assert.match(await initialResponse.text(), /export function listActiveEffectDefinitions/);

  const conditionalResponse = await fetch(url, {
    headers: {
      "If-Modified-Since": initialResponse.headers.get("last-modified"),
    },
  });
  assert.equal(conditionalResponse.status, 200);
  assert.equal(conditionalResponse.headers.get("cache-control"), "no-store");
  assert.match(await conditionalResponse.text(), /export function listActiveEffectDefinitions/);
});
