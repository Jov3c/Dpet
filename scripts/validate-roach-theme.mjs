import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import process from "node:process";

const root = process.cwd();
const themePath = resolve(root, "assets/roach/theme.json");
const requiredLayers = [
  "shadow-js", "abdomen-js", "thorax-js", "head-js",
  "antenna-left-js", "antenna-right-js", "legs-left-js", "legs-right-js", "hitbox-js",
];

function fail(message) {
  console.error(`Roach theme validation failed: ${message}`);
  process.exit(1);
}

if (!existsSync(themePath)) fail("assets/roach/theme.json is missing");
const theme = JSON.parse(readFileSync(themePath, "utf8"));
if (theme.viewBox !== "0 0 512 512") fail("theme viewBox must be 0 0 512 512");
if (!theme.master || typeof theme.states !== "object" || typeof theme.reactions !== "object") {
  fail("theme must declare master, states, and reactions");
}

const assetPaths = [theme.master, ...Object.values(theme.states), ...Object.values(theme.reactions)];
for (const relativePath of assetPaths) {
  if (typeof relativePath !== "string" || relativePath.includes("..")) fail("asset paths must be local strings");
  const path = resolve(dirname(themePath), relativePath);
  if (!existsSync(path)) fail(`${relativePath} is missing`);
  const svg = readFileSync(path, "utf8");
  if (!svg.includes('viewBox="0 0 512 512"')) fail(`${relativePath} has the wrong viewBox`);
  if (!/<title\b/.test(svg) || !/<desc\b/.test(svg)) fail(`${relativePath} requires title and desc`);
  if (/<image\b/i.test(svg) || /(?:href|xlink:href)\s*=\s*["']https?:\/\//i.test(svg)) {
    fail(`${relativePath} must not load external imagery or URLs`);
  }
  for (const layer of requiredLayers) {
    if (!svg.includes(`id="${layer}"`)) fail(`${relativePath} is missing layer ${layer}`);
  }
}

console.log("Roach theme validation passed");
