import { combatTuning } from "../core/combat.js";
import { drawGlowCircle } from "./drawHelpers.js";

export function drawBossUI(ctx, boss, state) {
  const phase = boss.phases[boss.phaseIndex];
  const barWidth = Math.min(460, state.view.width * 0.42);
  const barX = state.view.width * 0.5 - barWidth * 0.5;
  const barY = 26;

  ctx.save();
  drawGlowCircle(ctx, state.view.width * 0.5, barY + 10, barWidth * 0.7, "rgba(255,143,216,0.16)", 0.28);
  ctx.fillStyle = "rgba(8, 11, 24, 0.72)";
  ctx.fillRect(barX - 10, barY - 10, barWidth + 20, 34);
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.strokeRect(barX - 10, barY - 10, barWidth + 20, 34);

  const gradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
  gradient.addColorStop(0, "#ff8fd8");
  gradient.addColorStop(0.52, "#ffd58e");
  gradient.addColorStop(1, "#79ffe1");
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fillRect(barX, barY, barWidth, 10);
  ctx.fillStyle = gradient;
  ctx.fillRect(barX, barY, barWidth * (boss.hp / boss.maxHp), 10);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  for (let i = 1; i < 8; i++) {
    const x = barX + (barWidth * i) / 8;
    ctx.beginPath();
    ctx.moveTo(x, barY);
    ctx.lineTo(x, barY + 10);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
  ctx.textAlign = "center";
  ctx.font = "12px 'Avenir Next', 'Trebuchet MS', sans-serif";
  ctx.fillText(phase ? phase.name.toUpperCase() : "FINAL FORM", state.view.width * 0.5, barY - 4);
  ctx.font = "16px Baskerville, 'Palatino Linotype', serif";
  ctx.fillText(boss.name, state.view.width * 0.5, barY + 32);
  ctx.restore();
}

export function drawBossWeakpoint(ctx, boss, state) {
  if (!boss.weakpoint) return;
  const weakpoint = boss.weakpoint;
  const pulse = 0.75 + Math.sin(state.time * 10) * 0.18;

  ctx.save();
  drawGlowCircle(ctx, weakpoint.x, weakpoint.y, weakpoint.radius * 3, "rgba(255, 245, 214, 0.35)", 0.3);
  ctx.strokeStyle = weakpoint.color;
  ctx.lineWidth = 2.2;
  ctx.globalAlpha = 0.75 + state.feedback.weakpoint * 0.5;
  ctx.beginPath();
  ctx.arc(weakpoint.x, weakpoint.y, weakpoint.radius * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(weakpoint.x - weakpoint.radius * 1.6, weakpoint.y);
  ctx.lineTo(weakpoint.x - weakpoint.radius * 0.7, weakpoint.y);
  ctx.moveTo(weakpoint.x + weakpoint.radius * 0.7, weakpoint.y);
  ctx.lineTo(weakpoint.x + weakpoint.radius * 1.6, weakpoint.y);
  ctx.moveTo(weakpoint.x, weakpoint.y - weakpoint.radius * 1.6);
  ctx.lineTo(weakpoint.x, weakpoint.y - weakpoint.radius * 0.7);
  ctx.moveTo(weakpoint.x, weakpoint.y + weakpoint.radius * 0.7);
  ctx.lineTo(weakpoint.x, weakpoint.y + weakpoint.radius * 1.6);
  ctx.stroke();
  ctx.restore();
}

export function drawPlayerUI(ctx, player, state, stages) {
  ctx.save();
  ctx.strokeStyle = "rgba(180, 236, 255, 0.18)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(24, state.view.height - 56);
  ctx.lineTo(100, state.view.height - 56);
  ctx.lineTo(120, state.view.height - 36);
  ctx.moveTo(state.view.width - 24, state.view.height - 56);
  ctx.lineTo(state.view.width - 100, state.view.height - 56);
  ctx.lineTo(state.view.width - 120, state.view.height - 36);
  ctx.stroke();
  ctx.restore();

  if (!state.over) {
    ctx.save();
    ctx.translate(player.x, player.y);
    const grazeAlpha = 0.16 + state.feedback.graze * 0.4;
    ctx.strokeStyle = `rgba(255, 213, 142, ${grazeAlpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + combatTuning.grazeOuterOffset, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(121, 255, 225, 0.2)";
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + combatTuning.grazeInnerOffset, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if ((state.input.ShiftLeft || state.input.ShiftRight) && !state.over) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.strokeStyle = "rgba(121,255,225,0.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.moveTo(-26, 0);
    ctx.lineTo(-12, 0);
    ctx.moveTo(26, 0);
    ctx.lineTo(12, 0);
    ctx.moveTo(0, -26);
    ctx.lineTo(0, -12);
    ctx.moveTo(0, 26);
    ctx.lineTo(0, 12);
    ctx.stroke();
    ctx.restore();
  }

  if (state.feedback.burst > 0 && state.burstOrigin) {
    ctx.save();
    const progress = 1 - Math.min(1, state.feedback.burst / 0.65);
    const radius = 24 + combatTuning.burstRadius * progress;
    ctx.strokeStyle = `rgba(158, 251, 255, ${0.38 * (1 - progress)})`;
    ctx.lineWidth = 4 - progress * 2;
    ctx.beginPath();
    ctx.arc(state.burstOrigin.x, state.burstOrigin.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
