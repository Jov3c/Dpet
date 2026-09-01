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
const PET_SIZE = { width: 100, height: 150 };
const SETTINGS_SIZE = { width: 380, height: 460 };
const CONFIRM_SIZE = { width: 360, height: 230 };
let recycleConfirmationPaths = [];
const DEFAULT_SETTINGS = {
  autoWalk: true,
  draggable: true,
  tease: true,
  edgeTuck: true,
  alwaysOnTop: true
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
  return Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) => [
    key,
    typeof input[key] === "boolean" ? input[key] : fallback
  ]));
}

function saveSettings(settings) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
}

function currentWorkArea() {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
}

function setPetWindowSize(size = PET_SIZE) {
  if (!petWindow) return;
  const { x, y } = petWindow.getBounds();
  petWindow.setBounds({ x, y, width: size.width, height: size.height }, false);
  petWindow.setResizable(false);
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
  petWindow?.setAlwaysOnTop(Boolean(settings.alwaysOnTop), settings.alwaysOnTop ? "screen-saver" : undefined);
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
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
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
  return results;
});
ipcMain.on("pet:close-recycle-confirmation", () => confirmWindow?.close());
ipcMain.handle("pet:list-recycle-bin", () => recycleBin.listItems());
ipcMain.handle("pet:restore-file", (_event, id) => recycleBin.restoreFile(id));
ipcMain.handle("pet:empty-recycle-bin", () => recycleBin.emptyBin());

app.on("window-all-closed", (event) => {
  if (!isQuitting) event.preventDefault();
});
app.on("before-quit", () => {
  isQuitting = true;
  tray?.destroy();
  settingsWindow?.destroy();
  confirmWindow?.destroy();
});
