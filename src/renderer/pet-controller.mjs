export const PET_WIDTH = 100;
export const PET_HEIGHT = 150;
const EDGE_MARGIN = 8;
const WALK_SPEED = 52;
const TRANSIENT_DURATIONS = { grabbed: 520, dropped: 480, struggle: 850 };
const TURN_DURATION = 300;
const REST_INTERVAL = { min: 3500, span: 3500 };

export function createPetState({ x, y, heading = 0 }) {
  return {
    x,
    y,
    heading,
    velocity: { x: Math.cos(heading) * WALK_SPEED, y: Math.sin(heading) * WALK_SPEED },
    mode: "walk",
    transientUntil: 0,
    nextRestAt: Date.now() + REST_INTERVAL.min,
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
  if (event.type === "wake" && (state.mode === "sleep" || state.mode === "groom")) {
    return {
      ...state,
      mode: "walk",
      velocity: { x: Math.cos(state.heading) * WALK_SPEED, y: Math.sin(state.heading) * WALK_SPEED },
      nextRestAt: Date.now() + REST_INTERVAL.min,
    };
  }
  if (event.type === "tuck") {
    return { ...state, mode: "tucked", tuckedEdge: event.edge, velocity: { x: 0, y: 0 } };
  }
  return state;
}

export function advancePet(state, { viewport, deltaMs, random = Math.random }) {
  if (["grabbed", "dragged", "tucked", "sleep", "groom"].includes(state.mode)) return state;

  const now = Date.now();
  if (state.transientUntil > now) return state;
  if (now >= state.nextRestAt) {
    return {
      ...state,
      mode: random() < 0.65 ? "sleep" : "groom",
      velocity: { x: 0, y: 0 },
      nextRestAt: now + REST_INTERVAL.min + random() * REST_INTERVAL.span,
    };
  }
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
  }, viewport, now);
}

function bounceInsideWorkArea(state, viewport, now) {
  const maxX = viewport.width - PET_WIDTH - EDGE_MARGIN;
  const maxY = viewport.height - PET_HEIGHT - EDGE_MARGIN;
  let { x, y, heading } = state;
  let turned = false;
  if (x < EDGE_MARGIN) { x = EDGE_MARGIN; heading = Math.PI - heading; turned = true; }
  else if (x > maxX) { x = maxX; heading = Math.PI - heading; turned = true; }
  if (y < EDGE_MARGIN) { y = EDGE_MARGIN; heading = -heading; turned = true; }
  else if (y > maxY) { y = maxY; heading = -heading; turned = true; }
  const speed = Math.hypot(state.velocity.x, state.velocity.y);
  return {
    ...state,
    x,
    y,
    heading,
    mode: turned ? "turn" : state.mode,
    transientUntil: turned ? now + TURN_DURATION : state.transientUntil,
    velocity: { x: Math.cos(heading) * speed, y: Math.sin(heading) * speed }
  };
}
