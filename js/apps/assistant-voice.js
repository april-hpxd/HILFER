// Dialogue checkpoint adapted from Lyden King's Assistant integration.
export function createAssistantVoice(storage, caseId, {
  audio = typeof Audio === 'function' ? new Audio() : null,
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

  if (audio) audio.preload = 'none';
  let run = 0;
  let timer;
  function stop() {
    run++;
    clearTimeout(timer);
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
    play(lines, {replay = false, onError = () => {}} = {}) {
      if (!audio) return;
      stop();
      const pending = lines.filter(id => !completed.has(id));
      const queue = pending.length || !replay ? pending : lines.slice(-1);
      const token = run;
      function read(index) {
        if (token !== run || index >= queue.length) return;
        const id = queue[index];
        const fail = () => {
          if (token !== run) return;
          stop();
          onError();
        };
        audio.onended = () => {
          if (token !== run) return;
          completed.add(id);
          try {
            storage?.setItem(key, JSON.stringify({version:1, caseId, completedIds:[...completed]}));
          } catch { /* Session checkpoint still works. */ }
          if (index + 1 >= queue.length) return;
          const delay = pause();
          if (delay > 0) timer = setTimeout(() => read(index + 1), delay);
          else read(index + 1);
        };
        audio.onerror = fail;
        audio.src = 'assets/sounds/assistant/' + id + '.mp3';
        try { audio.play()?.catch(fail); } catch { fail(); }
      }
      // Start the first line within the same gesture that opened the balloon.
      read(0);
    }
  };
}
