export const PET_WIDTH = 95;
export const PET_HEIGHT = 161;
const APPROACH_RADIUS = 170;
const EDGE_MARGIN = 8;
const WALK_SPEED = 30;
const FLEE_SPEED = 280;
const WAKE_RADIUS = 70;

export function createPetState({ x, y, heading = 0 }) {
  return {
    x,
    y,
    heading,
    velocity: { x: Math.cos(heading) * WALK_SPEED, y: Math.sin(heading) * WALK_SPEED },
    mode: "walk",
    hidden: false,
    transientUntil: 0,
    awakeUntil: Date.now() + 15000,
  };
}

export function applyPetEvent(state, event) {
  if (event.type === "pointer-down") {
    return { ...state, mode: "grabbed", velocity: { x: 0, y: 0 }, hidden: false, transientUntil: Date.now() + 520 };
  }
  if (event.type === "pointer-drag") {
    return { ...state, x: event.x, y: event.y, mode: "dragged", velocity: { x: 0, y: 0 }, hidden: false };
  }
  if (event.type === "pointer-up") {
    return { ...state, mode: "dropped", transientUntil: Date.now() + 480 };
  }
  if (event.type === "tease") {
    return { ...state, mode: "struggle", transientUntil: Date.now() + 850 };
  }
  if (event.type === "system-alert") {
    return { ...state, mode: "alert", transientUntil: Date.now() + 850 };
  }
  if (event.type === "tuck") {
    return { ...state, mode: "tucked", tuckedEdge: event.edge, velocity: { x: 0, y: 0 }, hidden: false };
  }
  if (event.type === "untuck") {
    return {
      ...state,
      mode: "walk",
      tuckedEdge: null,
      velocity: { x: Math.cos(state.heading) * WALK_SPEED, y: Math.sin(state.heading) * WALK_SPEED },
    };
  }
  return state;
}

export function advancePet(state, { viewport, cursor, deltaMs, random = Math.random, avoidMouse = true }) {
  if (state.mode === "grabbed" || state.mode === "dragged" || state.mode === "tucked") return state;

  const now = Date.now();

  // Dormant: stay completely still until the mouse comes near, then wake up.
  if (state.mode === "sleeping") {
    if (isMouseNear(state, cursor, WAKE_RADIUS)) {
      return {
        ...state,
        mode: "walk",
        awakeUntil: now + 15000 + random() * 20000,
        velocity: { x: Math.cos(state.heading) * WALK_SPEED, y: Math.sin(state.heading) * WALK_SPEED },
      };
    }
    return state;
  }

  const halfWidth = PET_WIDTH / 2;
  const halfHeight = PET_HEIGHT / 2;
  const centerX = state.x + halfWidth;
  const centerY = state.y + halfHeight;
  const dx = centerX - cursor.x;
  const dy = centerY - cursor.y;
  const distance = Math.hypot(dx, dy);
  if (avoidMouse && distance < APPROACH_RADIUS) {
    const safeDistance = Math.max(distance, 1);
    const heading = Math.atan2(dy, dx);
    return bounceOffWalls({
      ...state,
      mode: "flee",
      heading,
      velocity: { x: (dx / safeDistance) * FLEE_SPEED, y: (dy / safeDistance) * FLEE_SPEED },
    }, viewport);
  }

  if (state.transientUntil > now) return state;
  const heading = state.mode === "flee" ? state.heading : state.heading + (random() - 0.5) * 0.12;
  const speed = state.mode === "flee" ? FLEE_SPEED : WALK_SPEED;
  const seconds = deltaMs / 1000;
  const moved = bounceOffWalls({
    ...state,
    x: state.x + Math.cos(heading) * speed * seconds,
    y: state.y + Math.sin(heading) * speed * seconds,
    heading,
    mode: "walk",
    velocity: { x: Math.cos(heading) * speed, y: Math.sin(heading) * speed },
  }, viewport);

  // Occasionally fall dormant (only when the mouse is away and the pet has been
  // awake long enough): completely still until the mouse comes near.
  if (moved.mode === "walk" && !isMouseNear(moved, cursor, APPROACH_RADIUS)
    && now >= moved.awakeUntil && random() < 0.01) {
    return { ...moved, mode: "sleeping", velocity: { x: 0, y: 0 } };
  }
  return moved;
}

function isMouseNear(state, cursor, radius) {
  const cx = state.x + PET_WIDTH / 2;
  const cy = state.y + PET_HEIGHT / 2;
  return Math.hypot(cx - cursor.x, cy - cursor.y) < radius;
}

// Reflect the heading off the screen edge so the pet keeps moving along a
// continuous path instead of teleporting to the opposite side.
function bounceOffWalls(state, viewport) {
  const maxX = viewport.width - PET_WIDTH;
  const maxY = viewport.height - PET_HEIGHT;
  let { x, y, heading } = state;
  if (x < EDGE_MARGIN) { x = EDGE_MARGIN; heading = Math.PI - heading; }
  else if (x > maxX - EDGE_MARGIN) { x = maxX - EDGE_MARGIN; heading = Math.PI - heading; }
  if (y < EDGE_MARGIN) { y = EDGE_MARGIN; heading = -heading; }
  else if (y > maxY - EDGE_MARGIN) { y = maxY - EDGE_MARGIN; heading = -heading; }
  const speed = Math.hypot(state.velocity.x, state.velocity.y) || WALK_SPEED;
  return { ...state, x, y, heading, velocity: { x: Math.cos(heading) * speed, y: Math.sin(heading) * speed } };
}
