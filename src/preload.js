const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("petApi", {
  getTheme: () => ipcRenderer.invoke("pet:get-theme"),
  getSettings: () => ipcRenderer.invoke("pet:get-settings"),
  setSettings: (partial) => ipcRenderer.invoke("pet:set-settings", partial),
  getWorkArea: () => ipcRenderer.invoke("pet:get-work-area"),
  getCursor: () => ipcRenderer.invoke("pet:get-cursor"),
  move: (position) => ipcRenderer.send("pet:move", position),
  hide: () => ipcRenderer.send("pet:hide"),
  show: () => ipcRenderer.send("pet:show"),
  closeSettings: () => ipcRenderer.send("pet:close-settings"),
  setDialogOpen: (open) => ipcRenderer.send("pet:set-dialog-open", open),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  recycleFiles: (paths) => ipcRenderer.invoke("pet:recycle-files", paths),
  listRecycleBin: () => ipcRenderer.invoke("pet:list-recycle-bin"),
  restoreFile: (id) => ipcRenderer.invoke("pet:restore-file", id),
  emptyRecycleBin: () => ipcRenderer.invoke("pet:empty-recycle-bin"),
  onSystemEvent: (listener) => {
    const handler = (_event, type) => listener(type);
    ipcRenderer.on("system-event", handler);
    return () => ipcRenderer.removeListener("system-event", handler);
  }
});
