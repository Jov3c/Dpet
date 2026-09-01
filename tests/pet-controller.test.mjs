import test from "node:test";
import assert from "node:assert/strict";
import { advancePet, createPetState, applyPetEvent } from "../src/renderer/pet-controller.mjs";

const viewport = { width: 1200, height: 800 };

test("pointer approach does not make a roaming pet flee", () => {
  const state = createPetState({ x: 500, y: 400, heading: 0 });
  const next = advancePet(state, {
    viewport,
    cursor: { x: 650, y: 400 },
    deltaMs: 16,
    random: () => 0.5,
  });

  assert.equal(next.mode, "walk");
  assert.notEqual(next.mode, "flee");
});

test("roaming direction ignores the cursor", () => {
  const state = createPetState({ x: 500, y: 400, heading: Math.PI });
  const next = advancePet(state, {
    viewport,
    cursor: { x: 650, y: 400 },
    deltaMs: 100,
    random: () => 0.5,
  });

  assert.equal(next.mode, "walk");
  assert.ok(next.velocity.x < 0, "cursor on the right must not pull the pet toward it");
});

test("an idle pet stays still until the pointer wakes it", () => {
  let state = { ...createPetState({ x: 500, y: 400, heading: 0 }), nextRestAt: 0 };
  state = advancePet(state, { viewport, deltaMs: 16, random: () => 0 });
  assert.equal(state.mode, "idle");

  state = applyPetEvent(state, { type: "wake" });
  assert.equal(state.mode, "walk");
  assert.ok(state.velocity.x > 0);
});

test("grab, drag and release use the physical interaction sequence", () => {
  let state = createPetState({ x: 300, y: 300, heading: 0 });
  state = applyPetEvent(state, { type: "pointer-down", x: 300, y: 300 });
  assert.equal(state.mode, "grabbed");

  state = applyPetEvent(state, { type: "pointer-drag", x: 480, y: 260 });
  assert.equal(state.mode, "dragged");
  assert.deepEqual({ x: state.x, y: state.y }, { x: 480, y: 260 });

  state = applyPetEvent(state, { type: "pointer-up" });
  assert.equal(state.mode, "dropped");
  assert.ok(state.transientUntil > 0);
});

test("reaching a screen edge plays a turn before returning to the work area", () => {
  const state = createPetState({ x: 1, y: 400, heading: Math.PI });
  const next = advancePet(state, {
    viewport,
    cursor: { x: 1100, y: 700 },
    deltaMs: 100,
    random: () => 0.5,
  });

  assert.equal(next.mode, "turn");
  assert.equal("hidden" in next, false);
  assert.ok(next.x >= 8, "pet must remain inside the left edge margin");
  assert.ok(next.velocity.x > 0, "pet must turn away from the left edge");
});

test("a pet tucked into an edge stays still until the user reveals it", () => {
  let state = createPetState({ x: 30, y: 200, heading: 0 });
  state = applyPetEvent(state, { type: "tuck", edge: "left" });
  assert.equal(state.mode, "tucked");
  assert.equal(state.tuckedEdge, "left");

  const still = advancePet(state, {
    viewport,
    cursor: { x: 800, y: 500 },
    deltaMs: 100,
  });
  assert.equal(still.mode, "tucked");
  assert.deepEqual({ x: still.x, y: still.y }, { x: 30, y: 200 });
});

test("quiet mode settles into the idle state and wakes only on contact", () => {
  let state = createPetState({ x: 300, y: 300, heading: 0, quietMode: true });
  state = advancePet(state, { viewport, deltaMs: 40, random: () => 0.7 });
  assert.equal(state.mode, "idle");
  assert.equal(state.velocity.x, 0);

  state = applyPetEvent(state, { type: "wake" });
  assert.equal(state.mode, "walk");
});

test("edge emergence and file feeding use dedicated transient states", () => {
  let state = createPetState({ x: 300, y: 300, heading: 0 });
  state = applyPetEvent(state, { type: "emerge" });
  assert.equal(state.mode, "emerge");
  state = applyPetEvent(state, { type: "eat" });
  assert.equal(state.mode, "eat");
  assert.ok(state.transientUntil > Date.now());
});
