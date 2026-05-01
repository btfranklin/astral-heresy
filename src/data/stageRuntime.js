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
