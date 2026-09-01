import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

test("roach theme validates its declared asset contract", () => {
  const output = execFileSync(
    process.execPath,
    ["scripts/validate-roach-theme.mjs"],
    { encoding: "utf8" },
  );
  assert.match(output, /Roach theme validation passed/);
});

test("every core roach state has an interactive body layer", () => {
  const states = ["idle", "probe", "walk", "sprint", "flee", "sleeping", "waking", "edge-peek", "edge-hide"];
  for (const state of states) {
    const svg = readFileSync(`assets/roach/states/${state}.svg`, "utf8");
    assert.match(svg, /id="hitbox-js"/);
  }
});

test("core states preserve the reference cockroach anatomy", () => {
  const anatomyLayers = [
    "pronotum-js", "elytra-left-js", "elytra-right-js",
    "leg-spines-left-js", "leg-spines-right-js",
  ];
  const svg = readFileSync("assets/roach/states/idle.svg", "utf8");
  for (const layer of anatomyLayers) {
    assert.match(svg, new RegExp(`id="${layer}"`));
  }
});

test("theme declares every mouse interaction reaction", () => {
  const theme = JSON.parse(readFileSync("assets/roach/theme.json", "utf8"));
  const expected = ["alert", "dragged", "dropped", "grabbed", "struggle"];
  assert.deepEqual(Object.keys(theme.reactions).sort(), expected);
  for (const reaction of expected) {
    const svg = readFileSync(`assets/roach/${theme.reactions[reaction]}`, "utf8");
    assert.match(svg, /id="hitbox-js"/);
  }
});

test("preview presents every declared roach asset", () => {
  const theme = JSON.parse(readFileSync("assets/roach/theme.json", "utf8"));
  const preview = readFileSync("assets/roach/preview.html", "utf8");
  for (const asset of [...Object.values(theme.states), ...Object.values(theme.reactions)]) {
    assert.ok(preview.includes(asset), `preview must include ${asset}`);
  }
});

test("photo-real roach theme declares transparent raster states and reactions", () => {
  const output = execFileSync(
    process.execPath,
    ["scripts/validate-roach-photo-theme.mjs"],
    { encoding: "utf8" },
  );
  assert.match(output, /Photo roach theme validation passed/);
});

test("top-down idle animation is a 100 by 150 APNG", () => {
  const bytes = readFileSync("assets/roach-topdown/animations/idle-100x150.apng");
  assert.equal(bytes.readUInt32BE(16), 100);
  assert.equal(bytes.readUInt32BE(20), 150);
  assert.ok(bytes.includes(Buffer.from("acTL")), "animation must include an APNG control chunk");
});

test("top-down walking animation is a 100 by 150 APNG", () => {
  const bytes = readFileSync("assets/roach-topdown/animations/walk-100x150.apng");
  assert.equal(bytes.readUInt32BE(16), 100);
  assert.equal(bytes.readUInt32BE(20), 150);
  assert.ok(bytes.includes(Buffer.from("acTL")), "animation must include an APNG control chunk");
});

test("top-down theme keeps a single calm idle animation for every rest period", () => {
  const theme = JSON.parse(readFileSync("assets/roach-topdown/theme.json", "utf8"));
  for (const state of ["idle", "turn"]) {
    const asset = theme.states[state];
    assert.ok(asset, `${state} animation must be declared`);
    const bytes = readFileSync(`assets/roach-topdown/${asset}`);
    assert.equal(bytes.readUInt32BE(16), 100, `${state} width`);
    assert.equal(bytes.readUInt32BE(20), 150, `${state} height`);
    assert.ok(bytes.includes(Buffer.from("acTL")), `${state} must be APNG`);
  }
});

test("top-down runtime theme maps system and pointer behaviour to raster animations", () => {
  const theme = JSON.parse(readFileSync("assets/roach-topdown/theme.json", "utf8"));
  assert.deepEqual(Object.keys(theme.states).sort(), ["alert", "flee", "idle", "sprint", "turn", "walk"]);
  assert.deepEqual(Object.keys(theme.reactions).sort(), ["dragged", "dropped", "eat", "emerge", "grabbed", "struggle"]);
  assert.deepEqual(theme.eventMap, {});

  for (const asset of [...Object.values(theme.states), ...Object.values(theme.reactions)]) {
    const bytes = readFileSync(`assets/roach-topdown/${asset}`);
    assert.equal(bytes.readUInt32BE(16), 100, `${asset} width`);
    assert.equal(bytes.readUInt32BE(20), 150, `${asset} height`);
    assert.ok(bytes.includes(Buffer.from("acTL")), `${asset} must be APNG`);
  }
});

test("feeding has its own restrained animation instead of reusing the struggle asset", () => {
  const eat = readFileSync("assets/roach-topdown/animations/eat-100x150.apng");
  const struggle = readFileSync("assets/roach-topdown/animations/struggle-100x150.apng");
  assert.notDeepEqual(eat, struggle);
});

test("every feeding frame preserves the roach abdomen", () => {
  const program = [
    "from PIL import Image",
    "im = Image.open('assets/roach-topdown/animations/eat-100x150.apng')",
    "for i in range(im.n_frames):",
    "  im.seek(i)",
    "  rgba = im.convert('RGBA')",
    "  assert any(rgba.getpixel((x, y))[3] > 0 for x in range(42, 59) for y in range(96, 121)), f'frame {i} has no abdomen'",
  ].join("\n");
  assert.doesNotThrow(() => execFileSync("python", ["-c", program], { encoding: "utf8" }));
});
