import { stageNebula } from "./stages/nebula.js";
import { stageCrystal } from "./stages/crystal.js";
import { stageAbyss } from "./stages/abyss.js";

export const stageDefinitions = [stageNebula, stageCrystal, stageAbyss];

const stageDefinitionMap = new Map(stageDefinitions.map((stage) => [stage.key, stage]));

export function getStageDefinition(key) {
  return stageDefinitionMap.get(key) ?? null;
}
