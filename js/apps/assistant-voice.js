// Adapted from Lyden King's opt-in dialogue narration in april-hpxd/HILFER.
export function createAssistantVoice(storage, caseId, {
  speech = globalThis.speechSynthesis,
  Utterance = globalThis.SpeechSynthesisUtterance,
  pause = () => 340 + Math.random() * 560
} = {}) {
  const key = 'hilfer:assistant-dialogue:v1';
  const completed = new Set();
  try {
    const saved = JSON.parse(storage?.getItem(key) ?? 'null');
    if (saved?.version === 1 && saved.caseId === caseId && Array.isArray(saved.completedIds)) {
      for (const id of saved.completedIds) if (typeof id === 'string') completed.add(id);
    }
  } catch { /* Unavailable storage still permits narration. */ }

  let run = 0;
  let speaking = false;
  let timer;
  function stop() {
    run++;
    clearTimeout(timer);
    if (speaking) speech.cancel();
    speaking = false;
  }
  return {
    supported: Boolean(speech && Utterance),
    stop,
    reset() {
      stop();
      completed.clear();
      try { storage?.removeItem(key); } catch { /* Session reset still works. */ }
    },
    play(lines, onActivity) {
      if (!speech || !Utterance) return;
      stop();
      const queue = lines.filter(line => !completed.has(line.id));
      if (!queue.length) { onActivity(false); return; }
      const token = run;
      function schedule(index) {
        const delay = pause();
        if (delay > 0) timer = setTimeout(() => read(index), delay);
        else read(index);
      }
      function read(index) {
        if (token !== run) return;
        const line = queue[index];
        if (!line) {
          speaking = false;
          onActivity(false);
          return;
        }
        const utterance = new Utterance(line.text);
        utterance.lang = 'en-US';
        utterance.onend = () => {
          if (token !== run) return;
          speaking = false;
          completed.add(line.id);
          try {
            storage?.setItem(key, JSON.stringify({version:1, caseId, completedIds:[...completed]}));
          } catch { /* Session checkpoint still works. */ }
          if (index + 1 < queue.length) schedule(index + 1);
          else onActivity(false);
        };
        utterance.onerror = () => {
          if (token !== run) return;
          stop();
          onActivity(false, 'Voice unavailable.');
        };
        try {
          speaking = true;
          speech.speak(utterance);
        } catch { utterance.onerror(); }
      }
      onActivity(true);
      schedule(0);
    }
  };
}
