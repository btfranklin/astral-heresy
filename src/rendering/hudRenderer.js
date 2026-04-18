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
  if (boss.weakpointBrandTimer > 0) {
    ctx.strokeStyle = `rgba(255, 213, 142, ${0.55 + boss.weakpointBrandTimer * 0.22})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(weakpoint.x, weakpoint.y, weakpoint.radius * (1.3 + Math.sin(state.time * 14) * 0.08), 0, Math.PI * 2);
    ctx.stroke();
  }
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

  if (player.activePowerups.haloShield > 0 && !state.over) {
    ctx.save();
    ctx.translate(player.x, player.y);
    const pulse = 0.9 + Math.sin(state.time * 7.8) * 0.08;
    drawGlowCircle(ctx, 0, 0, 34, "rgba(189, 253, 255, 0.4)", 0.22);
    ctx.strokeStyle = "rgba(221, 252, 255, 0.86)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, 24 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 30 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (state.feedback.shield > 0 && state.shieldOrigin) {
    ctx.save();
    const alpha = state.feedback.shield;
    ctx.translate(state.shieldOrigin.x, state.shieldOrigin.y);
    ctx.strokeStyle = `rgba(221, 252, 255, ${alpha})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const angle = state.time * 3 + (i * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 12, Math.sin(angle) * 12);
      ctx.lineTo(Math.cos(angle) * (22 + alpha * 12), Math.sin(angle) * (22 + alpha * 12));
      ctx.stroke();
    }
    ctx.restore();
  }

  if (player.activePowerups.chainSigil > 0 && !state.over) {
    ctx.save();
    ctx.translate(player.x, player.y + 18);
    ctx.strokeStyle = `rgba(255, 213, 142, ${0.32 + player.activePowerups.chainSigil * 0.03})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(-16, 2);
    ctx.lineTo(0, -14);
    ctx.lineTo(16, 2);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  if (player.activePowerups.grazeBloom > 0 && !state.over) {
    ctx.save();
    ctx.translate(player.x, player.y);
    drawGlowCircle(ctx, 0, 0, 38, "rgba(255, 159, 218, 0.22)", 0.18);
    ctx.strokeStyle = "rgba(255, 196, 232, 0.55)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const angle = state.time * 2 + i * (Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(Math.cos(angle) * 12, Math.sin(angle) * 12, 7, 12, angle, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (player.activePowerups.magnetCore > 0 && !state.over) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.strokeStyle = "rgba(143, 232, 255, 0.46)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 46 + Math.sin(state.time * 4.8) * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (player.activePowerups.pointBlankSeal > 0 && !state.over) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.strokeStyle = "rgba(255, 180, 110, 0.62)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 28 + Math.sin(state.time * 9) * 1.2, 0, Math.PI * 2);
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

  if (state.powerupNotice?.ribbonTimer > 0 && !state.over) {
    const notice = state.powerupNotice;
    const alpha = Math.min(1, notice.ribbonTimer / 0.55);
    ctx.save();
    ctx.strokeStyle = `${notice.color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(notice.x, notice.y);
    ctx.lineTo(player.x, player.y - 18);
    ctx.stroke();
    ctx.restore();
  }

  if (state.powerupNotice?.timer > 0 && !state.over) {
    const notice = state.powerupNotice;
    const alpha = Math.min(1, notice.timer / 0.9);
    const lift = (1 - alpha) * 18;
    const x = player.x;
    const y = player.y - 58 - lift;
    ctx.save();
    ctx.textAlign = "center";
    ctx.globalAlpha = alpha;
    drawGlowCircle(ctx, x, y - 8, 90, `${notice.color}33`, 0.18);
    ctx.strokeStyle = notice.color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 26 + (1 - alpha) * 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#f7ffff";
    ctx.font = "700 22px 'Avenir Next', 'Trebuchet MS', sans-serif";
    ctx.fillText(notice.title.toUpperCase(), x, y);
    ctx.fillStyle = notice.color;
    ctx.font = "12px 'Avenir Next', 'Trebuchet MS', sans-serif";
    ctx.fillText(notice.roleTag, x, y + 18);
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
