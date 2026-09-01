const settingsTitle = document.querySelector("#settings-title");
const settingsKicker = document.querySelector("#settings-kicker");
const controls = Object.fromEntries([
  "autoWalk", "quietMode", "activityLevel", "draggable", "tease", "edgeTuck",
  "edgePreference", "rememberPosition", "alwaysOnTop", "activityLog"
].map((key) => [key, document.querySelector(`#${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`)]));
const recycleList = document.querySelector("#recycle-list");
const recycleEmptyHint = document.querySelector("#recycle-empty-hint");
const activityLogList = document.querySelector("#activity-log-list");
const activityLogEmpty = document.querySelector("#activity-log-empty");
let settings;

function syncControls() {
  for (const [key, control] of Object.entries(controls)) {
    if (!control) continue;
    if (control.tagName === "SELECT") control.value = settings[key];
    else control.checked = Boolean(settings[key]);
  }
}

async function persist(key) {
  const control = controls[key];
  const value = control.tagName === "SELECT" ? control.value : control.checked;
  settings = await window.petApi.setSettings({ [key]: value });
  syncControls();
  if (key === "activityLog") renderActivityLog();
}

function formatDate(value, short = false) {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-CN", short ? { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false } : { hour12: false });
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

async function renderRecycleList() {
  const [items, stats] = await Promise.all([window.petApi.listRecycleBin(), window.petApi.getRecycleStats()]);
  recycleEmptyHint.hidden = items.length > 0;
  document.querySelector("#recycle-count").textContent = String(stats.count);
  document.querySelector("#recycle-size").textContent = formatBytes(stats.bytes);
  document.querySelector("#recycle-last").textContent = formatDate(stats.lastRecycledAt, true);
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
    meta.textContent = formatDate(item.recycledAt, true);
    const restore = document.createElement("button");
    restore.className = "btn-small";
    restore.textContent = "恢复";
    restore.addEventListener("click", async () => { await window.petApi.restoreFile(item.id); renderRecycleList(); });
    row.append(name, meta, restore);
    recycleList.appendChild(row);
  }
}

async function renderActivityLog() {
  const records = await window.petApi.getActivityLog();
  activityLogList.innerHTML = "";
  activityLogEmpty.hidden = records.length > 0;
  for (const record of records.slice(0, 30)) {
    const row = document.createElement("li");
    const time = document.createElement("time");
    time.textContent = formatDate(record.at, true);
    const detail = document.createElement("span");
    detail.textContent = record.type;
    row.append(time, detail);
    activityLogList.appendChild(row);
  }
}

document.querySelector("#close-settings").addEventListener("click", () => window.petApi.closeSettings());
for (const [key, control] of Object.entries(controls)) control.addEventListener("change", () => persist(key));
for (const item of document.querySelectorAll(".sidebar-item")) {
  item.addEventListener("click", () => {
    document.querySelectorAll(".sidebar-item").forEach((other) => other.classList.toggle("is-active", other === item));
    document.querySelectorAll(".pane").forEach((pane) => pane.classList.toggle("is-active", pane.dataset.pane === item.dataset.pane));
    settingsTitle.textContent = item.textContent.replace(/^\d+/, "").trim();
    settingsKicker.textContent = item.dataset.pane.toUpperCase();
    if (item.dataset.pane === "recycle") renderRecycleList();
    if (item.dataset.pane === "records") renderActivityLog();
  });
}
document.querySelector("#empty-recycle").addEventListener("click", async () => {
  if (window.confirm("清空后将永久删除应用回收站里的文件，确定继续？")) {
    await window.petApi.emptyRecycleBin();
    renderRecycleList();
  }
});
document.querySelector("#refresh-log").addEventListener("click", renderActivityLog);
window.petApi.onSettingsChanged((next) => { settings = next; syncControls(); });
window.petApi.getSettings().then((value) => { settings = value; syncControls(); });
