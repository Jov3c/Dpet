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
  assert.ok(existsSync("scripts/make-portable.mjs"));
});
