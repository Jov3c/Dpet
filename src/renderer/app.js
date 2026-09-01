import { advancePet, applyPetEvent, createPetState, PET_WIDTH, PET_HEIGHT } from "./pet-controller.mjs";
import { applyPetVisual } from "./pet-view.mjs";

const pet = document.querySelector("#pet");
const confirmDialog = document.querySelector("#confirm-dialog");
const confirmCount = document.querySelector("#confirm-count");
const confirmList = document.querySelector("#confirm-list");
const confirmOk = document.querySelector("#confirm-ok");
const confirmCancel = document.querySelector("#confirm-cancel");

const TUCK_MARGIN = 40;
// Must match assets/roach-topdown/animations/peek-115x38.apng
const PEEK_WIDTH = 115;
const PEEK_HEIGHT = 38;

let theme;
let settings;
let area;
let state;
let dragging = false;
let dialogOpen = false;
let lastFileDragOver = 0;
let pendingPaths = [];
let activePointerId = null;
let justTuckedAt = 0;
let lastFrame = performance.now();
let lastCursor = { x: -1000, y: -1000 };
let lastCursorRead = 0;
let lastTease = 0;

function render() {
  applyPetVisual(pet, theme, state);
}

function syncPosition() {
  window.petApi.move({ x: state.x, y: state.y });
}

function trigger(event) {
  state = applyPetEvent(state, event);
  render();
}

// Move the small peek window to the screen edge the pet tucked into, so only
// the antennae remain visible. The window is intentionally tiny so it does
// not swallow clicks over an empty transparent strip.
function placePeek() {
  const w = PEEK_WIDTH;
  const h = PEEK_HEIGHT;
  let x;
  let y;
  let width;
  let height;
  if (state.tuckedEdge === "bottom") {
    width = w; height = h;
    x = state.x + PET_WIDTH / 2 - w / 2;
    y = area.height - h;
  } else if (state.tuckedEdge === "top") {
    width = w; height = h;
    x = state.x + PET_WIDTH / 2 - w / 2;
    y = 0;
  } else if (state.tuckedEdge === "left") {
    width = h; height = w;
    x = 0;
    y = state.y + PET_HEIGHT / 2 - w / 2;
  } else {
    width = h; height = w;
    x = area.width - h;
    y = state.y + PET_HEIGHT / 2 - w / 2;
  }
  render();
  window.petApi.move({ x, y, width, height });
}

function tuck(edge) {
  if (state.mode === "tucked") return;
  state = applyPetEvent(state, { type: "tuck", edge });
  dragging = false;
  if (activePointerId != null) {
    try { pet.releasePointerCapture(activePointerId); } catch { /* already released */ }
    activePointerId = null;
  }
  justTuckedAt = performance.now();
  placePeek();
}

function untuck() {
  const edge = state.tuckedEdge;
  const pad = 24;
  let x = state.x;
  let y = state.y;
  let heading = 0;
  if (edge === "top") { y = pad; heading = Math.PI / 2; }
  else if (edge === "bottom") { y = area.height - PET_HEIGHT - pad; heading = -Math.PI / 2; }
  else if (edge === "left") { x = pad; heading = 0; }
  else { x = area.width - PET_WIDTH - pad; heading = Math.PI; }
  state = createPetState({ x, y, heading });
  render();
  syncPosition();
}

// The edge the pet currently hugs, or null. Only checked on release, so the
// pet tucks in only after the user drags it to an edge and lets go.
function edgeForTuck() {
  if (state.x <= TUCK_MARGIN) return "left";
  if (state.x >= area.width - PET_WIDTH - TUCK_MARGIN) return "right";
  if (state.y <= TUCK_MARGIN) return "top";
  if (state.y >= area.height - PET_HEIGHT - TUCK_MARGIN) return "bottom";
  return null;
}

function showConfirmDialog(paths) {
  pendingPaths = paths;
  confirmCount.textContent = `${paths.length} 个文件 / 文件夹`;
  confirmList.innerHTML = "";
  for (const p of paths.slice(0, 8)) {
    const li = document.createElement("li");
    li.textContent = p.split(/[\\/]/).pop();
    li.title = p;
    confirmList.appendChild(li);
  }
  if (paths.length > 8) {
    const li = document.createElement("li");
    li.textContent = `… 还有 ${paths.length - 8} 个`;
    confirmList.appendChild(li);
  }
  dialogOpen = true;
  window.petApi.setDialogOpen(true);
  confirmDialog.classList.add("is-active");
  pet.hidden = true;
}

function closeConfirmDialog() {
  dialogOpen = false;
  confirmDialog.classList.remove("is-active");
  pet.hidden = false;
  pendingPaths = [];
  confirmOk.disabled = false;
  window.petApi.setDialogOpen(false);
}

