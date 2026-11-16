import { escapeHTML as h } from './shared.js';

// Adapted from Altynai's HILFER assistant. Messages are a projection of game state.
export function deriveAssistant(state, records, content) {
  const filed = state.completedCaseIds.includes(content.caseId) && Boolean(state.resolutions[content.caseId]);
  const investigating = records.some(record => record.caseIds.includes(content.caseId) && state.discoveredEvidenceIds.includes(record.id));
  const phase = filed ? 'filed' : investigating ? 'investigating' : 'welcome';
  const dialogueLines = (entry, prefix) => {
    if (!entry) return [];
    const lines = Array.isArray(entry.lines) ? entry.lines : [entry];
    return lines.map((line, index) => ({
      id: `${content.caseId}:${prefix}:${line.id ?? index}`,
      label: line.label ?? entry.label ?? 'HILFER Assistant',
      text: line.text
    })).filter(line => typeof line.text === 'string' && line.text.length > 0);
  };
  return { phase, messages: [...dialogueLines(content.welcome, 'welcome'), ...(phase === 'welcome' ? [] : dialogueLines(content[phase], phase))],
    notificationId: filed ? content.caseId + ':reconciled' : null };
}

// UI receipts only; no evidence, resolutions or progression are stored here.
export const ASSISTANT_RECEIPT_KEY = 'hilfer:assistant:v1';
export const ASSISTANT_DIALOGUE_KEY = 'hilfer:assistant-dialogue:v1';

export function createDialogueCheckpoint(storage, caseId) {
  const completed = new Set();
  function load() {
    completed.clear();
    try {
      const saved = JSON.parse(storage?.getItem(ASSISTANT_DIALOGUE_KEY) ?? 'null');
      if (saved?.version === 1 && saved.caseId === caseId && Array.isArray(saved.completedIds)) {
        for (const id of saved.completedIds) if (typeof id === 'string') completed.add(id);
      }
    } catch { /* Malformed or unavailable storage starts with an empty session checkpoint. */ }
  }
  load();
  return {
    hasCompleted: id => completed.has(id),
    markCompleted(id) {
      if (!id || completed.has(id)) return;
      completed.add(id);
      try { storage?.setItem(ASSISTANT_DIALOGUE_KEY, JSON.stringify({ version: 1, caseId, completedIds: [...completed] })); } catch { /* Session checkpoint still works. */ }
    },
    reset() { completed.clear(); try { storage?.removeItem(ASSISTANT_DIALOGUE_KEY); } catch { /* In-memory reset remains available. */ } }
  };
}

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

// Browser-native speech queue. It narrates the currently projected dialogue in order;
// browsers may require the Play button to be pressed by the user before speech can start.
export function createDialogueVoice({ speech = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance } = {}) {
  let stopped = false;
  return {
    supported: Boolean(speech && Utterance),
    stop() { stopped = true; speech?.cancel(); },
    play(messages, isCompleted, onCompleted, onStatus = () => {}) {
      if (!speech || !Utterance) { onStatus('Text to speech is not available in this browser.'); return; }
      speech.cancel();
      stopped = false;
      const speakAt = index => {
        if (stopped) return;
        while (index < messages.length && isCompleted(messages[index].id)) index++;
        if (index >= messages.length) { onStatus('Dialogue is up to date.'); return; }
        const line = messages[index];
        const utterance = new Utterance(`${line.label}. ${line.text}`);
        utterance.onstart = () => onStatus(`Speaking: ${line.label}`);
        utterance.onerror = event => { if (event.error !== 'canceled' && event.error !== 'interrupted') onStatus('Speech playback stopped.'); };
        utterance.onend = () => { if (stopped) return; onCompleted(line.id); speakAt(index + 1); };
        speech.speak(utterance);
      };
      if (!messages.some(message => !isCompleted(message.id))) { onStatus('Dialogue is up to date.'); return; }
      speakAt(0);
    }
  };
}

