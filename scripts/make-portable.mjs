import { copyFileSync, cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const electronDist = join(root, "node_modules", "electron", "dist");
const output = join(root, "dist", "Roach-on-Desk");
const app = join(output, "resources", "app");

if (!existsSync(join(electronDist, "electron.exe"))) {
  throw new Error("Electron runtime is missing. Run: npx install-electron --no");
}

rmSync(output, { recursive: true, force: true });
mkdirSync(app, { recursive: true });
cpSync(electronDist, output, { recursive: true });
cpSync(join(root, "src"), join(app, "src"), { recursive: true });
cpSync(join(root, "assets", "roach-topdown"), join(app, "assets", "roach-topdown"), { recursive: true });
copyFileSync(join(root, "package.json"), join(app, "package.json"));
copyFileSync(join(root, "README.md"), join(app, "README.md"));
renameSync(join(output, "electron.exe"), join(output, "Roach on Desk.exe"));

const launcher = join(output, "Roach on Desk.exe");
if (!existsSync(launcher)) throw new Error("Portable launcher was not created");
writeFileSync(join(output, "build-info.json"), JSON.stringify({
  product: "Roach on Desk",
  runtime: "Electron",
  source: "local portable build",
  launcher: "Roach on Desk.exe"
}, null, 2));

console.log(`Portable app created: ${launcher}`);
