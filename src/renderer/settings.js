const settingsTitle = document.querySelector("#settings-title");
const controls = Object.fromEntries([
  "autoWalk", "draggable", "tease", "edgeTuck", "alwaysOnTop"
].map((key) => [key, document.querySelector(`#${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`)]));
const recycleList = document.querySelector("#recycle-list");
const recycleEmptyHint = document.querySelector("#recycle-empty-hint");
let settings;

function syncControls() {
  for (const [key, control] of Object.entries(controls)) control.checked = Boolean(settings[key]);
}

async function persist(key) {
  settings = await window.petApi.setSettings({ [key]: controls[key].checked });
  syncControls();
}

function formatDate(value) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
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
    restore.addEventListener("click", async () => { await window.petApi.restoreFile(item.id); renderRecycleList(); });
    row.append(name, meta, restore);
    recycleList.appendChild(row);
  }
}

document.querySelector("#close-settings").addEventListener("click", () => window.petApi.closeSettings());
for (const [key, control] of Object.entries(controls)) control.addEventListener("change", () => persist(key));
for (const item of document.querySelectorAll(".sidebar-item")) {
  item.addEventListener("click", () => {
    document.querySelectorAll(".sidebar-item").forEach((other) => other.classList.toggle("is-active", other === item));
    document.querySelectorAll(".pane").forEach((pane) => pane.classList.toggle("is-active", pane.dataset.pane === item.dataset.pane));
    settingsTitle.textContent = item.textContent;
    if (item.dataset.pane === "recycle") renderRecycleList();
  });
}
document.querySelector("#empty-recycle").addEventListener("click", async () => {
  if (window.confirm("清空后将永久删除回收站里的文件，确定继续？")) {
    await window.petApi.emptyRecycleBin();
    renderRecycleList();
  }
});

window.petApi.getSettings().then((value) => { settings = value; syncControls(); });
