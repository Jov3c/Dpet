import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("desktop runtime is configured as an offline Electron application", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.main, "src/main.js");
  assert.equal(pkg.scripts.start, "electron .");
  assert.equal(pkg.scripts.make, "node scripts/make-portable.mjs");
  assert.equal(pkg.scripts.makeInstaller, "electron-builder --win nsis");
  assert.ok(pkg.devDependencies.electron);
  assert.equal(pkg.build.win.signAndEditExecutable, false);
  assert.ok(existsSync("src/preload.js"));
  assert.ok(existsSync("src/renderer/index.html"));
  assert.ok(existsSync("src/renderer/settings.html"));
  assert.ok(existsSync("src/renderer/settings.js"));
  assert.ok(existsSync("src/renderer/confirm.html"));
  assert.ok(existsSync("src/renderer/confirm.js"));
  assert.ok(existsSync("src/recycle-bin.js"));
  assert.ok(existsSync("scripts/make-portable.mjs"));
});

test("runtime exposes local pet controls without changing the pet's fixed size", () => {
  const main = readFileSync("src/main.js", "utf8");
  const preload = readFileSync("src/preload.js", "utf8");
  const app = readFileSync("src/renderer/app.js", "utf8");

  assert.match(main, /const PET_SIZE = \{ width: 100, height: 150 \}/);
  assert.match(main, /pet:open-recycle-confirmation/);
  assert.match(preload, /openRecycleConfirmation/);
  assert.match(preload, /getRecycleStats/);
  assert.match(preload, /onSettingsChanged/);
  assert.match(app, /openRecycleConfirmation/);
  assert.match(app, /activityLevel/);
  assert.doesNotMatch(main, /showFavor/);
  assert.doesNotMatch(app, /favorability/);
  assert.doesNotMatch(main, /globalShortcut/);
  assert.match(main, /createRecycleConfirmation/);
  assert.match(readFileSync("src\/renderer\/settings.css", "utf8"), /-webkit-app-region: drag/);
});

test("normal-level pet stays in front of the desktop and the settings panel stays visible", () => {
  const main = readFileSync("src/main.js", "utf8");

  assert.match(main, /petWindow\.moveTop\(\)/);
  assert.match(main, /settingsWindow\.setAlwaysOnTop\(true, "floating"\)/);
});
