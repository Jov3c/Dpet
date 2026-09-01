export const PET_WIDTH = 100;
export const PET_HEIGHT = 150;
const EDGE_MARGIN = 8;
const WALK_SPEED = 52;
const TRANSIENT_DURATIONS = { grabbed: 520, dropped: 480, struggle: 850, emerge: 520, eat: 850, alert: 520 };
const TURN_DURATION = 300;

const ACTIVITY_PROFILES = {
  lazy: { walkMin: 3500, walkSpan: 3500 },
  normal: { walkMin: 8000, walkSpan: 5000 },
  active: { walkMin: 14000, walkSpan: 8000 },
};

function activityProfile(level) {
  return ACTIVITY_PROFILES[level] || ACTIVITY_PROFILES.lazy;
}

function nextRestTime(level, random = Math.random) {
  const profile = activityProfile(level);
  return Date.now() + profile.walkMin + random() * profile.walkSpan;
}

export function createPetState({ x, y, heading = 0, activityLevel = "lazy", quietMode = false }) {
  return {
    x,
    y,
    heading,
    velocity: { x: Math.cos(heading) * WALK_SPEED, y: Math.sin(heading) * WALK_SPEED },
    mode: "walk",
    transientUntil: 0,
    activityLevel,
    quietMode,
    nextRestAt: quietMode ? 0 : nextRestTime(activityLevel),
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
  if (event.type === "alert") {
    return { ...state, mode: "alert", velocity: { x: 0, y: 0 }, transientUntil: Date.now() + TRANSIENT_DURATIONS.alert };
  }
  if (event.type === "eat") {
    return { ...state, mode: "eat", velocity: { x: 0, y: 0 }, transientUntil: Date.now() + TRANSIENT_DURATIONS.eat };
  }
  if (event.type === "emerge") {
    return { ...state, mode: "emerge", transientUntil: Date.now() + TRANSIENT_DURATIONS.emerge };
  }
  if (event.type === "wake" && state.mode === "idle") {
    return {
      ...state,
      mode: "walk",
      velocity: { x: Math.cos(state.heading) * WALK_SPEED, y: Math.sin(state.heading) * WALK_SPEED },
      nextRestAt: nextRestTime(state.activityLevel),
    };
  }
  if (event.type === "tuck") {
    return { ...state, mode: "tucked", tuckedEdge: event.edge, velocity: { x: 0, y: 0 } };
  }
  return state;
}

export function advancePet(state, { viewport, deltaMs, random = Math.random }) {
  if (["grabbed", "dragged", "tucked", "idle"].includes(state.mode)) return state;

  const now = Date.now();
  if (state.transientUntil > now) return state;
  if (state.quietMode || now >= state.nextRestAt) {
    return {
      ...state,
      mode: "idle",
      velocity: { x: 0, y: 0 },
      nextRestAt: nextRestTime(state.activityLevel, random),
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
