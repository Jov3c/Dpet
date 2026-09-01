import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";

const themePath = resolve(process.cwd(), "assets/roach-photo/theme.json");
const signature = [137, 80, 78, 71, 13, 10, 26, 10];
function fail(message) { console.error(`Photo roach theme validation failed: ${message}`); process.exit(1); }
if (!existsSync(themePath)) fail("assets/roach-photo/theme.json is missing");
const theme = JSON.parse(readFileSync(themePath, "utf8"));
if (theme.format !== "png" || !theme.states || !theme.reactions) fail("theme must declare PNG states and reactions");
const assets = [...Object.values(theme.states), ...Object.values(theme.reactions)];
if (assets.length !== 14) fail("theme must declare 9 states and 5 reactions");
for (const relativePath of assets) {
  const path = resolve(dirname(themePath), relativePath);
  if (!existsSync(path)) fail(`${relativePath} is missing`);
  const bytes = readFileSync(path);
  if (!signature.every((value, index) => bytes[index] === value)) fail(`${relativePath} is not a PNG`);
  if (![4, 6].includes(bytes[25])) fail(`${relativePath} must retain an alpha channel`);
}
console.log("Photo roach theme validation passed");
