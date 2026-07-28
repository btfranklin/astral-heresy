import { TAU } from "../core/math.js";
import { drawGlowCircle, getUnitCirclePoints } from "./drawHelpers.js";

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

function drawSigilTicks(
  ctx,
  radius,
  count,
  color,
  time = 0,
  alternating = false,
  resources
) {
  ctx.save();
  ctx.rotate(time);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, radius * 0.07);
  ctx.lineCap = "round";
  const points = getUnitCirclePoints(count, resources);
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const inner = radius * (alternating && i % 2 ? 0.78 : 0.86);
    const cos = points[i * 2];
    const sin = points[i * 2 + 1];
    ctx.moveTo(cos * inner, sin * inner);
    ctx.lineTo(cos * radius, sin * radius);
  }
  ctx.stroke();
  ctx.restore();
}

function drawDiamond(ctx, radius, fill, stroke, rotation = 0) {
  ctx.save();
  ctx.rotate(rotation);
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(1, radius * 0.08);
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(radius * 0.72, 0);
  ctx.lineTo(0, radius);
  ctx.lineTo(-radius * 0.72, 0);
  ctx.closePath();
  ctx.fill();
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
  ctx.strokeStyle = "rgba(255,255,255,0.62)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawEye(ctx, radius, iris, halo, resources) {
  drawGlowCircle(ctx, 0, 0, radius * 2.1, halo, 0.26, resources);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 1.1, radius * 0.7, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.42, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.86)";
  ctx.lineWidth = Math.max(1, radius * 0.08);
  ctx.stroke();
  ctx.fillStyle = "rgba(9, 7, 18, 0.9)";
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.14, radius * 0.42, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.arc(-radius * 0.16, -radius * 0.18, radius * 0.09, 0, TAU);
  ctx.fill();
}

function drawCherub(ctx, radius, color, accent, time, resources) {
  drawGlowCircle(ctx, 0, 0, radius * 2.8, "rgba(122,215,255,0.3)", 0.4, resources);
  ctx.save();
  ctx.rotate(-time * 0.22);
  drawSigilTicks(ctx, radius * 1.18, 8, "rgba(224,250,255,0.56)", 0, true, resources);
  drawHaloRing(ctx, radius * 1.02, "rgba(122,215,255,0.58)", 1.2, 0.72);
  ctx.restore();
  ctx.save();
  ctx.translate(0, -radius * (0.98 + Math.sin(time * 2.2) * 0.04));
  ctx.scale(1.1, 0.45);
  drawHaloRing(ctx, radius * 0.75, accent, 2, 0.75);
  ctx.restore();
  ctx.save();
  ctx.rotate(Math.sin(time * 2.1) * 0.06);
  drawWing(ctx, -1, radius * 1.16, "rgba(165, 231, 255, 0.54)");
  drawWing(ctx, 1, radius * 1.16, "rgba(224, 250, 255, 0.62)");
  ctx.restore();
  drawEye(ctx, radius * 0.8, color, "rgba(121,255,225,0.35)", resources);
}

function drawHaloSentinel(ctx, radius, color, accent, time, resources) {
  drawGlowCircle(ctx, 0, 0, radius * 3.2, "rgba(131,255,230,0.28)", 0.38, resources);
  ctx.save();
  ctx.rotate(time * 0.5);
  drawHaloRing(ctx, radius * 1.14, accent, 3, 0.74);
  drawHaloRing(ctx, radius * 0.82, "rgba(255,255,255,0.4)", 1.2, 0.8);
  drawSigilTicks(
    ctx,
    radius * 1.34,
    12,
    "rgba(131,255,230,0.62)",
    -time,
    true,
    resources
  );
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * TAU;
    const x = Math.cos(angle) * radius * 1.05;
    const y = Math.sin(angle) * radius * 1.05;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x, y, radius * (i % 2 ? 0.09 : 0.14), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  drawEye(ctx, radius * 0.74, color, "rgba(131,255,230,0.28)", resources);
}

