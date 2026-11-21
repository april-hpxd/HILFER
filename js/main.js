import { createStore } from './core/store.js';
import { mountRecords } from './apps/records-fixture.js';
import { mountReconciliation } from './apps/reconciliation.js';
import { mountMail } from './apps/emails.js';
import { mountAI } from './apps/ai.js';
import { mountReports } from './apps/reports.js';
import { mountDistortion } from './effects/distortion.js';
import { mountGlitchSystem } from './effects/glitch-system.js';
import { mountAIState } from './effects/ai-state.js';

async function boot() {
  const [records, cases, assistant, emails] = await Promise.all(['records', 'cases', 'assistant', 'emails'].map(async name => {
    const response = await fetch(`./data/${name}.json`);
    if (!response.ok) throw new Error(`Could not load ${name}`);
    return response.json();
  }));
  // Accessing localStorage itself can throw when browser storage is disabled.
  let storage;
  try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error('Storage disabled'); }, setItem() { throw new Error('Storage disabled'); } }; }
  const store = createStore({ records, cases, storage });
  const firstPlayableCase = cases.find(definition => !definition.placeholder);
  mountReports(document.querySelector('#reports-app'));
  let reconciliation;
  const recordsApp = mountRecords(document.querySelector('#records-app'), store, {
    onClaim(recordId, field) {
      if (!reconciliation) return { ok: false, message: 'Reconciliation has not loaded.' };
      const result = reconciliation.presentClaim(recordId, field);
      if (result.ok) {
        window.openWindow('reconciliation');
        reconciliation.focusComparison();
      }
      return result;
    }
  });
  function openRecord(recordId) {
    if (!store.getRecord(recordId)) return { ok: false, message: 'Unknown record ID.' };
    window.openWindow('records');
    return recordsApp.openRecord(recordId);
  }
  reconciliation = mountReconciliation(document.querySelector('#reconciliation-app'), store, { openRecord });
  const glitch = mountGlitchSystem(store, {
    storage,
    root: document.querySelector('#desktop'),
    sounds: {
      glitch: document.querySelector('#glitch-sound'),
      staticHum: document.querySelector('#static-sound'),
      error: document.querySelector('#error-sound')
    }
  });
  const aiState = mountAIState(store, { storage });
  let previousAiState = aiState.get();
  let aiCueTimer;
  window.addEventListener('hilfer:ai-state-changed', ({ detail }) => {
    const nextState = detail?.state;
    if (!Number.isInteger(nextState) || nextState <= previousAiState) {
      previousAiState = Number.isInteger(nextState) ? nextState : previousAiState;
      return;
    }
    previousAiState = nextState;
    const cues = ['#glitch-sound', '#static-sound', '#error-sound']
      .map(selector => document.querySelector(selector))
      .filter(audio => audio && !audio.paused && !audio.ended);
    if (cues.length) return;
    const audio = document.querySelector('#glitch-sound');
    if (!audio) return;
    clearTimeout(aiCueTimer);
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 0.2;
    try {
      audio.play()?.catch(error => console.warn('Could not play the AI distortion cue.', error));
    } catch (error) {
      console.warn('Could not play the AI distortion cue.', error);
    }
    aiCueTimer = setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
    }, 1200);
  });
  mountAI(document.querySelector('#ai-app'), store, assistant, { storage, aiState });
  const mailApp = mountMail(document.querySelector('#emails-app'), emails, {
    storage,
    store,
    openRecord,
    glitch,
    onEmailGlitch: () => aiState.advance(),
    onErrorGlitch: () => aiState.advance()
  });
  function updateFootageAccess() {
    const unlocked = Boolean(firstPlayableCase) && store.getState().completedCaseIds.includes(firstPlayableCase.id);
    for (const button of document.querySelectorAll('[data-open="footage"]')) {
      button.title = unlocked ? '' : 'Complete the first case to unlock Footage';
      button.disabled = false;
      if (!button.classList.contains('icon')) button.textContent = 'Footage';
    }
  }
  store.subscribe(updateFootageAccess);
  updateFootageAccess();
  const footage = document.querySelector('#footage-window');
  const video = footage.querySelector('video');
  video.addEventListener('ended', () => {
    const fired = glitch.triggerGlitch('footage_interruption', {
      key: 'footage-interruption:post-view:v1',
      payload: {
        footageWindow: footage,
        onCloseFootage: () => window.closeWindow('footage'),
        onOpenMail: () => window.openWindow('emails'),
        createDraft: () => mailApp.openScriptedDraft(),
        closeDraft: () => mailApp.closeScriptedDraft()
      }
    });
    if (fired) aiState.advance();
  });
  const stopFootage = () => video.pause();
  new MutationObserver(() => {
    if (!footage.classList.contains('visible')) stopFootage();
  }).observe(footage, {attributes:true, attributeFilter:['class']});
  window.addEventListener('pagehide', stopFootage);
  store.onEvent(({type}) => {
    if (type === 'hilfer:progress-reset') {
      stopFootage();
      video.currentTime = 0;
      window.closeWindow('footage');
    }
  });
  video.querySelector('source').addEventListener('error', () => {
    footage.querySelector('.status-bar-field').textContent = 'Preview could not be loaded.';
  });
  mountDistortion(store);
  store.onEvent(({ type, detail }) => {
    if (type !== 'hilfer:case-reconciled' || detail.caseId !== firstPlayableCase?.id) return;
    glitch.triggerGlitch('desktop_distortion', {
      key: 'desktop_distortion:' + firstPlayableCase.id + ':v2',
      payload: { onMidpoint: () => aiState.advance() }
    });
  });
  function update() {
    document.querySelector('#save-status').textContent = store.getWarning();
  }
  store.subscribe(update); update();
  document.querySelector('#reset-progress').addEventListener('click', () => { store.resetProgress(); });
  // Stable integration surface for Records and browser tests; all writes go through validation.
  window.hilfer = Object.freeze({ ...store, ...reconciliation, openRecord, glitch, aiState });
}
boot().catch(error => {
  console.error(error);
  document.querySelector('#save-status').textContent = 'Workstation failed to load. Serve the repository over local HTTP, then reload.';
});
