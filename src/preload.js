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
  restoreFile: (id) => ipcRenderer.invoke("pet:restore-file", id),
  emptyRecycleBin: () => ipcRenderer.invoke("pet:empty-recycle-bin")
});
