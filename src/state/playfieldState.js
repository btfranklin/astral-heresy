const BASE_MARGIN_X = 20;
const MIN_Y = 30;
const DESKTOP_PLAYER_MARGIN_X = 34;
const DESKTOP_RAIL_LEFT_MIN = 228;
const DESKTOP_RAIL_LEFT_MAX = 292;
const DESKTOP_RAIL_RIGHT_MIN = 216;
const DESKTOP_RAIL_RIGHT_MAX = 276;
const ENEMY_ENTRY_PADDING = 54;
const BULLET_LANE_MARGIN = 72;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getDesktopHudRails(width) {
  return {
    left: Math.min(DESKTOP_RAIL_LEFT_MAX, Math.max(DESKTOP_RAIL_LEFT_MIN, width * 0.22)),
    right: Math.min(DESKTOP_RAIL_RIGHT_MAX, Math.max(DESKTOP_RAIL_RIGHT_MIN, width * 0.2)),
  };
}

function buildVerticalBounds(width, height, compactPortrait, tabletHud) {
  const maxY = compactPortrait
    ? Math.max(MIN_Y, height - Math.max(260, height * 0.4))
    : height - (tabletHud ? Math.max(150, height * 0.22) : 30);
  return { minY: MIN_Y, maxY };
}

export function createPlayfield(width, height) {
  const compactPortrait = width <= 640 && height > width;
  const tabletHud = width <= 980;
  const active = !compactPortrait && !tabletHud;
  const rails = active ? getDesktopHudRails(width) : { left: 0, right: 0 };
  const vertical = buildVerticalBounds(width, height, compactPortrait, tabletHud);
  const minX = active ? rails.left + DESKTOP_PLAYER_MARGIN_X : BASE_MARGIN_X;
  const maxX = active ? width - rails.right - DESKTOP_PLAYER_MARGIN_X : width - BASE_MARGIN_X;

  return {
    active,
    compactPortrait,
    tabletHud,
    minX,
    maxX,
    minY: vertical.minY,
    maxY: vertical.maxY,
    leftBayWidth: rails.left,
    rightBayWidth: rails.right,
  };
}

export function getPlayfieldCenter(playfield) {
  return playfield.minX + (playfield.maxX - playfield.minX) * 0.5;
}

export function laneX(playfield, fraction) {
  return playfield.minX + (playfield.maxX - playfield.minX) * fraction;
}

export function randomLaneX(playfield, padding = 0) {
  const min = playfield.minX + padding;
  const max = playfield.maxX - padding;
  return min + Math.random() * Math.max(1, max - min);
}

export function clampToLane(playfield, x, padding = 0) {
  return clamp(x, playfield.minX + padding, playfield.maxX - padding);
}

export function clampToEnemyEnvelope(playfield, x, padding = ENEMY_ENTRY_PADDING) {
  if (!playfield.active) {
    return x;
  }
  return clamp(x, playfield.minX - padding, playfield.maxX + padding);
}

export function createPlayfieldContext(state) {
  return {
    get active() {
      return state.playfield.active;
    },
    get leftEdge() {
      return state.playfield.minX;
    },
    get rightEdge() {
      return state.playfield.maxX;
    },
    get minY() {
      return state.playfield.minY;
    },
    get maxY() {
      return state.playfield.maxY;
    },
    laneX(fraction) {
      return laneX(state.playfield, fraction);
    },
    randomX(padding = 0) {
      return randomLaneX(state.playfield, padding);
    },
    clampX(x, padding = 0) {
      return clampToLane(state.playfield, x, padding);
    },
  };
}

export function getBulletEnvelope(playfield, viewWidth, margin = BULLET_LANE_MARGIN) {
  if (!playfield.active) {
    return {
      minX: -80,
      maxX: viewWidth + 80,
    };
  }
  return {
    minX: playfield.minX - margin,
    maxX: playfield.maxX + margin,
  };
}
