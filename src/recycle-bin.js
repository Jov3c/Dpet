const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

let baseDir;

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

function moveItem(source, target) {
  try {
    fs.renameSync(source, target);
  } catch (error) {
    if (!["EXDEV", "EPERM", "EACCES"].includes(error.code)) throw error;
    fs.cpSync(source, target, { recursive: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
}

function recycleFiles(sourcePaths) {
  const items = readManifest();
  const results = [];
  for (const source of sourcePaths) {
    try {
      const name = path.basename(source);
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const slot = path.join(baseDir, id);
      const target = path.join(slot, name);
      fs.mkdirSync(slot, { recursive: true });
      moveItem(source, target);
      const stats = fs.statSync(target);
      items.push({ id, name, originalPath: source, recycledAt: new Date().toISOString(), size: stats.size, isDirectory: stats.isDirectory() });
      results.push({ id, name, ok: true });
    } catch (error) {
      results.push({ name: path.basename(source), ok: false, error: error.message });
    }
  }
  writeManifest(items);
  return results;
}

function listItems() {
  return readManifest();
}

function getStats() {
  const items = readManifest();
  return {
    count: items.length,
    bytes: items.reduce((total, item) => total + (Number.isFinite(item.size) ? item.size : 0), 0),
    lastRecycledAt: items.reduce((latest, item) => latest && latest > item.recycledAt ? latest : item.recycledAt, null)
  };
}

function restoreFile(id) {
  const items = readManifest();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return { ok: false, error: "not found" };
  const item = items[index];
  try {
    const source = path.join(baseDir, item.id, item.name);
    if (!fs.existsSync(source)) throw new Error("回收站中的文件已丢失");
    fs.mkdirSync(path.dirname(item.originalPath), { recursive: true });
    let target = item.originalPath;
    let counter = 1;
    while (fs.existsSync(target)) {
      const extension = path.extname(item.originalPath);
      const base = path.basename(item.originalPath, extension);
      target = path.join(path.dirname(item.originalPath), `${base} (${counter++})${extension}`);
    }
    moveItem(source, target);
    items.splice(index, 1);
    writeManifest(items);
    return { ok: true, restoredTo: target };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function emptyBin() {
  const items = readManifest();
  for (const item of items) fs.rmSync(path.join(baseDir, item.id), { recursive: true, force: true });
  writeManifest([]);
  return items.length;
}

module.exports = { init, recycleFiles, listItems, getStats, restoreFile, emptyBin };
