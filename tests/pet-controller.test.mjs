import test from "node:test";
import assert from "node:assert/strict";
import { advancePet, createPetState, applyPetEvent } from "../src/renderer/pet-controller.mjs";

const viewport = { width: 1200, height: 800 };

test("pointer approach switches a roaming pet to flee and directs it away", () => {
  const state = createPetState({ x: 500, y: 400, heading: 0 });
  const next = advancePet(state, {
    viewport,
    cursor: { x: 650, y: 400 },
    deltaMs: 16,
    random: () => 0.5,
  });

  assert.equal(next.mode, "flee");
  assert.ok(next.velocity.x < 0, "pet must move away from cursor on its right");
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

test("reaching a screen edge turns the pet around instead of teleporting", () => {
  const state = createPetState({ x: 1, y: 400, heading: Math.PI });
  const next = advancePet(state, {
    viewport,
    cursor: { x: 1100, y: 700 },
    deltaMs: 100,
    random: () => 0.5,
  });

  assert.notEqual(next.hidden, true);
  assert.equal(next.mode, "walk");
  assert.equal(next.x, 8, "pet should be clamped to the edge margin");
  assert.ok(Math.cos(next.heading) > 0.99, "heading should point back into the screen");
});

test("a dormant pet stays completely still until the mouse comes near, then wakes", () => {
  const sleeping = { ...createPetState({ x: 300, y: 300, heading: 0 }), mode: "sleeping", velocity: { x: 0, y: 0 } };
  const still = advancePet(sleeping, { viewport, cursor: { x: 0, y: 0 }, deltaMs: 100, random: () => 0.5 });
  assert.equal(still.mode, "sleeping");
  assert.deepEqual({ x: still.x, y: still.y }, { x: 300, y: 300 }, "dormant pet must not move");

  const woken = advancePet(sleeping, { viewport, cursor: { x: 340, y: 320 }, deltaMs: 100, random: () => 0.5 });
  assert.equal(woken.mode, "walk");
  assert.ok(woken.velocity.x !== 0 || woken.velocity.y !== 0, "woken pet should move again");
});

test("a dormant pet still wakes even when avoidMouse is disabled", () => {
  const sleeping = { ...createPetState({ x: 300, y: 300, heading: 0 }), mode: "sleeping", velocity: { x: 0, y: 0 } };
  const woken = advancePet(sleeping, { viewport, cursor: { x: 340, y: 320 }, deltaMs: 100, random: () => 0.5, avoidMouse: false });
  assert.equal(woken.mode, "walk");
});

test("dragging to an edge tucks the pet, which then stays put until untucked", () => {
  let state = createPetState({ x: 300, y: 300, heading: 0 });
  state = applyPetEvent(state, { type: "tuck", edge: "bottom" });
  assert.equal(state.mode, "tucked");
  assert.equal(state.tuckedEdge, "bottom");

  const idle = advancePet(state, { viewport, cursor: { x: 0, y: 0 }, deltaMs: 100 });
  assert.equal(idle.mode, "tucked");
  assert.deepEqual({ x: idle.x, y: idle.y }, { x: 300, y: 300 }, "tucked pet should not wander");

  state = applyPetEvent(state, { type: "untuck" });
  assert.equal(state.mode, "walk");
  assert.equal(state.tuckedEdge, null);
});
