import { resolveBossHits } from "./collision/bossHits.js";
import { collectPickupsAndScoreShards } from "./collision/collections.js";
import { resolveEnemyHits } from "./collision/enemyHits.js";
import { resolvePlayerBurst, resolvePlayerHazards } from "./collision/playerHazards.js";

export function handleCollisions(
  state,
  player,
  audio,
  spawnParticle,
  advanceBossPhase,
  defeatBoss,
  spawnPickupEntity,
  spawnScoreShardEntities,
  buckets
) {
  const context = {
    state,
    player,
    audio,
    spawnParticle,
    advanceBossPhase,
    defeatBoss,
    spawnPickupEntity,
    spawnScoreShardEntities,
    buckets,
  };

  resolvePlayerBurst(context);
  resolveEnemyHits(context);
  resolveBossHits(context);
  collectPickupsAndScoreShards(context);
  resolvePlayerHazards(context);

  player.pendingBurst = false;
}
