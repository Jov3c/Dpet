import { advancePet, applyPetEvent, createPetState, PET_WIDTH, PET_HEIGHT } from "./pet-controller.mjs";
import { applyPetVisual } from "./pet-view.mjs";

const pet = document.querySelector("#pet");
const TUCK_MARGIN = 36;
const PEEK_WIDTH = 115;
const PEEK_HEIGHT = 38;

let theme;
let settings;
let area;
let state;
let dragging = false;
let lastFileDragOver = 0;
let justTuckedAt = 0;
let lastFrame = performance.now();
let lastTease = 0;
let lastSentMove;

function render() {
  applyPetVisual(pet, theme, state);
}

function moveWindow(position, force = false) {
  const normalized = {
    x: Math.round(position.x),
    y: Math.round(position.y),
    width: position.width ?? PET_WIDTH,
    height: position.height ?? PET_HEIGHT,
  };
  const signature = `${normalized.x}:${normalized.y}:${normalized.width}:${normalized.height}`;
  if (!force && signature === lastSentMove) return;
  lastSentMove = signature;
  window.petApi.move(position);
}

function syncPosition(force = false) {
  moveWindow({ x: state.x, y: state.y }, force);
}

function trigger(event) {
  const previousMode = state.mode;
  state = applyPetEvent(state, event);
  if (state.mode !== previousMode) window.petApi.recordActivity(state.mode);
  render();
}

function placePeek() {
  let x;
  let y;
  let width;
  let height;
  if (state.tuckedEdge === "bottom") {
    width = PEEK_WIDTH; height = PEEK_HEIGHT;
    x = state.x + PET_WIDTH / 2 - width / 2;
    y = area.height - height;
  } else if (state.tuckedEdge === "top") {
    width = PEEK_WIDTH; height = PEEK_HEIGHT;
    x = state.x + PET_WIDTH / 2 - width / 2;
    y = 0;
  } else if (state.tuckedEdge === "left") {
    width = PEEK_HEIGHT; height = PEEK_WIDTH;
    x = 0;
    y = state.y + PET_HEIGHT / 2 - height / 2;
  } else {
    width = PEEK_HEIGHT; height = PEEK_WIDTH;
    x = area.width - width;
    y = state.y + PET_HEIGHT / 2 - height / 2;
  }
  render();
  moveWindow({ x, y, width, height }, true);
}

function edgeForTuck() {
  const edges = [];
  if (state.x <= TUCK_MARGIN) edges.push("left");
  if (state.x >= area.width - PET_WIDTH - TUCK_MARGIN) edges.push("right");
  if (state.y <= TUCK_MARGIN) edges.push("top");
  if (state.y >= area.height - PET_HEIGHT - TUCK_MARGIN) edges.push("bottom");
  return edges.includes(settings.edgePreference) ? settings.edgePreference : edges[0] || null;
}

function tuck(edge) {
  trigger({ type: "tuck", edge });
  justTuckedAt = performance.now();
  placePeek();
}

function untuck() {
  const pad = 24;
  let { x, y } = state;
  let heading = 0;
  if (state.tuckedEdge === "top") { y = pad; heading = Math.PI / 2; }
  else if (state.tuckedEdge === "bottom") { y = area.height - PET_HEIGHT - pad; heading = -Math.PI / 2; }
  else if (state.tuckedEdge === "left") { x = pad; heading = 0; }
  else { x = area.width - PET_WIDTH - pad; heading = Math.PI; }
  state = createPetState({ x, y, heading, activityLevel: settings.activityLevel, quietMode: settings.quietMode });
  trigger({ type: "emerge" });
  syncPosition();
}

function animationFrame(now) {
  const deltaMs = Math.min(80, now - lastFrame);
  lastFrame = now;
  const fileHovering = performance.now() - lastFileDragOver < 400;
  if (!dragging && !fileHovering && state?.mode !== "tucked") {
    if (settings.autoWalk) {
      const previousMode = state.mode;
      state = advancePet(state, { viewport: area, deltaMs });
      if (state.mode !== previousMode) window.petApi.recordActivity(state.mode);
      render();
      syncPosition();
    }
  }
  requestAnimationFrame(animationFrame);
}

pet.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || state?.mode === "tucked" || !settings?.draggable) return;
  event.preventDefault();
  dragging = true;
  pet.setPointerCapture(event.pointerId);
  trigger({ type: "pointer-down", x: state.x, y: state.y });
});
pet.addEventListener("pointerenter", () => {
  if (state?.mode === "idle") trigger({ type: "wake" });
});
pet.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  trigger({ type: "pointer-drag", x: event.screenX - area.x - PET_WIDTH / 2, y: event.screenY - area.y - PET_HEIGHT / 2 });
  syncPosition();
});
pet.addEventListener("pointerup", (event) => {
  if (!dragging) return;
  dragging = false;
  pet.releasePointerCapture(event.pointerId);
  const edge = settings.edgeTuck ? edgeForTuck() : null;
  if (edge) tuck(edge);
  else trigger({ type: "pointer-up" });
});
pet.addEventListener("click", () => {
  if (state?.mode === "tucked") {
    if (performance.now() - justTuckedAt > 300) untuck();
    return;
  }
  if (!settings?.tease) return;
  const now = performance.now();
  if (now - lastTease < 420) {
    trigger({ type: "tease" });
  }
  lastTease = now;
});
pet.addEventListener("contextmenu", (event) => event.preventDefault());
pet.addEventListener("dragover", (event) => {
  event.preventDefault();
  if (!event.dataTransfer.types.includes("Files")) return;
  event.dataTransfer.dropEffect = "move";
  if (performance.now() - lastFileDragOver > 400) trigger({ type: "alert" });
  pet.classList.add("is-hungry");
  lastFileDragOver = performance.now();
});
pet.addEventListener("dragleave", () => pet.classList.remove("is-hungry"));
pet.addEventListener("drop", async (event) => {
  event.preventDefault();
  pet.classList.remove("is-hungry");
  const paths = [];
  for (const file of event.dataTransfer.files) {
    const filePath = window.petApi.getPathForFile(file);
    if (filePath) paths.push(filePath);
  }
  if (paths.length) window.petApi.openRecycleConfirmation(paths);
});
window.petApi.onRecycleComplete((count) => {
  if (count > 0) trigger({ type: "eat" });
});
window.petApi.onSettingsChanged((next) => {
  settings = next;
  state = { ...state, activityLevel: settings.activityLevel, quietMode: settings.quietMode };
});
async function boot() {
  [theme, settings, area] = await Promise.all([window.petApi.getTheme(), window.petApi.getSettings(), window.petApi.getWorkArea()]);
  state = createPetState({
    x: Math.round(area.width * 0.58),
    y: Math.round(area.height * 0.42),
    heading: Math.PI / 2,
    activityLevel: settings.activityLevel,
    quietMode: settings.quietMode
  });
  render();
  syncPosition();
  requestAnimationFrame(animationFrame);
}

boot();
