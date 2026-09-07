import { TAU } from "../core/math.js";
import { drawGlowCircle, getUnitCirclePoints } from "./drawHelpers.js";

function drawRing(ctx, radius, color, lineWidth = 2, alpha = 0.8) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawRuneOrbit(ctx, radius, count, color, rotation = 0, pulse = 0, resources) {
  ctx.save();
  ctx.rotate(rotation);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, radius * 0.018);
  ctx.lineCap = "round";
  const points = getUnitCirclePoints(count, resources);
  const dotRadius = radius * 0.035;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const cos = points[i * 2];
    const sin = points[i * 2 + 1];
    const inner = radius * (0.82 + (i % 2) * 0.05);
    const outer = radius * (1 + pulse * Math.sin(rotation * 2 + i));
    ctx.moveTo(cos * inner, sin * inner);
    ctx.lineTo(cos * outer, sin * outer);
  }
  ctx.stroke();

  ctx.beginPath();
  for (let i = 0; i < count; i += 2) {
    const cos = points[i * 2];
    const sin = points[i * 2 + 1];
    ctx.moveTo(cos * radius + dotRadius, sin * radius);
    ctx.arc(cos * radius, sin * radius, dotRadius, 0, TAU);
  }
  if (count > 0) {
    ctx.fill();
  }
  ctx.restore();
}

function drawPhaseCrown(ctx, radius, phase, color, rotation = 0, resources) {
  const count = 6 + phase * 2;
  ctx.save();
  ctx.rotate(rotation);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, radius * 0.025);
  const points = getUnitCirclePoints(count, resources);
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const cos = points[i * 2];
    const sin = points[i * 2 + 1];
    const inner = radius * 0.8;
    const outer = radius * (1.02 + (i % 2) * 0.12);
    const tipX = radius * 0.07;
    const tipY = radius * 0.94;
    ctx.moveTo(sin * inner, -cos * inner);
    ctx.lineTo(sin * outer, -cos * outer);
    ctx.lineTo(cos * tipX + sin * tipY, sin * tipX - cos * tipY);
  }
  ctx.stroke();
  ctx.restore();
}

function drawEyeCore(ctx, radius, iris, glow, resources) {
  drawGlowCircle(ctx, 0, 0, radius * 1.9, glow, 0.28, resources);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, radius * 0.66, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = Math.max(1.5, radius * 0.08);
  ctx.stroke();
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.34, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(10, 10, 18, 0.88)";
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.12, radius * 0.38, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.beginPath();
  ctx.arc(-radius * 0.16, -radius * 0.18, radius * 0.08, 0, TAU);
  ctx.fill();
}

function drawWing(ctx, radius, side, angle, spread, color) {
  ctx.save();
  ctx.scale(side, 1);
  ctx.rotate(angle);
  ctx.fillStyle = "rgba(24,25,58,0.94)";
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.2, radius * 0.025);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const offset = (i - 1.5) * spread;
    const length = radius * (1 - i * 0.09);
    ctx.moveTo(radius * 0.1, offset * 0.28);
    ctx.quadraticCurveTo(length * 0.48, offset - radius * 0.2, length, offset);
    ctx.quadraticCurveTo(length * 0.52, offset + radius * 0.24, radius * 0.1, offset * 0.28);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = Math.max(1, radius * 0.012);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const offset = (i - 1.5) * spread;
    const length = radius * (1 - i * 0.09);
    ctx.moveTo(radius * 0.16, offset * 0.25);
    ctx.quadraticCurveTo(length * 0.56, offset - radius * 0.08, length * 0.9, offset);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSmallEye(ctx, x, y, radius, color) {
  ctx.fillStyle = "rgba(245,252,255,0.92)";
  ctx.beginPath();
  ctx.ellipse(x, y, radius, radius * 0.58, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.34, 0, TAU);
  ctx.fill();
}

function getBossAttackCharge(boss) {
  const values = Object.values(boss.cooldowns || {}).filter(Number.isFinite);
  if (values.length === 0) return 0;
  return Math.max(0, Math.min(1, (0.38 - Math.min(...values)) / 0.38));
}

