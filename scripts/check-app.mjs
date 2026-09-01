import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const files = ["src/main.js", "src/main-menu.js", "src/preload.js", "src/renderer/app.js", "src/renderer/pet-controller.mjs", "src/renderer/pet-view.mjs", "scripts/make-portable.mjs"];
for (const file of files) {
  const source = readFileSync(file, "utf8");
  if (source.includes("http://") || source.includes("https://")) throw new Error(`${file} must not request the network`);
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}
console.log("Offline desktop pet source check passed");
