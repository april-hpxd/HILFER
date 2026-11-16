import { createStore } from './core/store.js';
import { mountRecords } from './apps/records-fixture.js';
import { mountReconciliation } from './apps/reconciliation.js';
import { mountMail } from './apps/emails.js';
import { mountAI } from './apps/ai.js';
import { mountFootage } from './apps/footage.js';
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
    storage, root: document.querySelector('#desktop'),
    sounds: { staticHum: document.querySelector('#static-sound'), error: document.querySelector('#error-sound') }
  });
  const aiState = mountAIState(store, { storage });
  mountAI(document.querySelector('#ai-app'), store, assistant, { storage, aiState });
  mountMail(document.querySelector('#emails-app'), emails, {
    storage, store, openRecord, glitch,
    onEmailGlitch: () => aiState.advance(2)
  });
  mountFootage(document.querySelector('#footage-app'));
  mountReports(document.querySelector('#reports-app'));
  mountDistortion(store);
  // Glitch 1: first case completion triggers the one-time desktop-wide distortion, which
  // advances the shared AI-state (portrait + wallpaper) partway through its own sequence.
  let sawFirstCompletion = store.getState().completedCaseIds.length >= 1;
  function update() {
    const state = store.getState();
    document.querySelector('#progress').textContent = `${state.completedCaseIds.length} / ${cases.filter(c => !c.placeholder).length} playable assignments reconciled`;
    document.querySelector('#save-status').textContent = store.getWarning();
    if (!sawFirstCompletion && state.completedCaseIds.length >= 1) {
      sawFirstCompletion = true;
      glitch.triggerGlitch('desktop_distortion', { key: 'desktop_distortion:case-1', payload: { onMidpoint: () => aiState.advance(2) } });
    }
  }
  store.subscribe(update); update();
  document.querySelector('#reset-progress').addEventListener('click', () => { store.resetProgress(); });
  // Stable integration surface for Records and browser tests; all writes go through validation.
  window.hilfer = Object.freeze({ ...store, ...reconciliation, openRecord, glitch });
}
boot().catch(error => {
  console.error(error);
  document.querySelector('#save-status').textContent = 'Workstation failed to load. Serve the repository over local HTTP, then reload.';
});
