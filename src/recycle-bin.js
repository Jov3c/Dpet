const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

let baseDir;

// The app's own recycle bin: dropped files/folders are MOVED here (a soft
// delete, never permanently removed) and can be restored from the settings.
function init() {
  baseDir = path.join(app.getPath("userData"), "recycle-bin");
  fs.mkdirSync(baseDir, { recursive: true });
}

function manifestPath() {
  return path.join(baseDir, "manifest.json");
}

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(manifestPath(), "utf8"));
  } catch {
    return [];
  }
}

function writeManifest(items) {
  fs.writeFileSync(manifestPath(), JSON.stringify(items, null, 2));
}

// Move a file or folder across the same or different drives.
function moveItem(src, dest) {
  try {
    fs.renameSync(src, dest);
    return true;
  } catch (error) {
    if (error.code === "EXDEV" || error.code === "EPERM" || error.code === "EACCES") {
      fs.cpSync(src, dest, { recursive: true });
      fs.rmSync(src, { recursive: true, force: true });
      return true;
    }
    throw error;
  }
}

function recycleFiles(sourcePaths) {
  const items = readManifest();
  const results = [];
  for (const src of sourcePaths) {
    try {
      const name = path.basename(src);
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const slotDir = path.join(baseDir, id);
      fs.mkdirSync(slotDir, { recursive: true });
      const target = path.join(slotDir, name);
      moveItem(src, target);
      const stats = fs.statSync(target);
      items.push({
        id,
        name,
        originalPath: src,
        recycledAt: new Date().toISOString(),
        size: stats.size,
        isDirectory: stats.isDirectory(),
      });
      results.push({ id, name, ok: true });
    } catch (error) {
      results.push({ name: path.basename(src), ok: false, error: error.message });
    }
  }
  writeManifest(items);
  return results;
}

function listItems() {
  return readManifest();
}

function restoreFile(id) {
  const items = readManifest();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return { ok: false, error: "not found" };
  const item = items[index];
  try {
    const src = path.join(baseDir, item.id, item.name);
    if (!fs.existsSync(src)) throw new Error("回收站中的文件已丢失");
    fs.mkdirSync(path.dirname(item.originalPath), { recursive: true });
    let target = item.originalPath;
    let counter = 1;
    while (fs.existsSync(target)) {
      const ext = path.extname(item.originalPath);
      const base = path.basename(item.originalPath, ext);
      target = path.join(path.dirname(item.originalPath), `${base} (${counter})${ext}`);
      counter += 1;
    }
    moveItem(src, target);
    items.splice(index, 1);
    writeManifest(items);
    return { ok: true, restoredTo: target };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function emptyBin() {
  const items = readManifest();
  for (const item of items) {
    try {
      fs.rmSync(path.join(baseDir, item.id), { recursive: true, force: true });
    } catch { /* ignore */ }
  }
  writeManifest([]);
  return items.length;
}

module.exports = { init, recycleFiles, listItems, restoreFile, emptyBin };
