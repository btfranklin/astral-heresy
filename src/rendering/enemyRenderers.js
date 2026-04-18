import { TAU } from "../core/math.js";
import { drawGlowCircle } from "./drawHelpers.js";

function drawHaloRing(ctx, radius, color, lineWidth = 2, alpha = 0.9) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawWing(ctx, side, radius, color) {
  ctx.save();
  ctx.scale(side, 1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(radius * 0.1, -radius * 0.1);
  ctx.quadraticCurveTo(radius * 1.2, -radius * 0.9, radius * 0.8, radius * 0.2);
  ctx.quadraticCurveTo(radius * 0.6, radius * 0.8, radius * 0.1, radius * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEye(ctx, radius, iris, halo) {
  drawGlowCircle(ctx, 0, 0, radius * 2.1, halo, 0.26);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 1.1, radius * 0.7, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.42, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(9, 7, 18, 0.9)";
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.14, radius * 0.42, 0, 0, TAU);
  ctx.fill();
}

function drawCherub(ctx, radius, color, accent) {
  drawGlowCircle(ctx, 0, 0, radius * 2.8, "rgba(122,215,255,0.3)", 0.4);
  drawHaloRing(ctx, radius * 0.72, accent, 2, 0.9);
  ctx.save();
  ctx.translate(0, -radius * 0.92);
  ctx.scale(1.1, 0.45);
  drawHaloRing(ctx, radius * 0.75, accent, 2, 0.75);
  ctx.restore();
  drawWing(ctx, -1, radius, "rgba(224, 250, 255, 0.55)");
  drawWing(ctx, 1, radius, "rgba(224, 250, 255, 0.55)");
  drawEye(ctx, radius * 0.8, color, "rgba(121,255,225,0.35)");
}

function drawHaloSentinel(ctx, radius, color, accent, time) {
  drawGlowCircle(ctx, 0, 0, radius * 3.2, "rgba(131,255,230,0.28)", 0.38);
  ctx.save();
  ctx.rotate(time * 0.5);
  drawHaloRing(ctx, radius * 1.05, accent, 3, 0.7);
  drawHaloRing(ctx, radius * 0.68, "rgba(255,255,255,0.4)", 1.2, 0.8);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * TAU;
    const x = Math.cos(angle) * radius * 1.05;
    const y = Math.sin(angle) * radius * 1.05;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.14, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  drawEye(ctx, radius * 0.74, color, "rgba(131,255,230,0.28)");
}

function drawOracle(ctx, radius, color, accent) {
  drawGlowCircle(ctx, 0, 0, radius * 2.8, "rgba(255,212,128,0.24)", 0.36);
  ctx.fillStyle = "rgba(255, 246, 215, 0.7)";
  ctx.beginPath();
  ctx.moveTo(0, -radius * 1.05);
  ctx.lineTo(radius * 0.82, 0);
  ctx.lineTo(0, radius * 1.05);
  ctx.lineTo(-radius * 0.82, 0);
  ctx.closePath();
  ctx.fill();
  drawHaloRing(ctx, radius * 0.92, accent, 1.6, 0.7);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -radius * 0.92);
  ctx.lineTo(0, radius * 0.92);
  ctx.stroke();
  drawEye(ctx, radius * 0.46, color, "rgba(255,212,128,0.2)");
}

function drawWeaver(ctx, radius, color, accent, time) {
  drawGlowCircle(ctx, 0, 0, radius * 3, "rgba(197,163,255,0.24)", 0.36);
  ctx.save();
  ctx.rotate(time * 0.8);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(-radius * 1.1, 0);
    ctx.lineTo(radius * 1.1, 0);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "rgba(231, 221, 255, 0.72)";
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(radius * 0.95, 0);
  ctx.lineTo(0, radius);
  ctx.lineTo(-radius * 0.95, 0);
  ctx.closePath();
  ctx.fill();
  drawEye(ctx, radius * 0.44, color, "rgba(197,163,255,0.2)");
}

function drawShard(ctx, radius, color, accent, time) {
  drawGlowCircle(ctx, 0, 0, radius * 2.7, "rgba(158,251,255,0.24)", 0.34);
  ctx.save();
  ctx.rotate(time * 0.55);
  ctx.fillStyle = "rgba(240, 253, 255, 0.7)";
  for (let i = 0; i < 3; i++) {
    ctx.rotate(TAU / 3);
    ctx.beginPath();
    ctx.moveTo(0, -radius * 1.15);
    ctx.lineTo(radius * 0.24, 0);
    ctx.lineTo(0, radius * 0.32);
    ctx.lineTo(-radius * 0.24, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  drawHaloRing(ctx, radius * 0.58, accent, 1.6, 0.72);
  drawEye(ctx, radius * 0.36, color, "rgba(158,251,255,0.18)");
}

function drawHarp(ctx, radius, color, accent, time) {
  drawGlowCircle(ctx, 0, 0, radius * 2.7, "rgba(255,213,255,0.24)", 0.34);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-radius * 0.1, 0, radius * 0.92, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(radius * 0.62, -radius * 0.82);
  ctx.lineTo(radius * 0.62, radius * 0.82);
  ctx.stroke();
  for (let i = -2; i <= 2; i++) {
    const x = radius * (0.08 + i * 0.12);
    ctx.beginPath();
    ctx.moveTo(x, -radius * 0.64);
    ctx.lineTo(x + Math.sin(time + i) * 1.5, radius * 0.64);
    ctx.stroke();
  }
  drawEye(ctx, radius * 0.34, color, "rgba(255,213,255,0.16)");
}

function drawSpear(ctx, radius, color, accent) {
  drawGlowCircle(ctx, 0, 0, radius * 2.8, "rgba(255,155,133,0.22)", 0.34);
  ctx.fillStyle = "rgba(255, 240, 214, 0.78)";
  ctx.beginPath();
  ctx.moveTo(0, -radius * 1.18);
  ctx.lineTo(radius * 0.56, radius * 0.14);
  ctx.lineTo(radius * 0.22, radius * 0.12);
  ctx.lineTo(radius * 0.16, radius * 1.08);
  ctx.lineTo(-radius * 0.16, radius * 1.08);
  ctx.lineTo(-radius * 0.22, radius * 0.12);
  ctx.lineTo(-radius * 0.56, radius * 0.14);
  ctx.closePath();
  ctx.fill();
  drawHaloRing(ctx, radius * 0.54, accent, 1.6, 0.68);
  drawEye(ctx, radius * 0.3, color, "rgba(255,155,133,0.16)");
}

function drawThrone(ctx, radius, color, accent, time) {
  drawGlowCircle(ctx, 0, 0, radius * 3.4, "rgba(255,184,91,0.22)", 0.36);
  ctx.save();
  ctx.rotate(time * 0.34);
  drawHaloRing(ctx, radius * 1.15, accent, 3, 0.66);
  drawHaloRing(ctx, radius * 0.82, "rgba(255,255,255,0.38)", 2, 0.72);
  ctx.restore();
  ctx.save();
  ctx.rotate(-time * 0.55);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * TAU;
    const x = Math.cos(angle) * radius * 1.1;
    const y = Math.sin(angle) * radius * 1.1;
    ctx.fillStyle = "rgba(255, 242, 196, 0.64)";
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.17, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  drawEye(ctx, radius * 0.7, color, "rgba(255,184,91,0.18)");
}

function drawFang(ctx, radius, color, accent, time) {
  drawGlowCircle(ctx, 0, 0, radius * 3, "rgba(255,121,176,0.22)", 0.36);
  ctx.save();
  ctx.rotate(Math.sin(time * 0.8) * 0.1);
  ctx.fillStyle = "rgba(255, 224, 241, 0.72)";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * radius * 0.1, -radius * 0.18);
    ctx.lineTo(side * radius * 0.94, radius * 0.34);
    ctx.lineTo(side * radius * 0.24, radius * 0.94);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  drawHaloRing(ctx, radius * 0.62, accent, 1.6, 0.68);
  drawEye(ctx, radius * 0.38, color, "rgba(255,121,176,0.16)");
}

const enemyRenderers = {
  cherub: (ctx, radius, color, accent) => drawCherub(ctx, radius, color, accent),
  halo: (ctx, radius, color, accent, time) => drawHaloSentinel(ctx, radius, color, accent, time),
  oracle: (ctx, radius, color, accent) => drawOracle(ctx, radius, color, accent),
  weaver: (ctx, radius, color, accent, time) => drawWeaver(ctx, radius, color, accent, time),
  shard: (ctx, radius, color, accent, time) => drawShard(ctx, radius, color, accent, time),
  harp: (ctx, radius, color, accent, time) => drawHarp(ctx, radius, color, accent, time),
  spear: (ctx, radius, color, accent) => drawSpear(ctx, radius, color, accent),
  throne: (ctx, radius, color, accent, time) => drawThrone(ctx, radius, color, accent, time),
  fang: (ctx, radius, color, accent, time) => drawFang(ctx, radius, color, accent, time),
};

export function listEnemyRendererKeys() {
  return Object.keys(enemyRenderers);
}

export function drawEnemy(ctx, enemy, state) {
  const pos = enemy.components.position;
  const col = enemy.components.collider;
  const render = enemy.components.render;
  const ai = enemy.components.ai;
  if (!pos || !col || !render) return;

  const time = (ai?.t || 0) + state.time * 0.5 + enemy.id * 0.12;

  ctx.save();
  ctx.translate(pos.x, pos.y);
  const renderer = enemyRenderers[render.renderKey] || enemyRenderers.cherub;
  renderer(ctx, col.r, render.color, render.accent, time);

  ctx.restore();
}