export function mountAI(root, store, content, { storage, aiState } = {}) {
  const receipt = createAssistantReceipt(storage, content.caseId + ':reconciled');
  const notification = document.querySelector('#assistant-notification');
  const announcement = document.querySelector('#assistant-announcement');
  const windowEl = root.closest('.window');
  const initialPortrait = aiState ? aiState.portraitFor(aiState.get()) : 'assets/placeholders/personnel.svg';
  root.innerHTML = `<header class="ai-profile"><img class="ai-avatar" src="${initialPortrait}" alt="HILFER Assistant profile portrait" loading="eager" decoding="async"><div><h1>HILFER Assistant</h1><p>Internal support</p></div></header>
    <div class="ai-transcript" tabindex="-1" role="log" aria-label="Assistant correspondence" aria-live="polite" aria-relevant="additions"></div>
    <div class="ai-voice-controls"><button type="button" data-voice-play>Play dialogue</button><button type="button" data-voice-stop disabled>Stop voice</button></div>
    <div class="ai-actions"><button data-open="reconciliation">Open Reconciliation</button><button data-open="records">Open Records</button></div>
    <p class="ai-status" role="status"></p>`;
  if (aiState) {
    const avatar = root.querySelector('.ai-avatar');
    function syncAvatar() { avatar.src = aiState.portraitFor(aiState.get()); }
    // ai-state changes outside this module's control (e.g. the glitch-1 handler calling
    // aiState.advance()); poll on the events that can plausibly follow a state change rather
    // than adding a second independent subscription system.
    window.addEventListener('hilfer:ai-state-changed', syncAvatar);
  }
  let previousPhase;
  let wasUnread = false;
  const voice = createDialogueVoice();
  const dialogueCheckpoint = createDialogueCheckpoint(storage, content.caseId);
  const voiceStatus = root.querySelector('.ai-status');
  const playButton = root.querySelector('[data-voice-play]');
  const stopButton = root.querySelector('[data-voice-stop]');
  playButton.disabled = !voice.supported;
  stopButton.disabled = !voice.supported;
  playButton.addEventListener('click', () => {
    const model = deriveAssistant(store.getState(), store.getRecords(), content);
    stopButton.disabled = false;
    voice.play(model.messages, dialogueCheckpoint.hasCompleted, dialogueCheckpoint.markCompleted, message => {
      voiceStatus.textContent = message;
      if (message === 'Dialogue is up to date.') stopButton.disabled = true;
    });
  });
  stopButton.addEventListener('click', () => { voice.stop(); stopButton.disabled = true; voiceStatus.textContent = 'Voice stopped.'; });
  function update() {
    const model = deriveAssistant(store.getState(), store.getRecords(), content);
    if (model.phase !== previousPhase) {
      voice.stop();
      stopButton.disabled = true;
      const log = root.querySelector('.ai-transcript');
      log.innerHTML = model.messages.map(message => `<section class="ai-message"><h2>${h(message.label)}</h2><p>${h(message.text)}</p></section>`).join('');
      log.scrollTop = log.scrollHeight;
      root.querySelector('.ai-status').textContent = model.phase === 'filed' ? 'Report revision registered.' : 'Personnel review / pending';
      previousPhase = model.phase;
    }
    if (model.notificationId && windowEl.classList.contains('active') && windowEl.classList.contains('visible')) receipt.markRead();
    const unread = Boolean(model.notificationId) && !receipt.isRead();
    notification.hidden = !unread;
    if (unread !== wasUnread) announcement.textContent = unread ? 'HILFER Assistant has a report update.' : '';
    wasUnread = unread;
  }
  window.addEventListener('hilfer:window-activated', ({ detail }) => {
    if (detail.windowId === 'ai') {
      const focusCorrespondence = !windowEl.contains(document.activeElement);
      update();
      if (focusCorrespondence) root.querySelector('.ai-transcript').focus({ preventScroll: true });
    }
  });
  store.subscribe(update);
  store.onEvent(({ type }) => {
    if (type === 'hilfer:progress-reset') { receipt.reset(); dialogueCheckpoint.reset(); voice.stop(); update(); }
    if (type === 'hilfer:case-reconciled') update();
  });
  update();
}
