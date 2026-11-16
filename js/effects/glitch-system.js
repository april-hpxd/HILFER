// Reusable scripted-glitch system. Visual narrative events only — never mutates game/case
// state, evidence, resolutions or Mail content. See docs/INTEGRATION.md "Glitch system".
//
// Glitch 1 (`desktop_distortion`) is the one-time, desktop-wide distortion on first-case
// completion; it also advances the shared AI-state/wallpaper (js/effects/ai-state.js) partway
// through its sequence so the portrait + wallpaper swap lands mid-glitch, not before/after it.
// Glitches 2 and 3 (`email_multiplication`, `error_windows`) are unchanged.
export const GLITCH_SAVE_KEY = 'hilfer:glitches:v1';

function loadGlitchSave(storage) {
  try {
    const raw = storage?.getItem(GLITCH_SAVE_KEY);
    if (!raw) return { version: 1, triggered: [] };
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || !Array.isArray(saved.triggered)) throw new Error('Incompatible');
    return { version: 1, triggered: saved.triggered.filter(id => typeof id === 'string') };
  } catch { return { version: 1, triggered: [] }; }
}
function saveGlitchSave(storage, data) {
  try { storage?.setItem(GLITCH_SAVE_KEY, JSON.stringify(data)); } catch { /* UI-only state; session play continues. */ }
}

function playOnce(audio, { volume = 0.25, duration } = {}) {
  if (!audio) return () => {};
  audio.pause(); audio.currentTime = 0; audio.volume = volume;
  let timer;
  try { audio.play()?.catch(error => console.warn('Could not play glitch cue.', error)); }
  catch (error) { console.warn('Could not play glitch cue.', error); }
  if (duration) timer = setTimeout(() => { audio.pause(); audio.currentTime = 0; }, duration);
  return () => { clearTimeout(timer); audio.pause(); audio.currentTime = 0; };
}

