import { clamp } from "../core/math.js";
import { spawnPlayerBullet } from "./bulletSystem.js";
import { sfxShoot } from "../audio/sfx.js";
import { fireWeapon } from "../data/weapons.js";

export function updatePlayer(state, player, audio, dt) {
  const input = state.input;
  const bounds = state.playfield;
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
    const weapon = fireWeapon(player.weaponMode, {
      state,
      focus,
      player,
      spawnBullet: (x, y, angle, speed, opts) => spawnPlayerBullet(state, x, y, angle, speed, opts),
    });
    sfxShoot(audio, { x: player.x });
    player.fireCooldown = weapon.cooldown(focus);
    player.weaponLabel = weapon.shortLabel;
  }

  if (player.invuln > 0) {
    player.invuln -= dt;
  }
}
