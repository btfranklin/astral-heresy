import { sfxBossPhase } from "../audio/sfx.js";
import { removeEntity } from "../entities/entityFactory.js";
import { createBossInstance } from "../data/bosses.js";

export function updateStage(state, stages, contentContext, audio, dt) {
  if (state.over) return;

  const stage = stages[state.stageIndex];
  if (!stage) return;

  if (!state.stageState) {
    state.stageState = stage.init();
    state.stageTime = 0;
  }

  if (!state.boss) {
    state.stageTime += dt;
    stage.update(state.stageState, state.stageTime, dt, contentContext);
    if (state.stageTime >= stage.duration) {
      state.boss = createBossInstance(stage.bossKey, contentContext);
      for (const entity of state.entities) {
        if (
          entity.type === "enemy" ||
          entity.type === "enemyBullet" ||
          entity.type === "playerBullet" ||
          entity.type === "pickup" ||
          entity.type === "scoreShard"
        ) {
          removeEntity(entity);
        }
      }
      state.pulse = 1;
      state.shake = 12;
      sfxBossPhase(audio);
    }
  }
}
