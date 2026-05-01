import { getPickupAttractionRadius } from "../../core/powerups.js";
import { collectPickup, collectScoreShard } from "../collisionInternals.js";

export function collectPickups({ state, player, audio, buckets }) {
  for (const pickupEntity of buckets.pickups) {
    if (pickupEntity.dead) continue;
    const pickupPos = pickupEntity.components.position;
    const pickupCol = pickupEntity.components.collider;
    const pickupComp = pickupEntity.components.pickup;
    if (!pickupPos || !pickupCol || !pickupComp) continue;

    const dx = player.x - pickupPos.x;
    const dy = player.y - pickupPos.y;
    if (dx * dx + dy * dy < (player.radius + pickupCol.r) ** 2) {
      collectPickup(state, player, audio, pickupEntity);
    }
  }
}

export function collectScoreShards({ state, player, buckets }) {
  const shardRadius = getPickupAttractionRadius(player);
  for (const shard of buckets.scoreShards) {
    if (shard.dead) continue;
    const pos = shard.components.position;
    const col = shard.components.collider;
    const shardComp = shard.components.scoreShard;
    if (!pos || !col || !shardComp) continue;

    const dx = player.x - pos.x;
    const dy = player.y - pos.y;
    if (dx * dx + dy * dy < Math.max((player.radius + col.r) ** 2, shardRadius ** 2 * 0.1)) {
      collectScoreShard(state, shard);
    }
  }
}

export function collectPickupsAndScoreShards(context) {
  collectPickups(context);
  collectScoreShards(context);
}
