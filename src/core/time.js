export function createFrameTimer(maxDelta = 0.033) {
  let last = 0;
  return function next(timestamp) {
    if (!last) last = timestamp;
    const delta = Math.min(maxDelta, (timestamp - last) / 1000);
    last = timestamp;
    return delta;
  };
}
