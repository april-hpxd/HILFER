import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mountGlitchSystem } from '../js/effects/glitch-system.js';

function fakeStore() {
  const listeners = new Set();
  return {
    getState: () => ({}),
    onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    emit(type, detail = {}) { for (const fn of listeners) fn({ type, detail }); }
  };
}
function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.has(key) ? data.get(key) : null, setItem: (key, value) => data.set(key, value) };
}

test('unknown glitch id is a no-op, not a throw', () => {
  const glitch = mountGlitchSystem(fakeStore(), { storage: memoryStorage() });
  assert.equal(glitch.triggerGlitch('does-not-exist'), false);
});

test('a once-guarded glitch key fires exactly once until reset', () => {
  const store = fakeStore();
  const storage = memoryStorage();
  const glitch = mountGlitchSystem(store, { storage });
  // error_windows needs a DOM root to actually render; omit root and just check the guard logic
  // by inspecting hasTriggered rather than relying on DOM side effects in this environment.
  assert.equal(glitch.hasTriggered('error_windows:MAIL-010'), false);
  glitch.triggerGlitch('error_windows', { key: 'error_windows:MAIL-010' });
  assert.equal(glitch.hasTriggered('error_windows:MAIL-010'), true);
  const fired = glitch.triggerGlitch('error_windows', { key: 'error_windows:MAIL-010' });
  assert.equal(fired, false, 'a second trigger with the same key must not fire again');
});

test('progress reset clears triggered glitches', () => {
  const store = fakeStore();
  const storage = memoryStorage();
  const glitch = mountGlitchSystem(store, { storage });
  glitch.triggerGlitch('error_windows', { key: 'error_windows:MAIL-010' });
  assert.equal(glitch.hasTriggered('error_windows:MAIL-010'), true);
  store.emit('hilfer:progress-reset', {});
  assert.equal(glitch.hasTriggered('error_windows:MAIL-010'), false);
});

test('malformed glitch save storage degrades gracefully instead of throwing', () => {
  const storage = { getItem: () => '{not json', setItem: () => {} };
  const glitch = mountGlitchSystem(fakeStore(), { storage });
  assert.equal(glitch.hasTriggered('anything'), false);
});

// Regression: `cancel(id)` must replay the PREVIOUS invocation's cleanup BEFORE the new one
// sets anything up, not after — otherwise a stale cleanup from an earlier trigger could wipe
// out state the new trigger just created. Exercised with a minimal fake DOM (no jsdom).
function fakeClassList(initial = '') {
  const set = new Set(initial.split(' ').filter(Boolean));
  return {
    add: (...names) => names.forEach(n => set.add(n)),
    remove: (...names) => names.forEach(n => set.delete(n)),
    contains: name => set.has(name),
    toString: () => [...set].join(' ')
  };
}
function fakeElement() {
  const children = [];
  return {
    classList: fakeClassList(),
    style: {},
    inert: false,
    setAttribute() {},
    querySelector: () => null,
    appendChild(child) { children.push(child); },
    remove() {},
    get isConnected() { return true; },
    children
  };
}
test('re-triggering error_windows runs again and does not throw from stale cleanup ordering', () => {
  const store = fakeStore();
  const storage = memoryStorage();
  const desktop = { appendChild() {}, querySelector: () => null };
  const originalDocument = global.document;
  const originalRAF = global.requestAnimationFrame;
  global.document = { createElement: () => fakeElement(), querySelector: () => null };
  global.requestAnimationFrame = (fn) => fn();
  try {
    const glitch = mountGlitchSystem(store, { storage, root: desktop });
    const first = glitch.triggerGlitch('error_windows', { key: 'a', once: false, payload: { count: 3 } });
    assert.equal(first, true);
    const second = glitch.triggerGlitch('error_windows', { key: 'b', once: false, payload: { count: 3 } });
    assert.equal(second, true, 'a second, independent trigger must still run and not be silently cancelled');
    glitch.resetGlitches();
  } finally {
    global.document = originalDocument;
    global.requestAnimationFrame = originalRAF;
  }
});

// Glitch 1 (`desktop_distortion`): verifies it is once-guarded like the others, calls its
// midpoint callback (where the AI-state swap happens), and cleans up the class/overlay it adds
// — never leaving the overlay element or the active class behind.
test('desktop_distortion fires once, calls onMidpoint, and cleans up its own overlay/class', () => {
  const store = fakeStore();
  const storage = memoryStorage();
  const desktop = { id: 'desktop', classList: fakeClassList(), appendChild() {}, closest() { return desktop; } };
  const originalDocument = global.document;
  global.document = { createElement: () => fakeElement(), querySelector: () => null };
  const originalSetTimeout = global.setTimeout;
  const timers = [];
  global.setTimeout = (fn, ms) => { timers.push(fn); return timers.length; };
  try {
    const glitch = mountGlitchSystem(store, { storage, root: desktop });
    let midpointCalled = false;
    const fired = glitch.triggerGlitch('desktop_distortion', { key: 'desktop_distortion:case-1', payload: { onMidpoint: () => { midpointCalled = true; } } });
    assert.equal(fired, true);
    assert.equal(desktop.classList.contains('desktop-glitch-active'), true);
    const again = glitch.triggerGlitch('desktop_distortion', { key: 'desktop_distortion:case-1', payload: { onMidpoint: () => {} } });
    assert.equal(again, false, 'a second trigger with the same key must not fire again');
    timers[0](); // midpoint timer
    assert.equal(midpointCalled, true);
    timers[1](); // cleanup timer
    assert.equal(desktop.classList.contains('desktop-glitch-active'), false);
  } finally {
    global.document = originalDocument;
    global.setTimeout = originalSetTimeout;
  }
});
