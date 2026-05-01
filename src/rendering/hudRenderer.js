import { combatTuning, getChainMultiplier } from "../core/combat.js";
import { drawGlowCircle } from "./drawHelpers.js";

const effectSigils = [
  {
    key: "haloShield",
    color: "#bdfdff",
    duration: 12,
    sides: 6,
  },
  {
    key: "chainSigil",
    color: "#ffb356",
    duration: 10,
    sides: 4,
  },
  {
    key: "grazeBloom",
    color: "#ff9fda",
    duration: 10,
    sides: 8,
  },
  {
    key: "magnetCore",
    color: "#8fe8ff",
    duration: 10,
    sides: 6,
  },
  {
    key: "pointBlankSeal",
    color: "#ff8f8f",
    duration: 10,
    sides: 3,
  },
];

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function drawPolygon(ctx, radius, sides, rotation = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (Math.PI * 2 * i) / sides;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawTimedSigil(ctx, x, y, effect, state) {
  const ratio = clamp01(effect.timer / effect.duration);
  const pulse = 1 + Math.sin(state.time * 7 + effect.index) * 0.05;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(state.time * 0.6 + effect.index * 0.4);
  drawGlowCircle(ctx, 0, 0, 14, `${effect.color}44`, 0.16);
  ctx.strokeStyle = `${effect.color}cc`;
  ctx.fillStyle = `${effect.color}1f`;
  ctx.lineWidth = 1.4;
  drawPolygon(ctx, 8 * pulse, effect.sides);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = `${effect.color}e6`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
  ctx.stroke();
  ctx.restore();
}

function getActiveEffectSigils(player) {
  const effects = [];
  if (player.weaponMode !== "base" && player.weaponTimer > 0) {
    effects.push({
      key: "weapon",
      color: player.weaponMode === "amplifier" ? "#ffd58e" : "#9efbff",
      duration: 10,
      timer: player.weaponTimer,
      sides: 4,
    });
  }
  for (const definition of effectSigils) {
    const timer = player.activePowerups[definition.key] || 0;
    if (timer > 0) {
      effects.push({ ...definition, timer });
    }
  }
  return effects
    .sort((a, b) => b.timer - a.timer)
    .slice(0, 6)
    .map((effect, index) => ({ ...effect, index }));
}

function drawActiveEffectSigils(ctx, player, state) {
  const effects = getActiveEffectSigils(player);
  if (effects.length === 0 || state.over) return;
  const spread = effects.length === 1 ? 0 : Math.min(1.35, 0.38 * (effects.length - 1));
  const start = -spread * 0.5;
  const step = effects.length === 1 ? 0 : spread / (effects.length - 1);
  const radius = 48;
  for (let i = 0; i < effects.length; i++) {
    const angle = start + step * i;
    drawTimedSigil(
      ctx,
      player.x + Math.cos(angle) * radius,
      player.y + Math.sin(angle) * radius,
      effects[i],
      state
    );
  }
}

function drawGrazeChargeCue(ctx, player, state) {
  const ratio = clamp01(state.grazeCharge / combatTuning.maxGrazeCharge);
  const ready = ratio >= 1 || state.burstStocks >= combatTuning.maxBurstStocks;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.strokeStyle = ready ? "rgba(255, 213, 142, 0.88)" : "rgba(255, 213, 142, 0.42)";
  ctx.lineWidth = ready ? 2.4 : 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius + 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
  ctx.stroke();
  if (ready) {
    drawGlowCircle(ctx, 0, 0, 42, "rgba(255, 213, 142, 0.22)", 0.12);
  }
  ctx.restore();
}

function drawBurstPips(ctx, player, state) {
  if (state.over) return;
  const spacing = 12;
  const originX = player.x - ((combatTuning.maxBurstStocks - 1) * spacing) / 2;
  const y = player.y + 31;
  ctx.save();
  for (let i = 0; i < combatTuning.maxBurstStocks; i++) {
    const full = i < state.burstStocks;
    const x = originX + i * spacing;
    drawGlowCircle(ctx, x, y, full ? 10 : 6, full ? "rgba(121, 255, 225, 0.48)" : "rgba(255,255,255,0.12)", 0.12);
    ctx.fillStyle = full ? "#79ffe1" : "rgba(255,255,255,0.12)";
    ctx.strokeStyle = full ? "rgba(247,255,255,0.78)" : "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, full ? 4.6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawChainCue(ctx, player, state) {
  if (state.over || state.chainLevel <= 0 || state.chainTimer <= 0) return;
  const alpha = clamp01(state.chainTimer / 2.25);
  ctx.save();
  ctx.globalAlpha = 0.35 + alpha * 0.45;
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd58e";
  ctx.font = "700 12px 'Avenir Next', 'Trebuchet MS', sans-serif";
  ctx.fillText(`x${getChainMultiplier(state.chainLevel).toFixed(2)}`, player.x, player.y + 48);
  ctx.restore();
}

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
    drawGrazeChargeCue(ctx, player, state);
    drawBurstPips(ctx, player, state);
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

  drawActiveEffectSigils(ctx, player, state);
  drawChainCue(ctx, player, state);

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
