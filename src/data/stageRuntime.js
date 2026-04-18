export function gateRecurringWave(stageState, key, t, ctx, options) {
  const gate = ctx.director.gateWave(options);
  if (!gate.allow) {
    stageState[key] = t + gate.delay;
    return null;
  }
  return gate;
}

export function resolveOneShotWave(ctx, options) {
  const gate = ctx.director.gateWave(options);
  if (gate.allow) {
    return { mode: "full", gate };
  }
  if (gate.anchorOnly) {
    return { mode: "anchor", gate };
  }
  return { mode: "defer", gate };
}
