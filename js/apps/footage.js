import { escapeHTML as h } from './shared.js';

// Security Footage application. Visual pattern follows Reconciliation (app-toolbar, a
// two-pane list/detail layout, tabs) — see docs/INTEGRATION.md "Footage application".
// Static repository data; no game/case state is read or written here.
export const FOOTAGE_ITEMS = [
  {
    id: 'FOOTAGE-001',
    title: 'Loading dock — overnight pass',
    description: 'Supplied sample clip. Additional footage entries can be appended to FOOTAGE_ITEMS without further code changes.',
    src: encodeURI('assets/footage/first hald draft.mov'),
    staticSrc: 'assets/sounds/static-humming.wav'
  }
];

export function mountFootage(root) {
  if (!root) return;
  let selectedId = FOOTAGE_ITEMS[0]?.id ?? null;
  let view = 'list';
  const staticAudio = new Audio();
  staticAudio.loop = true;
  staticAudio.volume = 0.18;
  let staticLoadedFor = null;

  function stopStatic() {
    staticAudio.pause();
    staticAudio.currentTime = 0;
  }
  function syncStaticVolume(videoVolume) {
    // Keep the ambient track subordinate to the footage, while honoring the player's volume
    // control (including mute). It remains deliberately quieter than the source video.
    staticAudio.volume = Math.max(0, Math.min(1, Number(videoVolume) || 0)) * 0.22;
  }
  function startStatic(item, videoVolume) {
    if (!item.staticSrc) return;
    if (staticLoadedFor !== item.id) { staticAudio.src = item.staticSrc; staticLoadedFor = item.id; }
    syncStaticVolume(videoVolume);
    staticAudio.currentTime = 0;
    staticAudio.play()?.catch(() => { /* Autoplay may be blocked until a user gesture; play() is retried on the next user interaction (the Play button itself). */ });
  }

  function render() {
    const item = FOOTAGE_ITEMS.find(f => f.id === selectedId);
    root.innerHTML =
      '<div class="app-toolbar"><span>Security Footage</span></div>' +
      '<div class="reconciliation-tabs" role="tablist" aria-label="Footage views">' +
      '<button role="tab" aria-controls="footage-panel" data-footage-view="list" aria-selected="' + (view === 'list') + '" tabindex="' + (view === 'list' ? '0' : '-1') + '">Available Footage</button>' +
      '<button role="tab" aria-controls="footage-panel" data-footage-view="details" aria-selected="' + (view === 'details') + '" tabindex="' + (view === 'details' ? '0' : '-1') + '" ' + (!item ? 'disabled' : '') + '>Footage Details</button>' +
      '</div>' +
      '<div id="footage-panel" role="tabpanel" class="reconciliation-layout">' +
      '<nav class="case-list" aria-label="Footage list"><div class="pane-label">AVAILABLE FOOTAGE</div>' +
      FOOTAGE_ITEMS.map(f => '<button type="button" data-select-footage="' + h(f.id) + '" aria-pressed="' + (f.id === selectedId) + '"><b>' + h(f.title) + '</b><small>' + h(f.id) + '</small></button>').join('') +
      '</nav>' +
      '<div class="case-detail footage-detail">' +
      (item ? renderDetail(item) : '<p>Select footage from the list to view it.</p>') +
      '</div></div>';

    if (item) wireDetail(item);
    root.querySelectorAll('[data-select-footage]').forEach(btn => btn.addEventListener('click', () => {
      selectedId = btn.dataset.selectFootage;
      view = 'details';
      stopStatic();
      render();
    }));
    root.querySelectorAll('[data-footage-view]').forEach(btn => btn.addEventListener('click', () => {
      if (btn.disabled) return;
      view = btn.dataset.footageView;
      render();
    }));
  }

  function renderDetail(item) {
    return '<h1>' + h(item.title) + '</h1>' +
      '<p class="footage-id">' + h(item.id) + '</p>' +
      '<p>' + h(item.description) + '</p>' +
      '<div class="footage-player-shell">' +
      '<video class="footage-video" preload="metadata" playsinline></video>' +
      '<div class="footage-player-status" role="status" aria-live="polite"></div>' +
      '<div class="footage-controls">' +
      '<button type="button" class="footage-playpause" aria-label="Play">▶</button>' +
      '<span class="footage-time footage-current">0:00</span>' +
      '<input type="range" class="footage-seek" min="0" max="100" value="0" step="0.1" aria-label="Seek">' +
      '<span class="footage-time footage-duration">0:00</span>' +
      '<label class="footage-volume-label">Vol<input type="range" class="footage-volume" min="0" max="1" step="0.01" value="0.8" aria-label="Volume"></label>' +
      '<button type="button" class="footage-fullscreen" aria-label="Fullscreen">⤢</button>' +
      '</div></div>';
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function wireDetail(item) {
    const video = root.querySelector('.footage-video');
    const status = root.querySelector('.footage-player-status');
    const playPause = root.querySelector('.footage-playpause');
    const seek = root.querySelector('.footage-seek');
    const volume = root.querySelector('.footage-volume');
    const current = root.querySelector('.footage-current');
    const duration = root.querySelector('.footage-duration');
    const fullscreenBtn = root.querySelector('.footage-fullscreen');
    if (!video) return;
    video.src = item.src;
    video.volume = Number(volume.value);

    video.addEventListener('loadedmetadata', () => { duration.textContent = formatTime(video.duration); status.textContent = ''; });
    video.addEventListener('error', () => { status.textContent = 'This footage could not be loaded.'; });
    video.addEventListener('play', () => { playPause.textContent = '❚❚'; playPause.setAttribute('aria-label', 'Pause'); startStatic(item, video.volume); });
    video.addEventListener('pause', () => { playPause.textContent = '▶'; playPause.setAttribute('aria-label', 'Play'); stopStatic(); });
    video.addEventListener('ended', () => { stopStatic(); });
    video.addEventListener('timeupdate', () => {
      if (video.duration) seek.value = String((video.currentTime / video.duration) * 100);
      current.textContent = formatTime(video.currentTime);
    });

    playPause.addEventListener('click', () => {
      if (video.paused) video.play()?.catch(() => { status.textContent = 'Playback requires a user interaction.'; });
      else video.pause();
    });
    seek.addEventListener('input', () => {
      if (video.duration) video.currentTime = (Number(seek.value) / 100) * video.duration;
    });
    volume.addEventListener('input', () => { video.volume = Number(volume.value); syncStaticVolume(video.volume); });
    fullscreenBtn.addEventListener('click', () => { video.requestFullscreen?.().catch(() => {}); });
  }

  function stopAll() {
    const video = root.querySelector('.footage-video');
    video?.pause();
    stopStatic();
  }
  window.addEventListener('hilfer:window-closed', ({ detail }) => { if (detail.windowId === 'footage') stopAll(); });
  window.addEventListener('pagehide', stopAll, { once: true });

  render();
  return { stopAll };
}
