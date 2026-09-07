import { TAU } from "../core/math.js";

const ink = "#101727";

function polygon(ctx, points, fill, stroke, width = 1.4) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

function eye(ctx, r, color, charge = 0) {
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.22, r * 0.91, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#f4ffff";
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * (0.65 - charge * 0.22), 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.43, 0, TAU);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.13, r * 0.42, 0, 0, TAU);
  ctx.fill();
}

function ring(ctx, r, color, width = 1.5) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
}

function drawCherub(ctx, r, color, accent, t, resources, charge, release) {
  const spread = 0.8 + Math.sin(t * 4) * 0.18 - charge * 0.36 + release * 0.25;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.rotate(-0.12 - charge * 0.3);
    for (let i = 2; i >= 0; i--) {
      const tip = r * (1.75 - i * 0.23) * spread;
      polygon(ctx, [[r * 0.1, 0], [tip, r * (-0.8 + i * 0.42)],
        [tip * 0.79, r * (0.05 + i * 0.27)], [r * 0.22, r * 0.5]],
      i % 2 ? "#476c88" : "#b8e1ee", accent, 1);
    }
    ctx.restore();
  }
  ctx.save();
  ctx.translate(0, -r * 1.05);
  ctx.scale(1, 0.3);
  ring(ctx, r * 0.65, accent, 2.5);
  ctx.restore();
  eye(ctx, r * 0.62, color, charge);
}

function drawHaloSentinel(ctx, r, color, accent, t, resources, charge) {
  // Draw the rear halves first so the rings pass behind the eye.
  for (const front of [false, true]) {
    if (front) eye(ctx, r * 0.57, color, charge);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * (0.65 + Math.sin(t * 0.8) * 0.18));
      ctx.strokeStyle = front ? accent : "#386e78";
      ctx.lineWidth = front ? 2.5 : 3.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.27, r * (0.43 + charge * 0.17), 0,
        front ? 0 : Math.PI, front ? Math.PI : TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawOracle(ctx, r, color, accent, t, resources, charge, release) {
  const opening = charge * 0.37 + release * 0.2;
  eye(ctx, r * 0.5, color, 0);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.translate(r * opening, 0);
    polygon(ctx, [[0, -r * 1.15], [r * 0.82, 0], [0, r * 1.15],
      [r * (0.08 + opening * 0.18), 0]], "#342d42", accent);
    polygon(ctx, [[r * 0.16, -r * 0.7], [r * 0.6, 0], [r * 0.16, r * 0.7], [r * 0.3, 0]],
      color, color, 0.7);
    ctx.restore();
  }
}

function drawShard(ctx, r, color, accent, t, resources, charge, release) {
  ctx.save();
  ctx.rotate(-0.22 + Math.sin(t * 1.8) * 0.14 + release * 0.16);
  polygon(ctx, [[0, -r * 1.45], [r * 0.7, r * 0.1], [-r * 0.18, r * 1.25], [-r * 0.53, r * 0.35]],
    "#183342", accent);
  polygon(ctx, [[0, -r * 1.45], [r * 0.7, r * 0.1], [r * 0.05, r * 0.48]], color, accent, 1);
  polygon(ctx, [[-r * 0.56, -r * 0.42], [-r * 0.85, r * 0.3], [-r * 0.43, r * 0.8]],
    "#477484", color, 0.8);
  eye(ctx, r * (0.19 + charge * 0.06), accent, charge);
  ctx.restore();
}

function drawWeaver(ctx, r, color, accent, t, resources, charge, release) {
  const reach = 1.15 + charge * 0.26 - release * 0.15;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    const tips = [];
    for (let i = -1; i <= 1; i++) {
      const y = i * r * 0.95;
      const x = r * (reach - Math.abs(i) * 0.15);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(r * 0.2, i * r * 0.25);
      ctx.lineTo(r * 0.72, y * 0.65 - r * 0.2);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      tips.push([x, y]);
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 0.8 + charge;
    ctx.beginPath();
    ctx.moveTo(...tips[0]);
    ctx.quadraticCurveTo(r * (0.65 + charge * 0.5), 0, ...tips[2]);
    ctx.stroke();
    ctx.restore();
  }
  polygon(ctx, [[0,-r * 0.9],[r * 0.46,0],[0,r * 0.8],[-r * 0.46,0]], ink, color);
  eye(ctx, r * 0.34, color, charge);
}