export function drawBossSeraph(ctx, state, boss, resources) {
  ctx.save();
  ctx.translate(boss.x, boss.y);
  const time = state.time * 1.4;
  const phase = Math.max(1, (boss.phaseIndex || 0) + 1);
  const pulse = 1 + Math.sin(time * 2.2) * 0.035;

  drawGlowCircle(
    ctx,
    0,
    0,
    boss.r * (2.2 + phase * 0.12),
    "rgba(120, 255, 220, 0.62)",
    0.5,
    resources
  );
  drawGlowCircle(ctx, 0, 0, boss.r * 1.45, "rgba(255, 176, 232, 0.18)", 0.5, resources);

  drawPhaseCrown(
    ctx,
    boss.r * 1.34,
    phase,
    "rgba(255,214,241,0.46)",
    -time * 0.13,
    resources
  );
  drawRuneOrbit(
    ctx,
    boss.r * 1.42,
    10 + phase * 2,
    "rgba(159,255,235,0.5)",
    time * 0.16,
    0.05,
    resources
  );

  const opening = phase === 1 ? 0.34 : phase === 2 ? 0.7 : 1.02;
  const wingAngles = [-opening, 0, opening];
  const wingColors = [
    "rgba(255,191,236,0.6)",
    "rgba(225,248,255,0.82)",
    "rgba(152,255,231,0.62)",
  ];
  ctx.save();
  ctx.translate(0, -boss.r * 0.12);
  ctx.scale(pulse, pulse);
  for (let pair = 0; pair < 3; pair++) {
    const beat = Math.sin(time * (0.72 + pair * 0.11) + pair) * 0.06;
    const sharpness = phase === 3 ? 0.34 : 0.22;
    const rootY = (pair - 1) * boss.r * (phase === 1 ? 0.07 : 0.18);
    ctx.save();
    ctx.translate(0, rootY);
    drawWing(ctx, boss.r * (1.12 + pair * 0.13), -1, wingAngles[pair] - beat, boss.r * sharpness, wingColors[pair]);
    drawWing(ctx, boss.r * (1.12 + pair * 0.13), 1, wingAngles[pair] - beat, boss.r * sharpness, wingColors[pair]);
    ctx.restore();
  }
  ctx.restore();

  if (phase >= 2) {
    const eyeRadius = boss.r * (phase === 3 ? 0.105 : 0.085);
    for (let side = -1; side <= 1; side += 2) {
      drawSmallEye(ctx, side * boss.r * 0.82, -boss.r * 0.18, eyeRadius, "#ff76cc");
      if (phase === 3) drawSmallEye(ctx, side * boss.r * 0.55, -boss.r * 0.72, eyeRadius * 0.8, "#75ffe1");
    }
  }

  ctx.save();
  ctx.translate(0, -boss.r * 0.98);
  ctx.scale(1.1, 0.36);
  drawRing(ctx, boss.r * 0.62, "rgba(255, 236, 205, 0.92)", 3, 0.88);
  ctx.restore();

  ctx.save();
  ctx.rotate(time * 0.22);
  ctx.strokeStyle = "rgba(255,255,255,0.34)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const rayPoints = getUnitCirclePoints(8, resources);
  for (let i = 0; i < 8; i++) {
    const cos = rayPoints[i * 2];
    const sin = rayPoints[i * 2 + 1];
    ctx.moveTo(cos * boss.r * 0.46, sin * boss.r * 0.46);
    ctx.lineTo(cos * boss.r * 1.1, sin * boss.r * 1.1);
  }
  ctx.stroke();
  ctx.restore();

  const core = ctx.createLinearGradient(0, -boss.r, 0, boss.r);
  core.addColorStop(0, "rgba(255,255,255,0.95)");
  core.addColorStop(0.5, "rgba(170,255,240,0.82)");
  core.addColorStop(1, "rgba(84,138,255,0.38)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.moveTo(0, -boss.r * 0.92);
  ctx.quadraticCurveTo(boss.r * 0.72, -boss.r * 0.18, boss.r * 0.32, boss.r * 0.84);
  ctx.quadraticCurveTo(0, boss.r * 1.06, -boss.r * 0.32, boss.r * 0.84);
  ctx.quadraticCurveTo(-boss.r * 0.72, -boss.r * 0.18, 0, -boss.r * 0.92);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.68)";
  ctx.lineWidth = 2;
  ctx.stroke();

  drawRing(ctx, boss.r * 0.7, "rgba(255,255,255,0.42)", 2, 0.7);
  drawEyeCore(ctx, boss.r * 0.4, "#ff97dd", "rgba(120,255,220,0.25)", resources);

  ctx.restore();
}

