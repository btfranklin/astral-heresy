import test from "node:test";
import assert from "node:assert/strict";

import { getRandomSeed } from "../../../src/debug/randomSeed.js";

test("seed URLs accept decimal integer bounds and coexist with render-study controls", () => {
  for (const seed of [0, 1, 42, 4294967295]) {
    assert.equal(getRandomSeed(`?seed=${seed}`), seed);
  }
  assert.equal(getRandomSeed("?mode=render&enemy=cherub&seed=42"), 42);
  assert.equal(getRandomSeed("?seed=00042"), 42);
});

test("missing, empty, malformed, and out-of-range URL seeds use normal randomness", () => {
  for (const search of [
    "", "?mode=render", "?seed", "?seed=", "?seed=noise", "?seed=-1",
    "?seed=1.5", "?seed=1e2", "?seed=Infinity", "?seed=0x20",
    "?seed=4294967296", "?seed=9999999999999999999999", "?seed=%20",
  ]) {
    assert.equal(getRandomSeed(search), null, search);
  }
});
