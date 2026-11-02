const scriptedMessages = [
  'Hello. I am HILFER, your internal assistant. This preview uses fixed, prewritten messages.',
  'Your current assignment is available in Reconciliation. Begin with the Consolidated Report.',
  'When a source document raises a question, return to Reconciliation to review it against the report.'
];

export function mountAI(root) {
  root.classList.add('ai-app');
  root.innerHTML = `
    <header class="ai-profile">
      <img class="ai-avatar" src="./assets/placeholders/personnel.svg" alt="Temporary generic profile portrait">
      <div>
        <h1>HILFER Assistant</h1>
        <p>Internal support interface</p>
        <small>Scripted prototype · not a live AI service</small>
      </div>
    </header>
    <div class="ai-transcript" role="log" aria-label="Scripted assistant messages" aria-live="polite" aria-relevant="additions"></div>
    <div class="ai-controls">
      <div class="ai-actions">
        <button type="button" data-ai-next>Next message</button>
        <button type="button" data-ai-speak>Read aloud</button>
        <button type="button" data-ai-stop>Stop speech</button>
      </div>
      <p class="ai-status" role="status" aria-live="polite"></p>
    </div>
  `;

  const transcript = root.querySelector('.ai-transcript');
  const nextButton = root.querySelector('[data-ai-next]');
  const speakButton = root.querySelector('[data-ai-speak]');
  const stopButton = root.querySelector('[data-ai-stop]');
  const status = root.querySelector('.ai-status');
  const canSpeak = typeof window.speechSynthesis !== 'undefined'
    && typeof window.SpeechSynthesisUtterance !== 'undefined';
  let messageIndex = 0;

  function appendMessage() {
    const message = document.createElement('p');
    message.className = 'ai-message';
    message.textContent = scriptedMessages[messageIndex];
    transcript.append(message);
    transcript.scrollTop = transcript.scrollHeight;
    nextButton.disabled = messageIndex === scriptedMessages.length - 1;
    messageIndex += 1;
  }

  nextButton.addEventListener('click', () => {
    if (canSpeak) {
      window.speechSynthesis.cancel();
      stopButton.disabled = true;
    }
    appendMessage();
    status.textContent = 'Scripted message displayed.';
  });

  appendMessage();
  if (!canSpeak) {
    speakButton.disabled = true;
    stopButton.disabled = true;
    status.textContent = 'Speech playback is not available in this browser.';
  } else {
    stopButton.disabled = true;
    status.textContent = 'Speech is optional. Select Read aloud to hear the latest line.';
    speakButton.addEventListener('click', () => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(transcript.lastElementChild.textContent);
      utterance.rate = 0.95;
      utterance.onend = () => {
        stopButton.disabled = true;
        status.textContent = 'Playback complete.';
      };
      utterance.onerror = () => {
        stopButton.disabled = true;
        status.textContent = 'Speech playback could not be completed.';
      };
      try {
        window.speechSynthesis.speak(utterance);
        stopButton.disabled = false;
        status.textContent = 'Reading the latest message aloud.';
      } catch (error) {
        stopButton.disabled = true;
        status.textContent = `Speech playback failed: ${error.message}`;
      }
    });
    stopButton.addEventListener('click', () => {
      window.speechSynthesis.cancel();
      stopButton.disabled = true;
      status.textContent = 'Speech stopped.';
    });
    document.addEventListener('click', event => {
      if (event.target.closest('#ai-window [data-control="close"]')) {
        window.speechSynthesis.cancel();
        stopButton.disabled = true;
      }
    });
    window.addEventListener('pagehide', () => window.speechSynthesis.cancel(), { once: true });
    return;
  }
}