// `root` is the element new glitch windows are appended to (#desktop).
export function mountGlitchSystem(store, { storage, root, sounds = {} } = {}) {
  let data = loadGlitchSave(storage);
  const activeCleanups = new Map();

  function persist() { saveGlitchSave(storage, data); }
  function hasTriggered(id) { return data.triggered.includes(id); }
  function markTriggered(id) { if (!hasTriggered(id)) { data.triggered.push(id); persist(); } }

  // `cancel` runs BEFORE a trigger function touches any shared DOM/state, never after: calling
  // it after the new instance has already set things up would replay the previous invocation's
  // cleanup on top of fresh state. Each trigger function calls `cancel(id)` first, does its
  // setup, then `register(id, cleanup)` — never a combined "run" helper.
  function cancel(id) { activeCleanups.get(id)?.(); activeCleanups.delete(id); }
  function register(id, cleanup) { activeCleanups.set(id, cleanup); }

  // --- Glitch 1: one-time desktop-wide distortion on first case completion ---------------
  // Stage timing matches the desktopGlitchShift/Overlay/Jitter keyframes in css/hilfer.css
  // (~3.4s total). Stage 4 (AI portrait + wallpaper swap) fires at the ~50% mark, where the
  // CSS sequence briefly settles ("quiet beat") before escalating again — so the asset swap
  // itself is not masked by heavy distortion, while the glitch continues around it.
  function triggerDesktopDistortion({ onMidpoint } = {}) {
    if (!root) return;
    cancel('desktop-distortion');
    const desktop = root.id === 'desktop' ? root : root.closest('#desktop');
    if (!desktop) return;
    const overlay = document.createElement('div');
    overlay.className = 'desktop-glitch-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    desktop.appendChild(overlay);
    desktop.classList.add('desktop-glitch-active');
    const timers = [];
    timers.push(setTimeout(() => { try { onMidpoint?.(); } catch (error) { console.warn('AI-state swap failed.', error); } }, 1700));
    function cleanup() {
      desktop.classList.remove('desktop-glitch-active');
      overlay.remove();
    }
    timers.push(setTimeout(cleanup, 3500));
    register('desktop-distortion', () => { timers.forEach(clearTimeout); cleanup(); });
  }

  // --- Glitch 2: email window multiplication ---------------------------------------------
  // Spawns short-lived visual echoes only; no real window IDs are registered with the
  // shell's window manager, so focus/taskbar/z-index/persistence are all untouched.
  function triggerEmailMultiplication({ sourceWindow, count = 9 } = {}) {
    if (!root || !sourceWindow) return;
    cancel('email-multiplication');
    const stopSound = playOnce(sounds.staticHum, { volume: 0.22, duration: 2600 });
    const echoes = [];
    const baseRect = { width: sourceWindow.offsetWidth || 420, height: sourceWindow.offsetHeight || 320 };
    const baseLeft = parseFloat(sourceWindow.style.left) || 120;
    const baseTop = parseFloat(sourceWindow.style.top) || 90;
    const content = sourceWindow.querySelector('.mail-message-content')?.innerHTML ?? '';
    const title = sourceWindow.querySelector('.window-title')?.textContent ?? 'Message';
    const timers = [];
    let spawned = 0;
    function spawnOne(index) {
      const echo = document.createElement('section');
      echo.className = 'window visible mail-message-window glitch-window-echo';
      echo.setAttribute('aria-hidden', 'true');
      echo.inert = true;
      const offset = 26 * (index + 1);
      Object.assign(echo.style, {
        width: baseRect.width + 'px', height: baseRect.height + 'px',
        left: (baseLeft + offset) + 'px', top: (baseTop + offset) + 'px',
        zIndex: 99990 + index
      });
      echo.innerHTML = `<div class="window-header"><span class="window-title">${title}</span><div class="window-controls"><button class="window-button" tabindex="-1">_</button><button class="window-button" tabindex="-1">□</button><button class="window-button close-btn" tabindex="-1">×</button></div></div><div class="window-content mail-message-content">${content}</div>`;
      root.appendChild(echo);
      echoes.push(echo);
      requestAnimationFrame(() => echo.classList.add('glitch-window-echo-in'));
    }
    const spawnInterval = setInterval(() => {
      if (spawned >= count) { clearInterval(spawnInterval); return; }
      spawnOne(spawned); spawned += 1;
    }, 110);
    timers.push(spawnInterval);
    const cleanupTimer = setTimeout(() => {
      clearInterval(spawnInterval);
      echoes.forEach((echo, index) => {
        const closeAt = index * 60;
        timers.push(setTimeout(() => echo.remove(), closeAt));
      });
    }, 3400);
    timers.push(cleanupTimer);
    const finalTimer = setTimeout(() => { echoes.forEach(echo => echo.remove()); stopSound(); }, 5000);
    timers.push(finalTimer);
    register('email-multiplication', () => { timers.forEach(clearTimeout); clearInterval(spawnInterval); echoes.forEach(echo => echo.remove()); stopSound(); });
  }

  // --- Glitch 3: error windows opening, then forcibly closed ------------------------------
  function triggerErrorWindows({ count = 7 } = {}) {
    if (!root) return;
    cancel('error-windows');
    // Audible for the whole open-then-close sequence (~3.2s total), not just the opening burst.
    const stopSound = playOnce(sounds.error, { volume: 0.45, duration: 3200 });
    const dialogs = [];
    const timers = [];
    const messages = [
      'The operation could not be completed.',
      'This operation could not be completed because the resource is not available.',
      'An unexpected error has occurred. The operation has been cancelled.'
    ];
    function spawnOne(index) {
      const dialog = document.createElement('section');
      dialog.className = 'window visible system-error-window glitch-window-echo';
      dialog.setAttribute('aria-hidden', 'true');
      dialog.inert = true;
      const left = 90 + (index % 5) * 46;
      const top = 60 + index * 34;
      Object.assign(dialog.style, { left: left + 'px', top: top + 'px', zIndex: 99990 + index });
      dialog.innerHTML = `<div class="window-header"><span class="window-title">System Error</span><div class="window-controls"><button class="window-button close-btn" tabindex="-1">×</button></div></div>
        <div class="window-content system-error-content"><span class="system-error-icon" aria-hidden="true"></span><p>${messages[index % messages.length]}</p><button type="button" class="system-error-ok" tabindex="-1">OK</button></div>`;
      root.appendChild(dialog);
      dialogs.push(dialog);
      requestAnimationFrame(() => dialog.classList.add('glitch-window-echo-in'));
    }
    let spawned = 0;
    const spawnInterval = setInterval(() => {
      if (spawned >= count) { clearInterval(spawnInterval); return; }
      spawnOne(spawned); spawned += 1;
    }, 140);
    timers.push(spawnInterval);
    const closeStart = setTimeout(() => {
      clearInterval(spawnInterval);
      dialogs.forEach((dialog, index) => timers.push(setTimeout(() => dialog.remove(), index * 70)));
    }, 1700);
    timers.push(closeStart);
    const finalTimer = setTimeout(() => { dialogs.forEach(dialog => dialog.remove()); stopSound(); }, 3200);
    timers.push(finalTimer);
    register('error-windows', () => { timers.forEach(clearTimeout); clearInterval(spawnInterval); dialogs.forEach(dialog => dialog.remove()); stopSound(); });
  }

  const definitions = {
    desktop_distortion: triggerDesktopDistortion,
    email_multiplication: triggerEmailMultiplication,
    error_windows: triggerErrorWindows
  };

  // `key` distinguishes repeatable instances of the same glitch (e.g. one per email id);
  // defaults to `id` for a fire-once-ever glitch.
  function triggerGlitch(id, { key = id, payload, once = true } = {}) {
    const handler = definitions[id];
    if (!handler) { console.warn(`Unknown glitch "${id}".`); return false; }
    if (once && hasTriggered(key)) return false;
    if (once) markTriggered(key);
    handler(payload);
    return true;
  }

  function resetGlitches() {
    for (const cleanup of activeCleanups.values()) cleanup();
    activeCleanups.clear();
    data = { version: 1, triggered: [] };
    persist();
  }

  store.onEvent(({ type }) => {
    if (type === 'hilfer:progress-reset') resetGlitches();
  });

  // A navigation/reload can interrupt a scripted sequence before its normal final timer.
  // Clear transient layers and stop the owned audio immediately; persistent milestones have
  // already been saved independently and will render normally after the next boot.
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
      for (const cleanup of activeCleanups.values()) cleanup();
      activeCleanups.clear();
    }, { once: true });
  }

  return { triggerGlitch, hasTriggered, resetGlitches };
}