function drawOracle(ctx, radius, color, accent, _time, resources) {
  drawGlowCircle(ctx, 0, 0, radius * 2.8, "rgba(255,212,128,0.24)", 0.36, resources);
  drawDiamond(ctx, radius * 1.22, "rgba(255, 224, 145, 0.34)", "rgba(255,246,215,0.84)");
  drawDiamond(ctx, radius * 0.9, "rgba(255, 246, 215, 0.7)", color, Math.PI / 4);
  drawHaloRing(ctx, radius * 1.05, accent, 1.6, 0.7);
  drawSigilTicks(ctx, radius * 1.3, 4, color, Math.PI / 4, false, resources);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -radius * 0.92);
  ctx.lineTo(0, radius * 0.92);
  ctx.stroke();
  drawEye(ctx, radius * 0.46, color, "rgba(255,212,128,0.2)", resources);
}

function drawWeaver(ctx, radius, color, accent, time, resources) {
  drawGlowCircle(ctx, 0, 0, radius * 3, "rgba(197,163,255,0.24)", 0.36, resources);
  ctx.save();
  ctx.rotate(time * 0.8);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(-radius * 1.3, 0);
    ctx.quadraticCurveTo(0, Math.sin(time * 2 + i) * radius * 0.24, radius * 1.3, 0);
    ctx.stroke();
  }
  ctx.restore();
  drawDiamond(ctx, radius * 1.05, "rgba(197,163,255,0.3)", "rgba(255,223,251,0.74)", -time * 0.22);
  drawDiamond(ctx, radius * 0.78, "rgba(231,221,255,0.72)", color, time * 0.16);
  drawEye(ctx, radius * 0.44, color, "rgba(197,163,255,0.2)", resources);
}

function drawShard(ctx, radius, color, accent, time, resources) {
  drawGlowCircle(ctx, 0, 0, radius * 2.7, "rgba(158,251,255,0.24)", 0.34, resources);
  ctx.save();
  ctx.rotate(time * 0.55);
  ctx.fillStyle = "rgba(240, 253, 255, 0.72)";
  ctx.strokeStyle = "rgba(158,251,255,0.78)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.rotate(TAU / 5);
    ctx.beginPath();
    ctx.moveTo(0, -radius * 1.15);
    ctx.lineTo(radius * 0.24, 0);
    ctx.lineTo(0, radius * 0.32);
    ctx.lineTo(-radius * 0.24, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  drawHaloRing(ctx, radius * 0.58, accent, 1.6, 0.72);
  drawEye(ctx, radius * 0.36, color, "rgba(158,251,255,0.18)", resources);
}

function drawHarp(ctx, radius, color, accent, time, resources) {
  drawGlowCircle(ctx, 0, 0, radius * 2.7, "rgba(255,213,255,0.24)", 0.34, resources);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(-radius * 0.1, 0, radius * 0.92, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-radius * 0.06, -radius * 0.9);
  ctx.quadraticCurveTo(-radius * 0.78, 0, -radius * 0.06, radius * 0.9);
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
  drawSigilTicks(
    ctx,
    radius * 1.18,
    6,
    "rgba(255,213,255,0.55)",
    time * 0.16,
    false,
    resources
  );
  drawEye(ctx, radius * 0.34, color, "rgba(255,213,255,0.16)", resources);
}

function drawSpear(ctx, radius, color, accent, _time, resources) {
  drawGlowCircle(ctx, 0, 0, radius * 2.8, "rgba(255,155,133,0.22)", 0.34, resources);
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
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,155,133,0.5)";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * radius * 0.28, radius * 0.06);
    ctx.lineTo(side * radius * 0.92, radius * 0.58);
    ctx.lineTo(side * radius * 0.2, radius * 0.42);
    ctx.closePath();
    ctx.fill();
  }
  drawHaloRing(ctx, radius * 0.54, accent, 1.6, 0.68);
  drawEye(ctx, radius * 0.3, color, "rgba(255,155,133,0.16)", resources);
}

