export const PET_WIDTH = 100;
export const PET_HEIGHT = 150;
const EDGE_MARGIN = 8;
const WALK_SPEED = 52;
const TRANSIENT_DURATIONS = { grabbed: 520, dropped: 480, struggle: 850 };

export function createPetState({ x, y, heading = 0 }) {
  return {
    x,
    y,
    heading,
    velocity: { x: Math.cos(heading) * WALK_SPEED, y: Math.sin(heading) * WALK_SPEED },
    mode: "walk",
    transientUntil: 0,
  };
}

export function applyPetEvent(state, event) {
  if (event.type === "pointer-down") {
    return { ...state, mode: "grabbed", velocity: { x: 0, y: 0 }, transientUntil: Date.now() + TRANSIENT_DURATIONS.grabbed };
  }
  if (event.type === "pointer-drag") {
    return { ...state, x: event.x, y: event.y, mode: "dragged", velocity: { x: 0, y: 0 } };
  }
  if (event.type === "pointer-up") {
    return { ...state, mode: "dropped", transientUntil: Date.now() + TRANSIENT_DURATIONS.dropped };
  }
  if (event.type === "tease") {
    return { ...state, mode: "struggle", transientUntil: Date.now() + TRANSIENT_DURATIONS.struggle };
  }
  if (event.type === "tuck") {
    return { ...state, mode: "tucked", tuckedEdge: event.edge, velocity: { x: 0, y: 0 } };
  }
  return state;
}

export function advancePet(state, { viewport, deltaMs, random = Math.random }) {
  if (state.mode === "grabbed" || state.mode === "dragged" || state.mode === "tucked") return state;

  const now = Date.now();
  if (state.transientUntil > now) return state;
  const heading = state.heading + (random() - 0.5) * 0.12;
  const speed = WALK_SPEED;
  const seconds = deltaMs / 1000;
  return bounceInsideWorkArea({
    ...state,
    x: state.x + Math.cos(heading) * speed * seconds,
    y: state.y + Math.sin(heading) * speed * seconds,
    heading,
    mode: "walk",
    velocity: { x: Math.cos(heading) * speed, y: Math.sin(heading) * speed },
  }, viewport);
}

function bounceInsideWorkArea(state, viewport) {
  const maxX = viewport.width - PET_WIDTH - EDGE_MARGIN;
  const maxY = viewport.height - PET_HEIGHT - EDGE_MARGIN;
  let { x, y, heading } = state;
  if (x < EDGE_MARGIN) { x = EDGE_MARGIN; heading = Math.PI - heading; }
  else if (x > maxX) { x = maxX; heading = Math.PI - heading; }
  if (y < EDGE_MARGIN) { y = EDGE_MARGIN; heading = -heading; }
  else if (y > maxY) { y = maxY; heading = -heading; }
  const speed = Math.hypot(state.velocity.x, state.velocity.y);
  return { ...state, x, y, heading, velocity: { x: Math.cos(heading) * speed, y: Math.sin(heading) * speed } };
}