export function drawBossPrism(ctx, state, boss, resources) {
  ctx.save();
  ctx.translate(boss.x, boss.y);
  const time = state.time * 1.2;
  const phase = Math.max(1, (boss.phaseIndex || 0) + 1);
  const attackCharge = getBossAttackCharge(boss);
  const phaseOpen = Math.min(1, Math.max(0, (boss.phaseTime || 0) / 0.6));
  const phaseEase = phaseOpen * phaseOpen * (3 - 2 * phaseOpen);

  drawGlowCircle(
    ctx,
    0,
    0,
    boss.r * (2.1 + phase * 0.1),
    "rgba(130, 210, 255, 0.64)",
    0.48,
    resources
  );
  drawGlowCircle(ctx, 0, 0, boss.r * 1.2, "rgba(255, 153, 245, 0.14)", 0.5, resources);

  drawPhaseCrown(
    ctx,
    boss.r * 1.46,
    phase,
    "rgba(216,185,255,0.48)",
    time * 0.11,
    resources
  );
  drawRuneOrbit(
    ctx,
    boss.r * 1.34,
    8 + phase * 2,
    "rgba(158,251,255,0.56)",
    -time * 0.2,
    0.06,
    resources
  );

  const segmentCount = 8 + phase * 2;
  const separation = (0.84 + phaseEase * 0.16) * (1 - attackCharge * 0.16);
  ctx.save();
  ctx.rotate(time * 0.14 + Math.sin(time * 0.23) * 0.1);
  for (let i = segmentCount - 1; i >= 0; i--) {
    const angle = (i / segmentCount) * TAU;
    // Opposite crystals share size and radius, so motion stays centered on the core.
    const wave = phase === 3 ? Math.sin(angle * 2 + time * 0.6) * 0.12 * phaseEase : 0;
    const radiusX = (phase === 2 ? 1.36 : 1.2) + wave;
    const radiusY = (phase === 2 ? 1.02 : 1.2) + wave;
    const x = Math.cos(angle) * boss.r * radiusX * separation;
    const y = Math.sin(angle) * boss.r * radiusY * separation;
    const size = boss.r * (0.24 + Math.cos(angle * 2) * 0.035);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 4);
    ctx.fillStyle = "rgba(24,31,70,0.94)";
    ctx.beginPath();
    ctx.moveTo(-size * 0.72, 0);
    ctx.lineTo(0, -size * 0.72);
    ctx.lineTo(size * 0.72, 0);
    ctx.lineTo(0, size * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = i % 2 ? "rgba(255,150,230,0.86)" : "rgba(144,247,255,0.92)";
    ctx.lineWidth = Math.max(1.2, boss.r * 0.025);
    ctx.stroke();
    ctx.fillStyle = "rgba(226,244,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(-size * 0.72, 0);
    ctx.lineTo(0, -size * 0.72);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  ctx.save();
  ctx.rotate(-time * 0.22);
  ctx.fillStyle = "rgba(25, 30, 72, 0.92)";
  ctx.beginPath();
  const prismPoints = getUnitCirclePoints(6, resources);
  for (let i = 0; i < 6; i++) {
    const radius = boss.r * (i % 2 === 0 ? 1.0 : 0.56);
    ctx.lineTo(prismPoints[i * 2] * radius, prismPoints[i * 2 + 1] * radius);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.54)";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  const prism = ctx.createLinearGradient(-boss.r, -boss.r, boss.r, boss.r);
  prism.addColorStop(0, "rgba(255,255,255,0.92)");
  prism.addColorStop(0.45, "rgba(132,255,235,0.8)");
  prism.addColorStop(1, "rgba(255,151,221,0.46)");
  ctx.fillStyle = prism;
  ctx.beginPath();
  ctx.moveTo(0, -boss.r * 0.72);
  ctx.lineTo(boss.r * 0.5, 0);
  ctx.lineTo(0, boss.r * 0.76);
  ctx.lineTo(-boss.r * 0.5, 0);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.82)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.78)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, boss.r * (0.44 + i * 0.2), time + i * 0.8, time + i * 0.8 + Math.PI * 1.16);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(-boss.r * 0.36, -boss.r * 0.06);
  ctx.lineTo(boss.r * 0.36, -boss.r * 0.06);
  ctx.moveTo(-boss.r * 0.24, boss.r * 0.24);
  ctx.lineTo(boss.r * 0.24, boss.r * 0.24);
  ctx.stroke();

  ctx.restore();
}

