export function getPlayerBounds(width, height) {
  const compactPortrait = width <= 640 && height > width;
  const minX = 20;
  const maxX = width - 20;
  const minY = 30;
  const maxY = compactPortrait
    ? Math.max(minY, height - Math.max(260, height * 0.4))
    : height - 30;

  return {
    minX,
    maxX,
    minY,
    maxY,
    startX: width * 0.5,
    startY: compactPortrait ? Math.min(height * 0.66, maxY) : height * 0.78,
  };
}

function createDefaults(width, height) {
  const bounds = getPlayerBounds(width, height);
  return {
    x: bounds.startX,
    y: bounds.startY,
    speed: 320,
    focusSpeed: 160,
    radius: 6,
    hp: 5,
    invuln: 0,
    fireCooldown: 0,
    power: 1,
  };
}

export function createPlayerState(width, height) {
  return createDefaults(width, height);
}

export function resetPlayerState(player, width, height) {
  Object.assign(player, createDefaults(width, height));
  return player;
}