function drawHarp(ctx, r, color, accent, t, resources, charge, release) {
  ctx.strokeStyle = ink;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(r * 0.75, -r);
  ctx.lineTo(r * 0.75, r);
  ctx.quadraticCurveTo(-r * 1.4, r * 0.85, -r * 0.6, -r * 1.05);
  ctx.lineTo(r * 0.75, -r);
  ctx.stroke();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const x = r * (-0.35 + i * 0.24);
    ctx.beginPath();
    ctx.moveTo(x, -r * 0.8);
    ctx.quadraticCurveTo(x - charge * r * 0.4 + Math.sin(t * 40 + i) * release * r * 0.2,
      0, x, r * 0.68);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(r * 0.75, r * 0.3);
  eye(ctx, r * 0.28, color, charge);
  ctx.restore();
}

function drawSpear(ctx, r, color, accent, t, resources, charge, release) {
  ctx.save();
  ctx.translate(0, -charge * r * 0.12 + release * r * 0.12);
  // The point faces the player's side of the field.
  polygon(ctx, [[0,r * 1.55],[r * 0.46,-r * 0.16],[r * 0.15,-r * 0.9],
    [-r * 0.15,-r * 0.9],[-r * 0.46,-r * 0.16]], ink, accent);
  polygon(ctx, [[0,r * 1.55],[r * 0.46,-r * 0.16],[0,r * 0.1]], color, color, 0.8);
  for (const side of [-1,1]) {
    polygon(ctx, [[side * r * 0.16,0], [side * r * (0.9 - charge * 0.35),-r * (0.6 + charge * 0.4)],
      [side * r * 0.2,-r * 0.55]], "#633342", accent, 1);
  }
  eye(ctx, r * 0.27, color, charge);
  ctx.restore();
}

function drawThrone(ctx, r, color, accent, t, resources, charge) {
  ring(ctx, r * 1.06, ink, r * 0.4);
  ring(ctx, r * 1.24, accent, 2);
  ring(ctx, r * 0.87, color, 2);
  ctx.save();
  ctx.rotate(t * 0.22);
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate(i * TAU / 8);
    polygon(ctx, [[-r * 0.12,-r * 0.35],[-r * 0.17,-r * 1.08],
      [r * 0.17,-r * 1.08],[r * 0.12,-r * 0.35]], "#76512f", color, 1);
    if (i % 2 === 0) {
      ctx.translate(0,-r * 1.04);
      eye(ctx, r * 0.15, accent, charge);
    }
    ctx.restore();
  }
  ctx.restore();
  eye(ctx, r * 0.48, color, charge);
}

function drawFang(ctx, r, color, accent, t, resources, charge, release) {
  const gape = 0.12 + charge * 0.48 + release * 0.15;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.rotate(-gape);
    polygon(ctx, [[r * 0.05,-r * 0.6],[r * 0.82,-r * 0.3],
      [r * 0.94,r * 0.62],[r * 0.3,r * 1.15],[r * 0.42,r * 0.12]], "#382439", accent);
    for (let i = 0; i < 3; i++) {
      const y = r * (-0.03 + i * 0.29);
      polygon(ctx, [[r * 0.54,y],[r * 0.19,y + r * 0.13],[r * 0.58,y + r * 0.24]],
        "#ffe4cf", "#ffe4cf", 0.6);
    }
    ctx.restore();
  }
  ctx.save();
  ctx.translate(0,-r * 0.52);
  eye(ctx, r * 0.33, color, charge);
  ctx.restore();
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
  const charge = ai?.fire || state.showcase?.type === "enemy"
    ? Math.max(0, Math.min(1, 1 - (ai?.nextShot ?? 1) / 0.38))
    : 0;
  const release = Math.max(0, (ai?.attackRelease || 0) / 0.18);
  renderer(ctx, col.r, render.color, render.accent, time, resources, charge, release);

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