function drawThrone(ctx, radius, color, accent, time, resources) {
  drawGlowCircle(ctx, 0, 0, radius * 3.4, "rgba(255,184,91,0.22)", 0.36, resources);
  ctx.save();
  ctx.rotate(time * 0.34);
  drawHaloRing(ctx, radius * 1.22, accent, 3, 0.72);
  drawHaloRing(ctx, radius * 0.88, "rgba(255,255,255,0.38)", 2, 0.72);
  drawSigilTicks(
    ctx,
    radius * 1.42,
    12,
    "rgba(255,184,91,0.58)",
    time * 0.25,
    true,
    resources
  );
  ctx.restore();
  ctx.save();
  ctx.rotate(-time * 0.55);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * TAU;
    const x = Math.cos(angle) * radius * 1.18;
    const y = Math.sin(angle) * radius * 1.18;
    ctx.fillStyle = "rgba(255, 242, 196, 0.64)";
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.17, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  drawEye(ctx, radius * 0.7, color, "rgba(255,184,91,0.18)", resources);
}

function drawFang(ctx, radius, color, accent, time, resources) {
  drawGlowCircle(ctx, 0, 0, radius * 3, "rgba(255,121,176,0.22)", 0.36, resources);
  ctx.save();
  ctx.rotate(Math.sin(time * 0.8) * 0.1);
  ctx.fillStyle = "rgba(255, 224, 241, 0.74)";
  ctx.strokeStyle = "rgba(255,121,176,0.86)";
  ctx.lineWidth = 1.2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * radius * 0.1, -radius * 0.18);
    ctx.lineTo(side * radius * 0.94, radius * 0.34);
    ctx.lineTo(side * radius * 0.24, radius * 0.94);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,121,176,0.38)";
  ctx.beginPath();
  ctx.moveTo(-radius * 0.9, -radius * 0.18);
  ctx.lineTo(0, -radius * 0.82);
  ctx.lineTo(radius * 0.9, -radius * 0.18);
  ctx.lineTo(0, -radius * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  drawHaloRing(ctx, radius * 0.62, accent, 1.6, 0.68);
  drawEye(ctx, radius * 0.38, color, "rgba(255,121,176,0.16)", resources);
}

const enemyRenderers = {
  cherub: drawCherub,
  halo: drawHaloSentinel,
  oracle: drawOracle,
  weaver: drawWeaver,
  shard: drawShard,
  harp: drawHarp,
  spear: drawSpear,
  throne: drawThrone,
  fang: drawFang,
};

export function listEnemyRendererKeys() {
  return Object.keys(enemyRenderers);
}

export function drawEnemy(ctx, enemy, state, resources) {
  const pos = enemy.components.position;
  const col = enemy.components.collider;
  const render = enemy.components.render;
  const ai = enemy.components.ai;
  const reward = enemy.components.reward;
  if (!pos || !col || !render) return;

  const time = (ai?.t || 0) + state.time * 0.5 + enemy.id * 0.12;

  ctx.save();
  ctx.translate(pos.x, pos.y);
  const renderer = enemyRenderers[render.renderKey] || enemyRenderers.cherub;
  renderer(ctx, col.r, render.color, render.accent, time, resources);

  if (reward?.elite) {
    ctx.strokeStyle = "rgba(255, 213, 142, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, col.r + 6 + Math.sin(time * 3) * 1.5, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 213, 142, 0.9)";
    for (let i = 0; i < 3; i++) {
      const angle = -Math.PI / 2 + (i - 1) * 0.28;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * (col.r + 8), Math.sin(angle) * (col.r + 8), 2.2, 0, TAU);
      ctx.fill();
    }
  }

  ctx.restore();
}
