function getDesktopHudRails(width) {
  return {
    left: Math.min(292, Math.max(228, width * 0.22)),
    right: Math.min(276, Math.max(216, width * 0.2)),
  };
}

export function getPlayerBounds(width, height) {
  const compactPortrait = width <= 640 && height > width;
  const tabletHud = width <= 980;
  const baseMarginX = 20;
  const minY = 30;
  const maxY = compactPortrait
    ? Math.max(minY, height - Math.max(260, height * 0.4))
    : height - (tabletHud ? Math.max(150, height * 0.22) : 30);
  const desktopRails = !compactPortrait && !tabletHud ? getDesktopHudRails(width) : null;
  const minX = desktopRails ? desktopRails.left + 34 : baseMarginX;
  const maxX = desktopRails ? width - desktopRails.right - 34 : width - baseMarginX;
  const startX = desktopRails ? minX + (maxX - minX) * 0.5 : width * 0.5;
  const startY = compactPortrait ? Math.min(height * 0.66, maxY) : Math.min(height * 0.82, maxY);

  return {
    minX,
    maxX,
    minY,
    maxY,
    startX,
    startY,
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
    weaponMode: "base",
    weaponLabel: "Standard",
    weaponTimer: 0,
    pendingBurst: false,
    burstCooldown: 0,
    burstLatch: false,
  };
}

export function createPlayerState(width, height) {
  return createDefaults(width, height);
}

export function resetPlayerState(player, width, height) {
  Object.assign(player, createDefaults(width, height));
  return player;
}
