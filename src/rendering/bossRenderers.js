import { TAU } from "../core/math.js";
import { drawGlowCircle } from "./drawHelpers.js";

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

function drawEyeCore(ctx, radius, iris, glow) {
  drawGlowCircle(ctx, 0, 0, radius * 1.9, glow, 0.28);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, radius * 0.66, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.34, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(10, 10, 18, 0.88)";
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.12, radius * 0.38, 0, 0, TAU);
  ctx.fill();
}

function drawFeatherArc(ctx, radius, count, color, rotation = 0, stretch = 0.9) {
  ctx.save();
  ctx.rotate(rotation);
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI * 0.8 + (i / (count - 1 || 1)) * Math.PI * 1.6;
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(radius * 0.08, -radius * 0.06);
    ctx.quadraticCurveTo(radius * 0.92, -radius * stretch, radius * 0.7, radius * 0.02);
    ctx.quadraticCurveTo(radius * 0.54, radius * 0.5, radius * 0.02, radius * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawShard(ctx, radius, width, color, rotation = 0) {
  ctx.save();
  ctx.rotate(rotation);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(width, 0);
  ctx.lineTo(0, radius * 0.34);
  ctx.lineTo(-width, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawBossSeraph(ctx, state, boss) {
  ctx.save();
  ctx.translate(boss.x, boss.y);
  const time = state.time * 1.4;

  drawGlowCircle(ctx, 0, 0, boss.r * 2.2, "rgba(120, 255, 220, 0.62)", 0.5);
  drawGlowCircle(ctx, 0, 0, boss.r * 1.45, "rgba(255, 176, 232, 0.18)", 0.5);

  ctx.save();
  ctx.translate(0, -boss.r * 0.18);
  drawFeatherArc(ctx, boss.r * 0.94, 10, "rgba(235, 248, 255, 0.32)", Math.sin(time * 0.3) * 0.08, 0.88);
  drawFeatherArc(ctx, boss.r * 1.16, 12, "rgba(255, 191, 236, 0.16)", -time * 0.18, 0.98);
  ctx.restore();

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
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * TAU;
    ctx.moveTo(Math.cos(ang) * boss.r * 0.46, Math.sin(ang) * boss.r * 0.46);
    ctx.lineTo(Math.cos(ang) * boss.r * 1.1, Math.sin(ang) * boss.r * 1.1);
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

  drawRing(ctx, boss.r * 0.7, "rgba(255,255,255,0.42)", 2, 0.7);
  drawEyeCore(ctx, boss.r * 0.4, "#ff97dd", "rgba(120,255,220,0.25)");

  ctx.restore();
}

export function drawBossPrism(ctx, state, boss) {
  ctx.save();
  ctx.translate(boss.x, boss.y);
  const time = state.time * 1.2;

  drawGlowCircle(ctx, 0, 0, boss.r * 2.1, "rgba(130, 210, 255, 0.64)", 0.48);
  drawGlowCircle(ctx, 0, 0, boss.r * 1.2, "rgba(255, 153, 245, 0.14)", 0.5);

  ctx.save();
  ctx.rotate(time * 0.36);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * TAU;
    ctx.save();
    ctx.rotate(angle);
    ctx.translate(0, -boss.r * 0.98);
    drawShard(ctx, boss.r * 0.56, boss.r * 0.2, "rgba(228, 192, 255, 0.42)", Math.sin(time + i) * 0.2);
    ctx.restore();
  }
  ctx.restore();

  ctx.save();
  ctx.rotate(-time * 0.22);
  ctx.fillStyle = "rgba(233, 247, 255, 0.68)";
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * TAU;
    const radius = boss.r * (i % 2 === 0 ? 1.0 : 0.56);
    ctx.lineTo(Math.cos(ang) * radius, Math.sin(ang) * radius);
  }
  ctx.closePath();
  ctx.fill();
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

export function drawBossCathedral(ctx, state, boss) {
  ctx.save();
  ctx.translate(boss.x, boss.y);
  const time = state.time * 1.1;

  drawGlowCircle(ctx, 0, 0, boss.r * 2.15, "rgba(255, 110, 90, 0.56)", 0.45);
  drawGlowCircle(ctx, 0, boss.r * 0.12, boss.r * 1.28, "rgba(255, 207, 132, 0.14)", 0.5);

  ctx.save();
  ctx.rotate(-time * 0.18);
  ctx.fillStyle = "rgba(255, 157, 128, 0.22)";
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * TAU;
    const radius = boss.r * (0.64 + 0.28 * Math.sin(time + i));
    ctx.lineTo(Math.cos(ang) * radius, Math.sin(ang) * radius);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(255, 214, 190, 0.34)";
  ctx.beginPath();
  ctx.moveTo(-boss.r * 0.78, boss.r * 0.86);
  ctx.lineTo(-boss.r * 0.64, -boss.r * 0.18);
  ctx.quadraticCurveTo(0, -boss.r * 1.08, boss.r * 0.64, -boss.r * 0.18);
  ctx.lineTo(boss.r * 0.78, boss.r * 0.86);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(20, 10, 18, 0.78)";
  ctx.beginPath();
  ctx.moveTo(-boss.r * 0.5, boss.r * 0.52);
  ctx.quadraticCurveTo(0, boss.r * 0.06, boss.r * 0.5, boss.r * 0.52);
  ctx.quadraticCurveTo(0, boss.r * 0.98, -boss.r * 0.5, boss.r * 0.52);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255, 236, 220, 0.9)";
  for (let i = -3; i <= 3; i++) {
    const x = i * boss.r * 0.12;
    ctx.beginPath();
    ctx.moveTo(x, boss.r * 0.24);
    ctx.lineTo(x + boss.r * 0.06, boss.r * 0.5);
    ctx.lineTo(x - boss.r * 0.06, boss.r * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  drawRing(ctx, boss.r * 0.24, "rgba(255, 244, 218, 0.82)", 2.2, 0.84);
  drawEyeCore(ctx, boss.r * 0.22, "#ffce78", "rgba(255, 174, 120, 0.18)");

  ctx.strokeStyle = "rgba(255, 226, 200, 0.72)";
  ctx.lineWidth = 2.4;
  for (let i = -2; i <= 2; i++) {
    const x = i * boss.r * 0.22;
    ctx.beginPath();
    ctx.moveTo(x, -boss.r * 0.12);
    ctx.lineTo(x * 0.62, -boss.r * 0.84);
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

export function drawBossByKey(ctx, state, boss) {
  const renderer = bossRenderers[boss.renderKey] || bossRenderers.seraph;
  renderer(ctx, state, boss);
}
