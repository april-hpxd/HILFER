import { escapeHTML as h } from './shared.js';
import { createAssistantVoice } from './assistant-voice.js';

// Adapted from Altynai's HILFER assistant. Messages are a projection of game state.
export function deriveAssistant(state, records, content) {
  const filed = state.completedCaseIds.includes(content.caseId) && Boolean(state.resolutions[content.caseId]);
  const investigating = records.some(record => record.caseIds.includes(content.caseId) && state.discoveredEvidenceIds.includes(record.id));
  const phase = filed ? 'filed' : investigating ? 'investigating' : 'welcome';
  return { phase, messages: phase === 'welcome' ? [content.welcome] : [content.welcome, content[phase]],
    notificationId: filed ? content.caseId + ':reconciled' : null };
}

// UI receipts only; no evidence, resolutions or progression are stored here.
export const ASSISTANT_RECEIPT_KEY = 'hilfer:assistant:v1';
export function createAssistantReceipt(storage, notificationId) {
  let read = false;
  try {
    const saved = JSON.parse(storage?.getItem(ASSISTANT_RECEIPT_KEY) ?? 'null');
    read = saved?.version === 1 && saved.readId === notificationId;
  } catch { /* Missing/blocked/malformed UI storage leaves the message unread. */ }
  return {
    isRead: () => read,
    markRead() {
      if (read) return;
      read = true;
      try { storage?.setItem(ASSISTANT_RECEIPT_KEY, JSON.stringify({ version: 1, readId: notificationId })); } catch { /* Session receipt still works. */ }
    },
    reset() { read = false; try { storage?.removeItem(ASSISTANT_RECEIPT_KEY); } catch { /* In-memory reset remains available. */ } }
  };
}

export function mountAI(root, store, content, { storage } = {}) {
  const receipt = createAssistantReceipt(storage, content.caseId + ':reconciled');
  root.innerHTML = `<section id="assistant-balloon" class="assistant-balloon" aria-labelledby="assistant-title" hidden>
    <header class="ai-profile"><h1 id="assistant-title">HILFER Assistant</h1><button type="button" data-assistant-dismiss aria-label="Dismiss Assistant">Close</button></header>
    <div class="ai-transcript" tabindex="-1" role="log" aria-label="Assistant correspondence" aria-live="polite" aria-relevant="additions"></div>
    <div class="ai-actions"><button data-open="reconciliation">Open Reconciliation</button><button data-open="records">Open Records</button><button type="button" data-assistant-voice hidden>Listen</button></div>
    </section>
    <div class="assistant-launch">
      <button type="button" id="assistant-notification" class="assistant-notification" aria-controls="assistant-balloon" hidden>Report updated</button>
      <button type="button" id="assistant-portrait" aria-label="HILFER Assistant" aria-controls="assistant-balloon" aria-expanded="false"><img class="ai-avatar" alt=""></button>
    </div>
    <span class="assistant-announcement" id="assistant-announcement" role="status" aria-live="polite"></span>`;
  const notification = root.querySelector('#assistant-notification');
  const announcement = root.querySelector('#assistant-announcement');
  const launcher = root.querySelector('#assistant-portrait');
  const balloon = root.querySelector('#assistant-balloon');
  const log = root.querySelector('.ai-transcript');
  const voice = createAssistantVoice(storage, content.caseId);
  const voiceButton = root.querySelector('[data-assistant-voice]');
  voiceButton.hidden = !voice.supported;
  let speaking = false;
  let lines = [];
  function showVoiceState(active, message = '') {
    speaking = active;
    voiceButton.textContent = active ? 'Stop voice' : 'Listen';
    if (message) announcement.textContent = message;
  }
  function stopVoice() {
    voice.stop();
    showVoiceState(false);
  }
  voiceButton.addEventListener('click', () => {
    if (speaking) stopVoice();
    else voice.play(lines, showVoiceState);
  });
  const portrait = root.querySelector('.ai-avatar');
  let previousPhase;
  let wasUnread = false;
  function update() {
    const state = store.getState();
    const model = deriveAssistant(state, store.getRecords(), content);
    const face = state.distortionLevel > 0 ? 'assistant-distorted' : 'assistant';
    const portraitSrc = `assets/arwa/portraits/${face}.webp`;
    if (portrait.getAttribute('src') !== portraitSrc) portrait.src = portraitSrc;
    if (model.phase !== previousPhase) {
      stopVoice();
      lines = model.messages.map((message, index) => ({...message, id: index === 0 ? 'welcome' : model.phase}));
      log.innerHTML = model.messages.map(message => `<section class="ai-message"><h2>${h(message.label)}</h2><p>${h(message.text)}</p></section>`).join('');
      log.scrollTop = log.scrollHeight;
      previousPhase = model.phase;
    }
    if (model.notificationId && !balloon.hidden) receipt.markRead();
    const unread = Boolean(model.notificationId) && !receipt.isRead();
    notification.hidden = !unread;
    if (unread !== wasUnread) announcement.textContent = unread ? 'HILFER Assistant has a report update.' : '';
    wasUnread = unread;
  }
  function setOpen(open, focus = true) {
    if (!open) stopVoice();
    balloon.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    update();
    if (open) log.scrollTop = log.scrollHeight;
    if (focus) (open ? log : launcher).focus({preventScroll: true});
  }
  launcher.addEventListener('click', () => setOpen(balloon.hidden));
  notification.addEventListener('click', () => setOpen(true));
  root.querySelector('[data-assistant-dismiss]').addEventListener('click', () => setOpen(false));
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !balloon.hidden) {
      event.stopPropagation();
      setOpen(false);
    }
  });
  root.querySelector('.ai-actions').addEventListener('click', event => {
    if (event.target.closest('[data-open]')) setOpen(false);
  });
  window.addEventListener('hilfer:assistant-open', () => setOpen(true));
  window.addEventListener('pagehide', stopVoice);
  store.subscribe(update);
  store.onEvent(({ type }) => {
    if (type === 'hilfer:progress-reset') { receipt.reset(); voice.reset(); setOpen(false, false); }
    if (type === 'hilfer:case-reconciled') update();
  });
  update();
  root.hidden = false;
}
