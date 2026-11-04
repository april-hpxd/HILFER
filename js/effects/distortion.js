export function mountDistortion(store) {
  let timer;
  let soundTimer;
  const glitchSound = document.querySelector('#glitch-sound');

  function stopGlitchSound() {
    clearTimeout(soundTimer);
    glitchSound.pause();
    glitchSound.currentTime = 0;
  }

  function playGlitchSound() {
    stopGlitchSound();
    const playback = glitchSound.play();
    if (playback) {
      playback.catch(error => console.warn('Could not play the glitch cue.', error));
    }
    soundTimer = setTimeout(stopGlitchSound, 1500);
  }

  function update(state) {
    document.documentElement.dataset.distortion = String(state.distortionLevel);
    document.querySelector('#integrity').textContent = state.distortionLevel ? 'Interface integrity: minor variance' : 'Interface integrity: nominal';
  }
  update(store.getState());
  store.subscribe(update);
  store.onEvent(({ type }) => {
    if (type === 'hilfer:case-reconciled') {
      document.documentElement.classList.add('microglitch');
      clearTimeout(timer);
      timer = setTimeout(() => document.documentElement.classList.remove('microglitch'), 1400);
      playGlitchSound();
    }
    if (type === 'hilfer:progress-reset') {
      clearTimeout(timer);
      document.documentElement.classList.remove('microglitch');
      stopGlitchSound();
    }
  });
}