export function drawBossCathedral(ctx, state, boss, resources) {
  ctx.save();
  ctx.translate(boss.x, boss.y);
  const time = state.time * 1.1;
  const phase = Math.max(1, (boss.phaseIndex || 0) + 1);
  const attackCharge = getBossAttackCharge(boss);
  const phaseOpen = Math.min(1, Math.max(0, (boss.phaseTime || 0) / 0.6));
  const phaseEase = phaseOpen * phaseOpen * (3 - 2 * phaseOpen);

  drawGlowCircle(
    ctx,
    0,
    0,
    boss.r * (2.15 + phase * 0.12),
    "rgba(255, 110, 90, 0.56)",
    0.45,
    resources
  );
  drawGlowCircle(
    ctx,
    0,
    boss.r * 0.12,
    boss.r * 1.28,
    "rgba(255, 207, 132, 0.14)",
    0.5,
    resources
  );

  drawPhaseCrown(
    ctx,
    boss.r * 1.42,
    phase,
    "rgba(255,155,128,0.5)",
    -time * 0.1,
    resources
  );
  drawRuneOrbit(
    ctx,
    boss.r * 1.34,
    9 + phase,
    "rgba(255,218,170,0.5)",
    time * 0.14,
    0.05,
    resources
  );

  ctx.save();
  ctx.rotate(-time * 0.18);
  ctx.fillStyle = "rgba(255, 157, 128, 0.22)";
  ctx.beginPath();
  const cathedralPoints = getUnitCirclePoints(9, resources);
  for (let i = 0; i < 9; i++) {
    const radius = boss.r * (0.64 + 0.28 * Math.sin(time + i));
    ctx.lineTo(cathedralPoints[i * 2] * radius, cathedralPoints[i * 2 + 1] * radius);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,226,200,0.62)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "rgba(45, 20, 31, 0.94)";
  ctx.beginPath();
  ctx.moveTo(-boss.r * 0.78, boss.r * 0.86);
  ctx.lineTo(-boss.r * 0.72, -boss.r * 0.58);
  ctx.lineTo(-boss.r * 0.54, -boss.r * 0.82);
  ctx.lineTo(-boss.r * 0.38, -boss.r * 0.5);
  ctx.lineTo(-boss.r * 0.18, -boss.r * (0.88 + phase * 0.06));
  ctx.lineTo(0, -boss.r * 0.66);
  ctx.lineTo(boss.r * 0.24, -boss.r * 0.98);
  ctx.lineTo(boss.r * 0.42, -boss.r * 0.54);
  ctx.lineTo(boss.r * 0.66, -boss.r * 0.82);
  ctx.lineTo(boss.r * 0.72, -boss.r * 0.36);
  ctx.lineTo(boss.r * 0.78, boss.r * 0.86);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255,110,90,0.62)";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (phase >= 2) {
    const sideShift = boss.r * (phase === 2 ? 0.12 : 0.22) * phaseEase;
    for (let side = -1; side <= 1; side += 2) {
      ctx.save();
      ctx.translate(side * sideShift, 0);
      ctx.fillStyle = "rgba(29,13,27,0.98)";
      ctx.strokeStyle = "rgba(255,125,112,0.72)";
      ctx.beginPath();
      ctx.moveTo(side * boss.r * 0.18, boss.r * 0.74);
      ctx.lineTo(side * boss.r * 0.28, -boss.r * 0.52);
      ctx.lineTo(side * boss.r * 0.48, -boss.r * (0.72 + phase * 0.06));
      ctx.lineTo(side * boss.r * 0.7, boss.r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = "rgba(4,2,10,0.98)";
    ctx.beginPath();
    ctx.moveTo(-boss.r * 0.045, -boss.r * 0.94);
    ctx.lineTo(boss.r * 0.06, -boss.r * 0.62);
    ctx.lineTo(-boss.r * 0.035, -boss.r * 0.34);
    ctx.lineTo(boss.r * 0.05, 0);
    ctx.lineTo(-boss.r * 0.05, boss.r * 0.35);
    ctx.lineTo(-boss.r * 0.045, -boss.r * 0.94);
    ctx.fill();
  }

  const split = (phase === 1 ? 0.42 : phase === 2 ? 0.56 : 0.68) + attackCharge * 0.09;
  ctx.fillStyle = "rgba(5, 3, 12, 0.98)";
  ctx.beginPath();
  ctx.moveTo(0, -boss.r * 0.38);
  ctx.quadraticCurveTo(boss.r * split, -boss.r * 0.06, boss.r * split * 0.82, boss.r * 0.68);
  ctx.quadraticCurveTo(0, boss.r * 1.02, -boss.r * split * 0.82, boss.r * 0.68);
  ctx.quadraticCurveTo(-boss.r * split, -boss.r * 0.06, 0, -boss.r * 0.38);
  ctx.closePath();
  ctx.fill();

  if (phase >= 2) {
    ctx.fillStyle = phase === 3 ? "rgba(255,70,70,0.45)" : "rgba(142,45,77,0.5)";
    ctx.beginPath();
    ctx.ellipse(0, boss.r * 0.34, boss.r * split * 0.48, boss.r * 0.5, 0, 0, TAU);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255, 236, 220, 0.9)";
  for (let i = -(3 + phase); i <= 3 + phase; i++) {
    const x = i * boss.r * (split * 0.68 / (3 + phase));
    const uneven = (Math.abs(i * 7) % 3) * 0.035;
    ctx.beginPath();
    ctx.moveTo(x, boss.r * (-0.18 + uneven));
    ctx.lineTo(x + boss.r * 0.07, boss.r * (0.16 + uneven));
    ctx.lineTo(x - boss.r * 0.07, boss.r * (0.16 + uneven));
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, boss.r * (0.72 - uneven));
    ctx.lineTo(x + boss.r * 0.07, boss.r * (0.4 - uneven));
    ctx.lineTo(x - boss.r * 0.07, boss.r * (0.4 - uneven));
    ctx.closePath();
    ctx.fill();
  }

  drawRing(ctx, boss.r * 0.24, "rgba(255, 244, 218, 0.82)", 2.2, 0.84);
  drawEyeCore(ctx, boss.r * 0.22, "#ffce78", "rgba(255, 174, 120, 0.18)", resources);

  ctx.strokeStyle = "rgba(255, 190, 160, 0.72)";
  ctx.lineWidth = Math.max(2.4, boss.r * 0.045);
  for (let i = -3; i <= 3; i++) {
    const x = i * boss.r * 0.2;
    ctx.beginPath();
    ctx.moveTo(x, boss.r * 0.76);
    ctx.quadraticCurveTo(x * 1.25, -boss.r * 0.1, x * 0.72, -boss.r * 0.72);
    ctx.stroke();
  }

  ctx.restore();
}

const bossRenderers = {
  seraph: drawBossSeraph,
  prism: drawBossPrism,
  cathedral: drawBossCathedral,
};

export function listBossRendererKeys() {
  return Object.keys(bossRenderers);
}

export function drawBossByKey(ctx, state, boss, resources) {
  const renderer = bossRenderers[boss.renderKey] || bossRenderers.seraph;
  renderer(ctx, state, boss, resources);
}