async function confirmRecycle() {
  const results = await window.petApi.recycleFiles(pendingPaths);
  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;
  confirmList.innerHTML = "";
  const li = document.createElement("li");
  li.textContent = `已吃掉 ${ok} 个${fail ? `，${fail} 个失败` : ""}`;
  confirmList.appendChild(li);
  confirmOk.disabled = true;
  setTimeout(closeConfirmDialog, 1000);
}

async function animationFrame(now) {
  try {
    const deltaMs = Math.min(80, now - lastFrame);
    lastFrame = now;
    const fileHovering = performance.now() - lastFileDragOver < 400;
    if (!dragging && !dialogOpen && !fileHovering && state?.mode !== "tucked") {
      if (settings.autoWalk) {
        if (now - lastCursorRead > 80) {
          const screenPoint = await window.petApi.getCursor();
          lastCursor = { x: screenPoint.x - area.x, y: screenPoint.y - area.y };
          lastCursorRead = now;
        }
        // Always pass the real cursor so a dormant pet can wake when the mouse
        // comes near; fleeing is gated separately by avoidMouse.
        state = advancePet(state, { viewport: area, cursor: lastCursor, deltaMs, avoidMouse: settings.avoidMouse });
      }
      render();
      syncPosition();
    }
  } catch (error) {
    console.error(error);
  }
  requestAnimationFrame(animationFrame);
}

pet.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  if (state?.mode === "tucked") return;
  if (!settings?.draggable) return;
  event.preventDefault();
  dragging = true;
  activePointerId = event.pointerId;
  pet.setPointerCapture(event.pointerId);
  trigger({ type: "pointer-down", x: state.x, y: state.y });
});

pet.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  trigger({
    type: "pointer-drag",
    x: event.screenX - area.x - Math.round(PET_WIDTH / 2),
    y: event.screenY - area.y - Math.round(PET_HEIGHT / 2),
  });
  syncPosition();
});

pet.addEventListener("pointerup", (event) => {
  if (!dragging) return;
  dragging = false;
  activePointerId = null;
  pet.releasePointerCapture(event.pointerId);
  // Hide into the edge only when released there (and the feature is on);
  // otherwise drop normally.
  const edge = settings.edgeTuck ? edgeForTuck() : null;
  if (edge) tuck(edge);
  else trigger({ type: "pointer-up" });
});

pet.addEventListener("click", () => {
  if (state?.mode === "tucked") {
    if (performance.now() - justTuckedAt < 350) return;
    untuck();
    return;
  }
  if (!settings.tease) return;
  const now = performance.now();
  if (now - lastTease < 420) trigger({ type: "tease" });
  lastTease = now;
});

pet.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

// Recycle bin: dragging a file or folder onto the pet asks for confirmation,
// then the pet "eats" it (moves it into the app's recycle bin). While a file
// hovers over it the pet freezes in place so the drop lands reliably.
pet.addEventListener("dragover", (event) => {
  event.preventDefault();
  if (!event.dataTransfer.types.includes("Files")) return;
  event.dataTransfer.dropEffect = "move";
  pet.classList.add("is-hungry");
  lastFileDragOver = performance.now();
});
pet.addEventListener("dragleave", () => {
  pet.classList.remove("is-hungry");
});
pet.addEventListener("drop", async (event) => {
  event.preventDefault();
  pet.classList.remove("is-hungry");
  const paths = [];
  for (const file of event.dataTransfer.files) {
    const p = await window.petApi.getPathForFile(file);
    if (p) paths.push(p);
  }
  if (paths.length === 0) return;
  showConfirmDialog(paths);
});

confirmOk.addEventListener("click", confirmRecycle);
confirmCancel.addEventListener("click", closeConfirmDialog);

window.petApi.onSystemEvent((event) => {
  if (!settings.systemEvents) return;
  if (event === "lock-screen" || event === "suspend") window.petApi.hide();
  if (event === "unlock-screen" || event === "resume") {
    window.petApi.show();
    trigger({ type: "system-alert" });
  }
  if (["on-ac", "on-battery", "cpu-busy"].includes(event)) trigger({ type: "system-alert" });
});

async function boot() {
  [theme, settings, area] = await Promise.all([
    window.petApi.getTheme(),
    window.petApi.getSettings(),
    window.petApi.getWorkArea()
  ]);
  state = createPetState({ x: Math.round(area.width * 0.58), y: Math.round(area.height * 0.42), heading: Math.PI / 2 });
  render();
  syncPosition();
  requestAnimationFrame(animationFrame);
}

boot();
