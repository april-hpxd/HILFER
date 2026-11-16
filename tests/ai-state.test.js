import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAIStateController, AI_PORTRAITS, WALLPAPERS, MAX_AI_STATE } from '../js/effects/ai-state.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.has(key) ? data.get(key) : null, setItem: (key, value) => data.set(key, value) };
}

test('AI portrait and wallpaper arrays line up 1:1 so every state has both assets', () => {
  assert.equal(AI_PORTRAITS.length, WALLPAPERS.length);
  assert.equal(MAX_AI_STATE, AI_PORTRAITS.length - 1);
});

test('starts at state 0 with no saved state', () => {
  const applied = [];
  const controller = createAIStateController(memoryStorage(), state => applied.push(state));
  assert.equal(controller.get(), 0);
});

test('advance() moves the shared state forward once and persists it', () => {
  const storage = memoryStorage();
  const applied = [];
  const controller = createAIStateController(storage, state => applied.push(state));
  const next = controller.advance();
  assert.equal(next, 1);
  assert.equal(controller.get(), 1);
  assert.deepEqual(applied, [1]);

  const reloaded = createAIStateController(storage, () => {});
  assert.equal(reloaded.get(), 1, 'state must survive a reload via storage');
});

test('advance(2) skips intermediate states for the visible 1-to-3-to-5 progression', () => {
  const controller = createAIStateController(memoryStorage());
  assert.equal(controller.advance(2), 2);
  assert.equal(controller.advance(2), 4);
  assert.equal(controller.portraitFor(controller.get()), AI_PORTRAITS[4]);
  assert.equal(controller.wallpaperFor(controller.get()), WALLPAPERS[4]);
});

test('set() clamps to the available asset range instead of pointing at a missing file', () => {
  const controller = createAIStateController(memoryStorage());
  controller.set(999);
  assert.equal(controller.get(), MAX_AI_STATE);
  controller.set(-5);
  assert.equal(controller.get(), 0);
});

test('portraitFor/wallpaperFor return the matching pair for a given state', () => {
  const controller = createAIStateController(memoryStorage());
  for (let i = 0; i <= MAX_AI_STATE; i++) {
    assert.equal(controller.portraitFor(i), AI_PORTRAITS[i]);
    assert.equal(controller.wallpaperFor(i), WALLPAPERS[i]);
  }
});

test('reset() returns to state 0 and persists it', () => {
  const storage = memoryStorage();
  const controller = createAIStateController(storage);
  controller.advance(); controller.advance();
  assert.equal(controller.get(), 2);
  controller.reset();
  assert.equal(controller.get(), 0);
  const reloaded = createAIStateController(storage, () => {});
  assert.equal(reloaded.get(), 0);
});

test('malformed saved state degrades to state 0 instead of throwing', () => {
  const storage = { getItem: () => '{not json', setItem: () => {} };
  const controller = createAIStateController(storage);
  assert.equal(controller.get(), 0);
});
