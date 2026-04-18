import test from "node:test";
import assert from "node:assert/strict";

import {
  emitAimedBurst,
  emitRadial,
  emitSpiral,
  listPatternHelpers,
  resetCooldowns,
  runCooldown,
} from "../../../src/data/patterns.js";
import {
  getPowerupCategoryStyle,
  getPowerupDefinition,
  listPowerupKeys,
  listWeaponPickupKeys,
  powerupDefinitions,
} from "../../../src/data/powerups.js";
import { fireWeapon, getWeaponDefinition, listWeaponModes } from "../../../src/data/weapons.js";
import { gateRecurringWave, resolveOneShotWave } from "../../../src/data/stageRuntime.js";
import { createBossInstance, getBossDefinition, listBossShowcaseEntries } from "../../../src/data/bosses.js";
import { getEnemyArchetype, listEnemyShowcaseEntries } from "../../../src/data/enemies.js";
import { getStageDefinition, stageDefinitions } from "../../../src/data/stages.js";
import { makeContentContext } from "../../helpers/fixtures.mjs";

test("pattern helpers emit deterministic bullet layouts and cooldowns", () => {
  const radial = [];
  emitRadial((x, y, angle) => radial.push({ x, y, angle }), 10, 20, 4, 100, { offset: Math.PI / 4 });
  assert.equal(radial.length, 4);
  assert.equal(radial[0].angle, Math.PI / 4);

  const aimed = [];
  emitAimedBurst((x, y, angle) => aimed.push(angle), { x: 10, y: 10 }, 0, 0, 3, 0.4, 100);
  assert.equal(aimed.length, 3);
  assert.equal(aimed[0] < aimed[1] && aimed[1] < aimed[2], true);

  const spiral = [];
  emitSpiral((x, y, angle) => spiral.push(angle), 0, 0, 3, 100, 0.5, { offset: 0.2 });
  assert.deepEqual(spiral.map((value) => Number(value.toFixed(2))), [0.2, 0.7, 1.2]);

  const owner = { cooldowns: Object.create(null) };
  assert.equal(runCooldown(owner, "pulse", 1, 0.016, () => {}), true);
  assert.equal(runCooldown(owner, "pulse", 1, 0.016, () => {}), false);
  resetCooldowns(owner);
  assert.equal(Object.keys(owner.cooldowns).length, 0);
  assert.equal(listPatternHelpers().includes("runCooldown"), true);
});

test("powerup catalog exposes stable keys, categories, and weapon pickup coverage", () => {
  assert.equal(Array.isArray(listPowerupKeys()), true);
  assert.equal(listPowerupKeys().includes("halo-shield"), true);
  assert.equal(listWeaponPickupKeys().includes("beam"), true);
  assert.equal(getPowerupDefinition("spread").effect.weaponMode, "spread");
  assert.equal(getPowerupDefinition("missing"), null);
  assert.equal(getPowerupCategoryStyle("risk").sigil, "seal");
  assert.equal(getPowerupCategoryStyle("unknown").sigil, "hex");
  assert.equal(powerupDefinitions["burst-cell"].effect.type, "burst-cell");
});

test("weapon definitions and fire modes expose deterministic attack contracts", () => {
  const player = { x: 100, y: 200 };
  const state = { time: 1.25 };

  assert.equal(getWeaponDefinition("missing").key, "base");
  assert.equal(listWeaponModes().includes("orbitals"), true);

  const baseShots = [];
  const baseWeapon = fireWeapon("base", {
    spawnBullet: (...args) => baseShots.push(args),
    player,
    focus: false,
    state,
  });
  assert.equal(baseWeapon.key, "base");
  assert.equal(baseShots.length, 3);

  const focusedPierceShots = [];
  fireWeapon("pierce", {
    spawnBullet: (...args) => focusedPierceShots.push(args),
    player,
    focus: true,
    state,
  });
  assert.equal(focusedPierceShots.length, 3);
  assert.equal(focusedPierceShots[0][4].pierce, 3);

  const beamShots = [];
  fireWeapon("beam", {
    spawnBullet: (...args) => beamShots.push(args),
    player,
    focus: false,
    state,
  });
  assert.equal(beamShots.length, 5);
  assert.equal(beamShots[0][4].life, 1.5);

  const amplifierShots = [];
  fireWeapon("amplifier", {
    spawnBullet: (...args) => amplifierShots.push(args),
    player,
    focus: true,
    state,
  });
  assert.equal(amplifierShots[0][4].bodyDamageMultiplier, 0.6);
  assert.equal(amplifierShots[0][4].weakpointBrandDuration, 1.25);

  const orbitalShots = [];
  fireWeapon("orbitals", {
    spawnBullet: (...args) => orbitalShots.push(args),
    player,
    focus: false,
    state,
  });
  assert.equal(orbitalShots.length, 6, "Orbitals should emit the base volley plus three orbital shots.");
});

test("stage runtime helpers encode defer, full, and anchor fallback behavior", () => {
  const stageState = { nextWave: 0 };
  const fullGate = gateRecurringWave(stageState, "nextWave", 1, {
    director: {
      gateWave() {
        return { allow: true, delay: 0, bulletScale: 1, escortScale: 1, anchorOnly: false };
      },
    },
  }, { enemyCost: 1 });
  assert.equal(fullGate.allow, true);

  const deferred = gateRecurringWave(stageState, "nextWave", 1, {
    director: {
      gateWave() {
        return { allow: false, delay: 0.5, bulletScale: 0.7, escortScale: 0, anchorOnly: false };
      },
    },
  }, { enemyCost: 1 });
  assert.equal(deferred, null);
  assert.equal(stageState.nextWave, 1.5);

  assert.deepEqual(
    resolveOneShotWave({
      director: {
        gateWave() {
          return { allow: false, delay: 0.5, bulletScale: 0.72, escortScale: 0, anchorOnly: true };
        },
      },
    }, { enemyCost: 3 }),
    {
      mode: "anchor",
      gate: { allow: false, delay: 0.5, bulletScale: 0.72, escortScale: 0, anchorOnly: true },
    }
  );
});

test("content registries expose keyed lookups, showcase listings, and boss instantiation", () => {
  assert.equal(stageDefinitions.length >= 3, true);
  assert.equal(getStageDefinition("nebula-gate").name, "Nebula Gate");
  assert.equal(getEnemyArchetype("cherub").renderKey, "cherub");
  assert.equal(getBossDefinition("seraph").renderKey, "seraph");
  assert.equal(listEnemyShowcaseEntries().some((entry) => entry.key === "throne"), true);
  assert.equal(listBossShowcaseEntries().some((entry) => entry.key === "cathedral"), true);

  const ctx = makeContentContext();
  const boss = createBossInstance("seraph", ctx);
  assert.equal(boss.phaseIndex, 0);
  assert.equal(boss.phaseHp, boss.phases[0].hp);
  assert.equal(typeof boss.cooldowns, "object");
  assert.throws(() => createBossInstance("missing", ctx), /Unknown boss definition/);
});
