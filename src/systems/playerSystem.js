import { clamp } from "../core/math.js";
import { spawnPlayerBullet } from "./bulletSystem.js";
import { sfxShoot } from "../audio/sfx.js";
import { getPlayerBounds } from "../state/playerState.js";

export function updatePlayer(state, player, audio, dt) {
  const input = state.input;
  const bounds = getPlayerBounds(state.view.width, state.view.height);
  const focus = input.ShiftLeft || input.ShiftRight;
  const speed = focus ? player.focusSpeed : player.speed;
  const pointerEnabled = input.pointerEnabled !== false;
  const moveX =
    (input.ArrowRight || input.KeyD ? 1 : 0) -
    (input.ArrowLeft || input.KeyA ? 1 : 0);
  const moveY =
    (input.ArrowDown || input.KeyS ? 1 : 0) -
    (input.ArrowUp || input.KeyW ? 1 : 0);

  if (moveX !== 0 || moveY !== 0) {
    const length = Math.hypot(moveX, moveY) || 1;
    player.x += (moveX / length) * speed * dt;
    player.y += (moveY / length) * speed * dt;
    state.input.pointerX = player.x;
    state.input.pointerY = player.y;
  } else if (pointerEnabled) {
    const targetX = input.pointerX ?? player.x;
    const targetY = input.pointerY ?? player.y;
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0.001) {
      const step = Math.min(distance, speed * dt);
      player.x += (dx / distance) * step;
      player.y += (dy / distance) * step;
    }
  }

  player.x = clamp(player.x, bounds.minX, bounds.maxX);
  player.y = clamp(player.y, bounds.minY, bounds.maxY);

  player.fireCooldown -= dt;
  if ((input.KeyZ || input.Space || input.PointerFire) && player.fireCooldown <= 0 && !state.over) {
    const spread = focus ? 0.08 : 0.16;
    const count = focus ? 2 : 3;
    for (let i = 0; i < count; i++) {
      const ang = -Math.PI / 2 + (i - (count - 1) / 2) * spread;
      spawnPlayerBullet(state, player.x, player.y - 12, ang, 520);
    }
    if (state.time - audio.engine.lastShot > 0.07) {
      sfxShoot(audio);
      audio.engine.lastShot = state.time;
    }
    player.fireCooldown = focus ? 0.11 : 0.18;
  }

  if (player.invuln > 0) {
    player.invuln -= dt;
  }
}
