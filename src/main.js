const { app, BrowserWindow, ipcMain, powerMonitor, globalShortcut, screen, Menu, Tray, nativeImage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { buildTrayMenu } = require("./main-menu");
const recycleBin = require("./recycle-bin");

let petWindow;
let tray;
let cpuTimer;
let lastCpuSample;
let isQuitting = false;
const PET_SIZE = { width: 95, height: 161 };
let petSize = PET_SIZE;
const SETTINGS_SIZE = { width: 380, height: 460 };
const DIALOG_SIZE = { width: 360, height: 230 };
const DEFAULT_SETTINGS = {
  autoWalk: true,
  draggable: true,
  avoidMouse: true,
  tease: true,
  edgeTuck: true,
  systemEvents: true,
  alwaysOnTop: true,
};

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function readSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(settingsPath(), "utf8")) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
}

function currentWorkArea() {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
}

function sendSystemEvent(type) {
  petWindow?.webContents.send("system-event", type);
}

function setPetWindowSize(size) {
  if (!petWindow) return;
  petSize = size;
  // No min/max lock: setBounds re-asserts the size on every move, which keeps
  // the window fixed on scaled-DPI displays and lets the peek window be small.
  petWindow.setSize(petSize.width, petSize.height, false);
  petWindow.setResizable(false);
}

// Center the current window on the display under the cursor.
function centerWindow() {
  if (!petWindow) return;
  const area = currentWorkArea();
  const bounds = petWindow.getBounds();
  petWindow.setBounds({
    x: Math.round(area.x + (area.width - bounds.width) / 2),
    y: Math.round(area.y + (area.height - bounds.height) / 2),
    width: bounds.width,
    height: bounds.height,
  });
}

function applyDisplayMode(settings) {
  if (!petWindow) return;
  petWindow.setAlwaysOnTop(Boolean(settings.alwaysOnTop), settings.alwaysOnTop ? "screen-saver" : undefined);
}

function openSettings() {
  if (!petWindow) return;
  setPetWindowSize(SETTINGS_SIZE);
  centerWindow();
  petWindow.showInactive();
  petWindow.webContents.send("open-settings");
}

function createTray() {
  const imagePath = path.join(app.getAppPath(), "assets", "roach-topdown", "states", "idle.png");
  const icon = nativeImage.createFromPath(imagePath).resize({ width: 32, height: 32 });
  tray = new Tray(icon);
  tray.setToolTip("蟑螂桌宠");
  tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenu({
    openSettings,
    quit: () => app.quit()
  })));
  tray.on("double-click", openSettings);
}

function createWindow() {
  petWindow = new BrowserWindow({
    width: PET_SIZE.width,
    height: PET_SIZE.height,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    resizable: false,
    useContentSize: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  petWindow.setAlwaysOnTop(true, "screen-saver");
  setPetWindowSize(PET_SIZE);
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // "Show Desktop" (Win+D) minimizes normal windows; the pet should stay on the
  // desktop, so restore it immediately whenever Windows minimizes it.
  petWindow.on("minimize", () => petWindow?.restore());
  petWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  petWindow.once("ready-to-show", () => petWindow?.showInactive());
}

function cpuSnapshot() {
  return os.cpus().reduce((total, cpu) => {
    total.idle += cpu.times.idle;
    total.total += Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
    return total;
  }, { idle: 0, total: 0 });
}

function monitorCpu() {
  lastCpuSample = cpuSnapshot();
  cpuTimer = setInterval(() => {
    const next = cpuSnapshot();
    const totalDelta = next.total - lastCpuSample.total;
    const idleDelta = next.idle - lastCpuSample.idle;
    lastCpuSample = next;
    if (totalDelta > 0 && 1 - idleDelta / totalDelta >= 0.85) sendSystemEvent("cpu-busy");
  }, 1800);
}

app.whenReady().then(() => {
  recycleBin.init();
  createWindow();
  createTray();
  monitorCpu();
  applyDisplayMode(readSettings());

  for (const eventName of ["suspend", "resume", "lock-screen", "unlock-screen", "on-ac", "on-battery"]) {
    powerMonitor.on(eventName, () => sendSystemEvent(eventName));
  }
  globalShortcut.register("Control+Shift+R", () => petWindow?.showInactive());
  globalShortcut.register("Control+Shift+H", () => petWindow?.hide());
});

ipcMain.handle("pet:get-theme", () => {
  const themeFile = path.join(app.getAppPath(), "assets", "roach-topdown", "theme.json");
  return JSON.parse(fs.readFileSync(themeFile, "utf8"));
});
ipcMain.handle("pet:get-settings", () => readSettings());
ipcMain.handle("pet:set-settings", (_event, partial) => {
  const next = { ...readSettings(), ...partial };
  saveSettings(next);
  if (typeof partial.alwaysOnTop === "boolean") applyDisplayMode(next);
  return next;
});
ipcMain.handle("pet:get-work-area", () => currentWorkArea());
ipcMain.handle("pet:get-cursor", () => screen.getCursorScreenPoint());
ipcMain.on("pet:move", (_event, position) => {
  if (!petWindow) return;
  const x = Math.round(Number(position.x));
  const y = Math.round(Number(position.y));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const width = Number.isFinite(position.width) ? Math.round(position.width) : petSize.width;
  const height = Number.isFinite(position.height) ? Math.round(position.height) : petSize.height;
  const area = currentWorkArea();
  // setBounds re-asserts the size with every move, so the window cannot drift
  // larger on scaled-DPI displays (setPosition alone grows ~1px per move).
  petWindow.setBounds({ x: area.x + x, y: area.y + y, width, height });
});
ipcMain.on("pet:hide", () => petWindow?.hide());
ipcMain.on("pet:show", () => petWindow?.showInactive());
ipcMain.on("pet:set-settings-open", (_event, open) => setPetWindowSize(open ? SETTINGS_SIZE : PET_SIZE));
ipcMain.on("pet:set-dialog-open", (_event, open) => {
  setPetWindowSize(open ? DIALOG_SIZE : PET_SIZE);
  if (open) centerWindow();
});

// Recycle bin: the roach "eats" dropped files by moving them into its own bin.
ipcMain.handle("pet:recycle-files", (_event, paths) => {
  if (!Array.isArray(paths)) return [];
  return recycleBin.recycleFiles(paths);
});
ipcMain.handle("pet:list-recycle-bin", () => recycleBin.listItems());
ipcMain.handle("pet:restore-file", (_event, id) => recycleBin.restoreFile(id));
ipcMain.handle("pet:empty-recycle-bin", () => recycleBin.emptyBin());

app.on("window-all-closed", (event) => {
  if (!isQuitting) event.preventDefault();
});
app.on("before-quit", () => {
  isQuitting = true;
  clearInterval(cpuTimer);
  tray?.destroy();
});
app.on("will-quit", () => globalShortcut.unregisterAll());
