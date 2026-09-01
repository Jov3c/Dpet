import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { applyPetVisual } from "../src/renderer/pet-view.mjs";

const require = createRequire(import.meta.url);
const { buildTrayMenu } = require("../src/main-menu.js");

const theme = {
  states: { idle: "animations/idle.apng", walk: "animations/walk.apng" },
  reactions: { dragged: "animations/dragged.apng" },
  peek: "animations/peek.apng"
};

test("unchanged visual does not reload an APNG animation", () => {
  const pet = { dataset: {}, style: {}, src: "" };
  assert.equal(applyPetVisual(pet, theme, { mode: "walk", heading: 0 }), true);
  assert.equal(applyPetVisual(pet, theme, { mode: "walk", heading: 0.2 }), false);
  assert.equal(applyPetVisual(pet, theme, { mode: "dragged", heading: 0.2 }), true);
  assert.match(pet.src, /dragged\.apng$/);
});

test("tucked visual switches to the antenna-only edge animation", () => {
  const pet = { dataset: {}, style: {}, src: "" };
  applyPetVisual(pet, theme, { mode: "tucked", tuckedEdge: "right", heading: 0 });
  assert.match(pet.src, /peek\.apng$/);
  assert.match(pet.style.transform, /rotate\(-90deg\)/);
});

test("tray menu exposes settings and a clean exit command", () => {
  let settingsOpened = 0;
  let exits = 0;
  const menu = buildTrayMenu({ openSettings: () => settingsOpened++, quit: () => exits++ });
  assert.deepEqual(menu.map((item) => item.label || item.type), ["打开设置", "separator", "退出桌宠"]);
  menu[0].click();
  menu[2].click();
  assert.equal(settingsOpened, 1);
  assert.equal(exits, 1);
});
