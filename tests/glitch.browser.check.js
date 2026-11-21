import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const moduleName = process.env.HILFER_PLAYWRIGHT_MODULE;
const { chromium } = await import(moduleName ? pathToFileURL(moduleName).href : 'playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const target = process.env.HILFER_URL || 'http://127.0.0.1:8080';

try {
  await page.addInitScript(() => {
    window.audioPlayRequests = [];
    HTMLMediaElement.prototype.play = function () {
      if (this instanceof HTMLAudioElement) window.audioPlayRequests.push(new URL(this.src).pathname);
      return Promise.resolve();
    };
  });
  await page.goto(target);
  await page.waitForFunction(() => window.hilfer);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('hilfer:glitches:v1', JSON.stringify({
      version: 1,
      triggered: ['desktop_distortion:case-1', 'email_multiplication:first-open', 'error_windows:MAIL-010']
    }));
  });
  await page.reload();
  await page.waitForFunction(() => window.hilfer);

  const open = async id => {
    if (!(await page.locator('#start-menu').isVisible())) await page.locator('.start-button').click();
    await page.locator('.start-menu-item[data-open="' + id + '"]').click();
  };
  await open('emails');
  await page.locator('[data-mail-row="THREAD-DESK-HANDOFF"]').dblclick();
  await page.waitForFunction(() => document.querySelectorAll('.mail-message-window.glitch-window-echo').length === 9);
  assert.ok(await page.locator('.glitch-window-echo').first().isVisible());
  assert.equal(await page.locator('.glitch-window-echo').first().evaluate(el => getComputedStyle(el).opacity), '1');
  assert.equal(await page.evaluate(() => hilfer.aiState.get()), 1);
  assert.equal(await page.locator('.dead-pixel-field span').count(), 9);
  assert.equal(await page.locator('.ai-avatar').getAttribute('src'), 'assets/arwa/ai_states/ai2.png');
  assert.ok((await page.evaluate(() => audioPlayRequests)).some(src => src.endsWith('/static-humming.wav')));

  await page.locator('#mail-message-THREAD-DESK-HANDOFF-window [data-control="close"]').click();
  await page.locator('.mail-folders [data-mail-folder="archive"]').click();
  await page.locator('[data-mail-row="THREAD-TITO-RELAY"]').dblclick();
  await page.waitForFunction(() => document.querySelectorAll('.system-error-window').length === 7);
  assert.ok(await page.locator('.system-error-window').first().isVisible());
  assert.ok((await page.evaluate(() => audioPlayRequests)).some(src => src.endsWith('/error.wav')));
  assert.equal(await page.evaluate(() => hilfer.aiState.get()), 2);
  assert.equal(await page.locator('.dead-pixel-field span').count(), 18);
  assert.equal(await page.locator('.ai-avatar').getAttribute('src'), 'assets/arwa/ai_states/3.png');

  await page.locator('#mail-message-THREAD-TITO-RELAY-window [data-control="close"]').click();
  await page.locator('#emails-window [data-control="close"]').click();
  const fileFirstCase = async () => page.evaluate(() => {
    hilfer.discover('OH-008');
    const result = hilfer.reconcileClaim('CASE-001', 'OH-008', 'workEligibility');
    if (!result.ok) throw new Error(result.message);
  });
  await fileFirstCase();
  await page.waitForFunction(() => hilfer.aiState.get() === 3);
  assert.equal(await page.locator('.ai-avatar').getAttribute('src'), 'assets/arwa/ai_states/4.png');
  await page.waitForFunction(() => !document.querySelector('#desktop').classList.contains('desktop-glitch-active'));
  await open('footage');
  await page.locator('#footage-window video').evaluate(video => video.dispatchEvent(new Event('pause')));
  assert.equal(await page.locator('#mail-draft-window').count(), 0, 'pausing footage does not trigger the reaction');
  const glitchCuesBeforeFootage = await page.evaluate(() => audioPlayRequests.filter(src => src.endsWith('/glitch.mp3')).length);
  await page.locator('#footage-window video').evaluate(video => video.dispatchEvent(new Event('ended')));
  const draft = page.locator('#mail-draft-window');
  await page.waitForSelector('.footage-scripted-cursor-visible');
  assert.ok(await page.locator('html').evaluate(el => el.classList.contains('scripted-cursor-active')));
  assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).cursor), 'none');
  const startingCursor = await page.locator('.footage-scripted-cursor').getAttribute('style');
  await page.waitForFunction(() => !document.querySelector('#footage-window').classList.contains('visible'));
  assert.notEqual(await page.locator('.footage-scripted-cursor').getAttribute('style'), startingCursor, 'the simulated cursor moves to close Footage');
  assert.ok(await page.locator('#emails-window').isHidden(), 'Mail stays closed until the cursor reaches its icon');
  await page.waitForFunction(() => (document.querySelector('#mail-draft-window textarea')?.value.length ?? 0) > 0);
  const typedLength = (await draft.locator('textarea').inputValue()).length;
  await page.waitForTimeout(700);
  const typedIncrement = (await draft.locator('textarea').inputValue()).length - typedLength;
  assert.ok(typedIncrement <= 6, 'the scripted draft types at a readable pace');
  await page.waitForFunction(() => document.querySelector('#mail-draft-window')?.dataset.scriptedTyping === 'complete');
  assert.equal(await page.evaluate(() => hilfer.aiState.get()), 4);
  assert.equal(await page.locator('.dead-pixel-field span').count(), 36);
  assert.equal(await page.locator('.dead-pixel-field span[data-dead-pixel="black"]').count(), 9);
  assert.equal(await page.locator('.dead-pixel-field span[data-dead-pixel="rgb"]').count(), 27);
  assert.equal(await page.locator('.ai-avatar').getAttribute('src'), 'assets/arwa/ai_states/7.png');
  assert.ok(await page.evaluate(before => audioPlayRequests.filter(src => src.endsWith('/glitch.mp3')).length > before, glitchCuesBeforeFootage),
    'the post-footage visual transition plays its glitch cue');
  assert.ok(await page.locator('#footage-window').isHidden());
  assert.ok(await page.locator('#emails-window').isVisible());
  assert.equal(await draft.getAttribute('aria-label'), 'Unsent Mail draft');
  assert.equal(await draft.locator('textarea').inputValue(), 'YOU WERE NOT SUPPOSED TO SEE THAT');
  assert.equal(await draft.locator('.scripted-draft-status').textContent(), 'Text entered. Draft remains unsent.');
  assert.equal(await draft.locator('button').count(), 1, 'the draft has a close control but no send action');
  assert.equal(await draft.locator('textarea').evaluate(el => el.readOnly), true);
  assert.equal(await draft.evaluate(el => el.dataset.scriptedTyping), 'complete');
  assert.equal(await page.locator('.footage-scripted-cursor').count(), 0, 'the scripted cursor disappears when typing completes');
  assert.ok(!(await page.locator('html').evaluate(el => el.classList.contains('scripted-cursor-active'))), 'native cursor control returns when typing completes');
  assert.notEqual(await page.locator('html').evaluate(el => getComputedStyle(el).cursor), 'none');
  assert.doesNotMatch(await page.evaluate(() => JSON.stringify(Object.entries(localStorage))), /YOU WERE NOT SUPPOSED TO SEE THAT/);
  await page.locator('#footage-window video').evaluate(video => video.dispatchEvent(new Event('ended')));
  assert.equal(await page.locator('#mail-draft-window').count(), 1, 'a repeated ended event does not create another draft');
  await draft.locator('[data-control="close"]').click();
  assert.ok(await draft.isHidden(), 'closing the draft hides its shell window');
  assert.equal(await page.locator('.footage-scripted-cursor').count(), 0);
  assert.ok(!(await page.locator('html').evaluate(el => el.classList.contains('scripted-cursor-active'))), 'closing the draft restores the real pointer');

  const reset = async () => {
    await page.evaluate(() => document.querySelector('#reset-progress').click());
  };
  await reset();
  assert.equal(await draft.count(), 0, 'progress reset removes the transient scripted draft');
  assert.equal(await page.locator('.footage-scripted-cursor').count(), 0);
  assert.ok(!(await page.locator('html').evaluate(el => el.classList.contains('scripted-cursor-active'))), 'reset restores the real pointer');
  assert.ok(await page.locator('[data-open="footage"]').first().isEnabled(), 'Footage remains clickable after reset');
  await fileFirstCase();
  await page.waitForSelector('#desktop.desktop-glitch-active');
  assert.equal(await page.locator('#desktop').evaluate(el => getComputedStyle(el).animationName), 'desktopGlitchShift');
  assert.equal(await page.locator('.desktop-glitch-overlay').evaluate(el => getComputedStyle(el, '::before').animationName), 'desktopGlitchTearA');
  await page.waitForFunction(() => {
    const overlay = document.querySelector('.desktop-glitch-overlay');
    return overlay &&
      Number(getComputedStyle(overlay, '::before').opacity) > .6 &&
      Number(getComputedStyle(overlay).opacity) > .3;
  }, null, { timeout: 3500 });
  await page.waitForFunction(() => hilfer.aiState.get() === 1);
  assert.equal(await page.locator('.dead-pixel-field span').count(), 9);
  await page.waitForFunction(() => !document.querySelector('#desktop').classList.contains('desktop-glitch-active'));
  await reset();
  await fileFirstCase();
  await page.waitForSelector('#desktop.desktop-glitch-active');
  assert.equal(await page.locator('#desktop').evaluate(el => getComputedStyle(el).animationName), 'desktopGlitchShift');
  await page.waitForFunction(() => !document.querySelector('#desktop').classList.contains('desktop-glitch-active'), null, { timeout: 5000 });
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('hilfer:glitches:')) localStorage.removeItem(key);
    }
  });
  await page.reload();
  await page.waitForFunction(() => window.hilfer);
  assert.ok(!(await page.locator('#desktop').evaluate(el => el.classList.contains('desktop-glitch-active'))),
    'a saved completed first case does not replay glitch one on page load');
  assert.deepEqual(errors, []);
  console.log('PASS: Mail echoes, MAIL-010 error sequence, post-footage unsent draft, first-case distortion, AI stage, dead pixels, and reset/replay.');
} finally {
  await browser.close();
}
