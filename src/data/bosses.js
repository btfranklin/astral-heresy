import { resetCooldowns } from "./patterns.js";
import { bossDefinitionSeraph } from "./bosses/seraph.js";
import { bossDefinitionPrism } from "./bosses/prism.js";
import { bossDefinitionCathedral } from "./bosses/cathedral.js";

export const bossDefinitions = [
  bossDefinitionSeraph,
  bossDefinitionPrism,
  bossDefinitionCathedral,
];

const bossDefinitionMap = new Map(bossDefinitions.map((definition) => [definition.key, definition]));

export function getBossDefinition(key) {
  return bossDefinitionMap.get(key) ?? null;
}

export function listBossShowcaseEntries() {
  return bossDefinitions.map(({ key, showcaseLabel }) => ({
    key,
    label: showcaseLabel,
  }));
}

export function createBossInstance(key, ctx) {
  const definition = getBossDefinition(key);
  if (!definition) {
    throw new Error(`Unknown boss definition: ${key}`);
  }

  const boss = {
    key: definition.key,
    name: definition.name,
    showcaseLabel: definition.showcaseLabel,
    renderKey: definition.renderKey,
    x: ctx.view.width * 0.5,
    y: definition.spawnY,
    r: definition.r,
    hp: definition.hp,
    maxHp: definition.hp,
    phaseIndex: 0,
    phaseTime: 0,
    phaseHp: definition.phases[0].hp,
    pulseCooldown: 0,
    phases: definition.phases,
    cooldowns: Object.create(null),
  };

  resetCooldowns(boss);
  return boss;
}
