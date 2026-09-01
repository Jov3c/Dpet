const { app, BrowserWindow, ipcMain, screen, Menu, Tray, nativeImage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { buildTrayMenu } = require("./main-menu");
const recycleBin = require("./recycle-bin");

let petWindow;
let settingsWindow;
let confirmWindow;
let tray;
let isQuitting = false;
let positionSaveTimer;
const PET_SIZE = { width: 100, height: 150 };
const SETTINGS_SIZE = { width: 460, height: 580 };
const CONFIRM_SIZE = { width: 380, height: 260 };
let recycleConfirmationPaths = [];
const DEFAULT_SETTINGS = {
  autoWalk: true,
  draggable: true,
  tease: true,
  edgeTuck: true,
  alwaysOnTop: true,
  activityLevel: "lazy",
  quietMode: false,
  rememberPosition: true,
  edgePreference: "any",
  activityLog: false,
  lastPosition: null
};

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function readSettings() {
  try {
    return normalizeSettings(JSON.parse(fs.readFileSync(settingsPath(), "utf8")));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function normalizeSettings(candidate = {}) {
  const input = candidate && typeof candidate === "object" ? candidate : {};
  const booleans = ["autoWalk", "draggable", "tease", "edgeTuck", "alwaysOnTop", "quietMode", "rememberPosition", "activityLog"];
  const activityLevel = ["lazy", "normal", "active"].includes(input.activityLevel) ? input.activityLevel : DEFAULT_SETTINGS.activityLevel;
  const edgePreference = ["any", "left", "right", "top", "bottom"].includes(input.edgePreference) ? input.edgePreference : DEFAULT_SETTINGS.edgePreference;
  const position = input.lastPosition;
  const lastPosition = position && Number.isFinite(position.x) && Number.isFinite(position.y)
    ? { x: Math.round(position.x), y: Math.round(position.y) }
    : null;
  return {
    ...Object.fromEntries(booleans.map((key) => [key, typeof input[key] === "boolean" ? input[key] : DEFAULT_SETTINGS[key]])),
    activityLevel,
    edgePreference,
    lastPosition
  };
}

function saveSettings(settings) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
}

function currentWorkArea() {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
}

function activityLogPath() {
  return path.join(app.getPath("userData"), "activity.log");
}

function recordActivity(type) {
  if (!readSettings().activityLog) return;
  fs.appendFileSync(activityLogPath(), `${new Date().toISOString()}\t${type}\n`);
}

function readActivityLog() {
  try {
    return fs.readFileSync(activityLogPath(), "utf8").trim().split("\n").filter(Boolean).slice(-50).reverse().map((line) => {
      const [at, ...parts] = line.split("\t");
      return { at, type: parts.join("\t") || "状态变化" };
    });
  } catch {
    return [];
  }
}

function setPetWindowSize(size = PET_SIZE) {
  if (!petWindow) return;
  const { x, y } = petWindow.getBounds();
  petWindow.setBounds({ x, y, width: size.width, height: size.height }, false);
  petWindow.setResizable(false);
}

function restorePetPosition(settings) {
  if (!petWindow || !settings.rememberPosition || !settings.lastPosition) return;
  const area = currentWorkArea();
  const x = Math.min(Math.max(settings.lastPosition.x, 0), area.width - PET_SIZE.width);
  const y = Math.min(Math.max(settings.lastPosition.y, 0), area.height - PET_SIZE.height);
  petWindow.setBounds({ x: area.x + x, y: area.y + y, width: PET_SIZE.width, height: PET_SIZE.height }, false);
}

function savePetPosition(position) {
  const settings = readSettings();
  if (!settings.rememberPosition) return;
  clearTimeout(positionSaveTimer);
  positionSaveTimer = setTimeout(() => saveSettings({ ...settings, lastPosition: { x: Math.round(position.x), y: Math.round(position.y) } }), 400);
}

function centerWindow(window) {
  if (!window || window.isDestroyed()) return;
  const area = currentWorkArea();
  const bounds = window.getBounds();
  window.setBounds({
    x: Math.round(area.x + (area.width - bounds.width) / 2),
    y: Math.round(area.y + (area.height - bounds.height) / 2),
    width: bounds.width,
    height: bounds.height
  });
}

function applyDisplayMode(settings) {
  if (!petWindow) return;
  if (settings.alwaysOnTop) {
    petWindow.setAlwaysOnTop(true, "screen-saver");
    return;
  }
  petWindow.setAlwaysOnTop(false);
  // A normal-level pet should still remain above the Explorer desktop after the setting changes.
  petWindow.showInactive();
  petWindow.moveTop();
}

function openSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    centerWindow(settingsWindow);
    settingsWindow.showInactive();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: SETTINGS_SIZE.width,
    height: SETTINGS_SIZE.height,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    useContentSize: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  settingsWindow.setAlwaysOnTop(true, "floating");
  settingsWindow.loadFile(path.join(__dirname, "renderer", "settings.html"));
  settingsWindow.once("ready-to-show", () => {
    centerWindow(settingsWindow);
    settingsWindow?.showInactive();
  });
}

function createRecycleConfirmation(paths) {
  if (confirmWindow && !confirmWindow.isDestroyed()) {
    confirmWindow.focus();
    return false;
  }
  recycleConfirmationPaths = paths;
  confirmWindow = new BrowserWindow({
    width: CONFIRM_SIZE.width,
    height: CONFIRM_SIZE.height,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    useContentSize: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  confirmWindow.setAlwaysOnTop(true, "screen-saver");
  confirmWindow.loadFile(path.join(__dirname, "renderer", "confirm.html"));
  confirmWindow.once("ready-to-show", () => {
    centerWindow(confirmWindow);
    confirmWindow?.show();
  });
  confirmWindow.on("closed", () => {
    confirmWindow = undefined;
    recycleConfirmationPaths = [];
  });
  return true;
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
  setPetWindowSize();
  restorePetPosition(readSettings());
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWindow.on("minimize", () => petWindow?.restore());
  petWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  petWindow.once("ready-to-show", () => petWindow?.showInactive());
}

app.whenReady().then(() => {
  recycleBin.init();
  createWindow();
  createTray();
  applyDisplayMode(readSettings());
});

ipcMain.handle("pet:get-theme", () => {
  const themeFile = path.join(app.getAppPath(), "assets", "roach-topdown", "theme.json");
  return JSON.parse(fs.readFileSync(themeFile, "utf8"));
});
ipcMain.handle("pet:get-settings", () => readSettings());
ipcMain.handle("pet:set-settings", (_event, partial) => {
  const next = normalizeSettings({ ...readSettings(), ...partial });
  saveSettings(next);
  if (typeof partial.alwaysOnTop === "boolean") applyDisplayMode(next);
  BrowserWindow.getAllWindows().forEach((window) => window.webContents.send("settings-changed", next));
  return next;
});
ipcMain.handle("pet:get-work-area", () => currentWorkArea());
ipcMain.on("pet:move", (_event, position) => {
  if (!petWindow || !position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return;
  const area = currentWorkArea();
  const requestedSize = { width: Math.round(position.width), height: Math.round(position.height) };
  const isPeekSize = (requestedSize.width === 115 && requestedSize.height === 38)
    || (requestedSize.width === 38 && requestedSize.height === 115);
  const width = isPeekSize ? requestedSize.width : PET_SIZE.width;
  const height = isPeekSize ? requestedSize.height : PET_SIZE.height;
  petWindow.setBounds({ x: Math.round(area.x + position.x), y: Math.round(area.y + position.y), width, height }, false);
  if (width === PET_SIZE.width && height === PET_SIZE.height) savePetPosition(position);
});
ipcMain.on("pet:hide", () => petWindow?.hide());
ipcMain.on("pet:show", () => petWindow?.showInactive());
ipcMain.on("pet:close-settings", () => settingsWindow?.close());
ipcMain.handle("pet:open-recycle-confirmation", (_event, paths) => {
  if (!Array.isArray(paths) || !paths.every((entry) => typeof entry === "string")) return false;
  return createRecycleConfirmation(paths);
});
ipcMain.handle("pet:get-recycle-confirmation", () => recycleConfirmationPaths.map((filePath) => ({
  name: path.basename(filePath),
  path: filePath
})));
ipcMain.handle("pet:confirm-recycle", () => {
  const results = recycleBin.recycleFiles(recycleConfirmationPaths);
  const successCount = results.filter((result) => result.ok).length;
  if (successCount) {
    recordActivity(`回收 ${successCount} 项`);
    petWindow?.webContents.send("recycle-complete", successCount);
  }
  return results;
});
ipcMain.on("pet:close-recycle-confirmation", () => confirmWindow?.close());
ipcMain.handle("pet:list-recycle-bin", () => recycleBin.listItems());
ipcMain.handle("pet:get-recycle-stats", () => recycleBin.getStats());
ipcMain.handle("pet:restore-file", (_event, id) => recycleBin.restoreFile(id));
ipcMain.handle("pet:empty-recycle-bin", () => recycleBin.emptyBin());
ipcMain.on("pet:record-activity", (_event, type) => {
  if (typeof type === "string" && type.length <= 64) recordActivity(type);
});
ipcMain.handle("pet:get-activity-log", () => readActivityLog());

app.on("window-all-closed", (event) => {
  if (!isQuitting) event.preventDefault();
});
app.on("before-quit", () => {
  isQuitting = true;
  clearTimeout(positionSaveTimer);
  tray?.destroy();
  settingsWindow?.destroy();
  confirmWindow?.destroy();
});
