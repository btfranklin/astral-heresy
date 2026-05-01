export function gateRecurringWave(stageState, key, t, ctx, options) {
  const gate = ctx.director.gateWave(options);
  if (!gate.allow) {
    stageState[key] = t + gate.delay;
    return null;
  }
  return gate;
}

export function resolveOneShotWave(stageState, key, t, ctx, options) {
  if ((stageState[key] || 0) > t) {
    return null;
  }

  const gate = ctx.director.gateWave(options);
  if (gate.allow) {
    return { mode: "full", gate };
  }
  if (gate.anchorOnly) {
    return { mode: "anchor", gate };
  }
  stageState[key] = t + gate.delay;
  return null;
}

export function runOneShotEncounter(
  stageState,
  t,
  ctx,
  { doneKey, retryKey, startTime, gate: gateOptions },
  spawnEncounter
) {
  if (stageState[doneKey] || t < startTime) {
    return null;
  }

  const wave = resolveOneShotWave(stageState, retryKey, t, ctx, gateOptions);
  if (!wave) {
    return null;
  }

  stageState[doneKey] = true;
  spawnEncounter({
    gate: wave.gate,
    wave,
    isFull: wave.mode === "full",
    spawnEscorts: wave.mode === "full" && wave.gate.escortScale > 0.5,
  });
  return wave;
}
