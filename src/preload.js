const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("petApi", {
  getTheme: () => ipcRenderer.invoke("pet:get-theme"),
  getSettings: () => ipcRenderer.invoke("pet:get-settings"),
  setSettings: (partial) => ipcRenderer.invoke("pet:set-settings", partial),
  getWorkArea: () => ipcRenderer.invoke("pet:get-work-area"),
  move: (position) => ipcRenderer.send("pet:move", position),
  hide: () => ipcRenderer.send("pet:hide"),
  show: () => ipcRenderer.send("pet:show"),
  closeSettings: () => ipcRenderer.send("pet:close-settings"),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  openRecycleConfirmation: (paths) => ipcRenderer.invoke("pet:open-recycle-confirmation", paths),
  getRecycleConfirmation: () => ipcRenderer.invoke("pet:get-recycle-confirmation"),
  confirmRecycle: () => ipcRenderer.invoke("pet:confirm-recycle"),
  closeRecycleConfirmation: () => ipcRenderer.send("pet:close-recycle-confirmation"),
  listRecycleBin: () => ipcRenderer.invoke("pet:list-recycle-bin"),
  getRecycleStats: () => ipcRenderer.invoke("pet:get-recycle-stats"),
  restoreFile: (id) => ipcRenderer.invoke("pet:restore-file", id),
  emptyRecycleBin: () => ipcRenderer.invoke("pet:empty-recycle-bin"),
  recordActivity: (type) => ipcRenderer.send("pet:record-activity", type),
  getActivityLog: () => ipcRenderer.invoke("pet:get-activity-log"),
  onRecycleComplete: (listener) => {
    const handler = (_event, count) => listener(count);
    ipcRenderer.on("recycle-complete", handler);
    return () => ipcRenderer.removeListener("recycle-complete", handler);
  },
  onSettingsChanged: (listener) => {
    const handler = (_event, settings) => listener(settings);
    ipcRenderer.on("settings-changed", handler);
    return () => ipcRenderer.removeListener("settings-changed", handler);
  }
});
