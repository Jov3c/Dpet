const settingsTitle = document.querySelector("#settings-title");
const autoWalkInput = document.querySelector("#auto-walk");
const draggableInput = document.querySelector("#draggable");
const avoidMouseInput = document.querySelector("#avoid-mouse");
const teaseInput = document.querySelector("#tease");
const edgeTuckInput = document.querySelector("#edge-tuck");
const alwaysOnTopInput = document.querySelector("#always-on-top");
const systemEventsInput = document.querySelector("#system-events");
const recycleList = document.querySelector("#recycle-list");
const recycleEmptyHint = document.querySelector("#recycle-empty-hint");
const emptyRecycle = document.querySelector("#empty-recycle");

let settings;

function syncCheckboxes() {
  autoWalkInput.checked = settings.autoWalk;
  draggableInput.checked = settings.draggable;
  avoidMouseInput.checked = settings.avoidMouse;
  teaseInput.checked = settings.tease;
  edgeTuckInput.checked = settings.edgeTuck;
  alwaysOnTopInput.checked = settings.alwaysOnTop;
  systemEventsInput.checked = settings.systemEvents;
}

async function persistSettings(partial) {
  settings = await window.petApi.setSettings(partial);
  syncCheckboxes();
}

function formatDate(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function renderRecycleList() {
  const items = await window.petApi.listRecycleBin();
  recycleEmptyHint.hidden = items.length > 0;
  recycleList.innerHTML = "";
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "recycle-item";
    const name = document.createElement("span");
    name.className = "item-name";
    name.textContent = item.name;
    name.title = item.originalPath;
    const meta = document.createElement("span");
    meta.className = "item-meta";
    meta.textContent = formatDate(item.recycledAt);
    const restore = document.createElement("button");
    restore.className = "btn-small";
    restore.textContent = "恢复";
    restore.addEventListener("click", async () => {
      await window.petApi.restoreFile(item.id);
      await renderRecycleList();
    });
    row.append(name, meta, restore);
    recycleList.appendChild(row);
  }
}

document.querySelector("#close-settings").addEventListener("click", () => window.petApi.closeSettings());

// Left sidebar: switch which settings pane is shown in the center.
for (const item of document.querySelectorAll(".sidebar-item")) {
  item.addEventListener("click", () => {
    for (const other of document.querySelectorAll(".sidebar-item")) {
      other.classList.toggle("is-active", other === item);
    }
    for (const pane of document.querySelectorAll(".pane")) {
      pane.classList.toggle("is-active", pane.dataset.pane === item.dataset.pane);
    }
    settingsTitle.textContent = item.textContent;
    if (item.dataset.pane === "recycle") renderRecycleList();
  });
}

autoWalkInput.addEventListener("change", () => persistSettings({ autoWalk: autoWalkInput.checked }));
draggableInput.addEventListener("change", () => persistSettings({ draggable: draggableInput.checked }));
avoidMouseInput.addEventListener("change", () => persistSettings({ avoidMouse: avoidMouseInput.checked }));
teaseInput.addEventListener("change", () => persistSettings({ tease: teaseInput.checked }));
edgeTuckInput.addEventListener("change", () => persistSettings({ edgeTuck: edgeTuckInput.checked }));
alwaysOnTopInput.addEventListener("change", () => persistSettings({ alwaysOnTop: alwaysOnTopInput.checked }));
systemEventsInput.addEventListener("change", () => persistSettings({ systemEvents: systemEventsInput.checked }));

emptyRecycle.addEventListener("click", async () => {
  await window.petApi.emptyRecycleBin();
  await renderRecycleList();
});

async function boot() {
  settings = await window.petApi.getSettings();
  syncCheckboxes();
}

boot();
