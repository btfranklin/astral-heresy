const SHAKE_DECAY_PER_SECOND = 42;

export function updateVisualFeedback(state, dt) {
  state.shake = Math.max(0, state.shake - dt * SHAKE_DECAY_PER_SECOND);
}
