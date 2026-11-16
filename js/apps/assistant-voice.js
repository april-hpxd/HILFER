// Dialogue checkpoint adapted from Lyden King's Assistant integration.
export function createAssistantVoice(storage, caseId, {
  audio = typeof Audio === 'function' ? new Audio() : null
} = {}) {
  const key = 'hilfer:assistant-dialogue:v1';
  const completed = new Set();
  try {
    const saved = JSON.parse(storage?.getItem(key) ?? 'null');
    if (saved?.version === 1 && saved.caseId === caseId && Array.isArray(saved.completedIds)) {
      for (const id of saved.completedIds) if (typeof id === 'string') completed.add(id);
    }
  } catch { /* Unavailable storage still permits narration. */ }

  if (audio) audio.preload = 'none';
  let run = 0;
  let activeId = null;
  function stop() {
    run++;
    activeId = null;
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
  }

  return {
    stop,
    reset() {
      stop();
      completed.clear();
      try { storage?.removeItem(key); } catch { /* Session reset still works. */ }
    },
    play(cue, {onError = () => {}} = {}) {
      if (!audio || !cue || completed.has(cue.id) || activeId === cue.id) return;
      stop();
      const token = run;
      activeId = cue.id;
      const fail = () => {
        if (token !== run) return;
        stop();
        onError();
      };
      audio.onended = () => {
        if (token !== run) return;
        activeId = null;
        completed.add(cue.id);
        try {
          storage?.setItem(key, JSON.stringify({version:1, caseId, completedIds:[...completed]}));
        } catch { /* Session checkpoint still works. */ }
      };
      audio.onerror = fail;
      audio.src = cue.src;
      // Start within the gesture that opened the balloon.
      try { audio.play()?.catch(fail); } catch { fail(); }
    }
  };
}
