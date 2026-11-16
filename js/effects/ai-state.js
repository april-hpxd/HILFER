// Shared AI-assistant-distortion state. One state index drives BOTH the assistant's profile
// portrait (ai.js) and the desktop wallpaper (css/hilfer.css, via a data attribute) so they can
// never drift apart. Visual narrative only — never mutates game/case/evidence state. See
// docs/INTEGRATION.md "AI state / wallpaper sync".
export const AI_STATE_SAVE_KEY = 'hilfer:ai-state:v1';

// Actual supplied assets only (see assets/arwa/ai_states and assets/arwa/wallpapers). The
// mapping below is ordered state 0 (default) -> state N (most distorted); filenames carry no
// explicit ordering, so this is a documented editorial choice, not a discovered contract.
export const AI_PORTRAITS = [
  'assets/arwa/ai_states/ai1.png',
  'assets/arwa/ai_states/ai2.png',
  'assets/arwa/ai_states/3.png',
  'assets/arwa/ai_states/4.png',
  'assets/arwa/ai_states/7.png'
];
export const WALLPAPERS = [
  'assets/arwa/wallpapers/1.png',
  'assets/arwa/wallpapers/2.png',
  'assets/arwa/wallpapers/3.png',
  'assets/arwa/wallpapers/4.png',
  'assets/arwa/wallpapers/7.png'
];
export const MAX_AI_STATE = Math.min(AI_PORTRAITS.length, WALLPAPERS.length) - 1;

function loadState(storage) {
  try {
    const raw = storage?.getItem(AI_STATE_SAVE_KEY);
    if (!raw) return 0;
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || !Number.isInteger(saved.state)) throw new Error('Incompatible');
    return Math.min(Math.max(saved.state, 0), MAX_AI_STATE);
  } catch { return 0; }
}
function saveState(storage, state) {
  try { storage?.setItem(AI_STATE_SAVE_KEY, JSON.stringify({ version: 1, state })); } catch { /* UI-only state. */ }
}

// `apply(state)` is injected so this module stays DOM-free and testable with node:test; the
// caller (mountAIState) supplies the real DOM-writing implementation.
export function createAIStateController(storage, apply = () => {}) {
  let state = loadState(storage);
  function get() { return state; }
  function set(next) {
    const clamped = Math.min(Math.max(next, 0), MAX_AI_STATE);
    if (clamped === state) { apply(state); return state; }
    state = clamped;
    saveState(storage, state);
    apply(state);
    return state;
  }
  function advance(steps = 1) { return set(state + steps); }
  function reset() { state = 0; saveState(storage, state); apply(state); }
  return { get, set, advance, reset, portraitFor: i => AI_PORTRAITS[Math.min(Math.max(i, 0), MAX_AI_STATE)], wallpaperFor: i => WALLPAPERS[Math.min(Math.max(i, 0), MAX_AI_STATE)] };
}

export function mountAIState(store, { storage } = {}) {
  function apply(state) {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.aiState = String(state);
    const wallpaper = new URL(WALLPAPERS[state], document.baseURI).href;
    document.documentElement.style.setProperty('--wallpaper-clean', `url('${AI_PORTRAITS_SAFE(wallpaper)}')`);
    window.dispatchEvent(new CustomEvent('hilfer:ai-state-changed', { detail: { state } }));
  }
  const controller = createAIStateController(storage, apply);
  store.onEvent(({ type }) => { if (type === 'hilfer:progress-reset') controller.reset(); });
  controller.set(controller.get());
  return controller;
}
function AI_PORTRAITS_SAFE(path) { return path.replace(/'/g, "\\'"); }
