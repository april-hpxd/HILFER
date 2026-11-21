import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const moduleName = process.env.HILFER_PLAYWRIGHT_MODULE;
const { chromium } = await import(moduleName ? pathToFileURL(moduleName).href : 'playwright');
const browser = await chromium.launch({headless:true,channel:'msedge'});
const target = process.env.HILFER_URL || 'http://127.0.0.1:8080';
const errors = [];
const listen = page => {
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  page.on('requestfailed', r => {
    const reason = r.failure()?.errorText;
    // Stopping/unloading the short cue may cancel the remaining media download.
    if (new URL(r.url()).pathname === '/assets/sounds/glitch.mp3' && reason === 'net::ERR_ABORTED') return;
    errors.push(reason + ' ' + r.url());
  });
};
const ready = async page => { await page.waitForFunction(() => window.hilfer); };
const openAssistant = async page => {
  if (!(await page.locator('#start-menu').isVisible())) await page.locator('.start-button').click();
  await page.locator('.start-menu-item[data-open="ai"]').click();
};
const observe = async page => page.evaluate(() => {
  window.cuePlays = 0; window.filings = 0;
  document.querySelector('#glitch-sound').addEventListener('play', () => window.cuePlays++);
  hilfer.onEvent(({type}) => { if (type === 'hilfer:case-reconciled') window.filings++; });
});
const fileJessica = async page => {
  await page.locator('#ai-app [data-open="records"]').click();
  await page.locator('[data-file-id="HR-014"]').click();
  assert.match(await page.locator('.ai-transcript').textContent(), /review remains open/);
  await page.locator('[data-file-id="OH-008"]').click();
  await page.locator('.claim-source').click();
  await page.locator('.claim-apply').click();
};
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}}); listen(page);
  await page.addInitScript(() => {
    const voiceKey = 'hilfer:assistant-dialogue:v1';
    if (!localStorage.getItem(voiceKey)) {
      localStorage.setItem(voiceKey, JSON.stringify({
        version: 1, caseId: 'CASE-001', completedIds: ['welcome', 'welcome-v2', 'investigating', 'filed']
      }));
    }
    window.assistantPlays = 0;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.src.includes('/assets/sounds/assistant/')) {
        window.assistantAudio = this;
        window.assistantPlays++;
      }
      return play.call(this);
    };
  });
  await page.goto(target); await ready(page);
  await openAssistant(page);
  for (const path of ['assets/sounds/glitch.mp3', 'assets/arwa/icons/assistant-pixel.webp']) {
    assert.equal((await page.request.get(new URL(path, target).href)).status(), 200);
  }
  assert.ok(await page.locator('#assistant-notification').isHidden());
  const balloon = page.locator('#assistant-balloon');
  const launcher = page.locator('#assistant-portrait');
  assert.ok(await launcher.isVisible());
  assert.ok(await balloon.isVisible(), 'assignment delivery opens the balloon without a click');
  assert.ok(await page.locator('.ai-transcript').evaluate(el => el === document.activeElement));
  await page.waitForFunction(() => window.assistantAudio?.currentTime > 0);
  assert.match(await page.evaluate(() => assistantAudio.src), /welcome-v3\.mp3$/);
  assert.equal(await balloon.getByRole('button', {name:'Mute'}).count(), 0);
  await page.getByRole('button', {name:'Dismiss Assistant'}).click();
  assert.ok(await balloon.isHidden());
  assert.ok(await page.evaluate(() => !assistantAudio.paused), 'dismissing the balloon leaves playback running');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('hilfer:assistant-dialogue', {detail:{signal:'assignment.available'}})));
  assert.ok(await balloon.isHidden(), 'duplicate delivery does not reopen the balloon');
  await launcher.click();
  assert.equal(await page.evaluate(() => assistantPlays), 1);
  await page.waitForFunction(() => assistantAudio.ended);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('hilfer:assistant-dialogue:v1')).completedIds.includes('welcome-v3'));
  await launcher.click();
  await launcher.click();
  assert.equal(await page.evaluate(() => assistantPlays), 1);
  const portrait = page.locator('.ai-avatar');
  assert.equal(await portrait.getAttribute('src'), 'assets/arwa/ai_states/ai1.png');
  assert.ok(await portrait.evaluate(async img => { await img.decode(); return img.naturalWidth > 0; }));
  assert.match(await page.locator('.ai-transcript').innerText(), /Welcome to HILFER/);
  assert.equal(await page.locator('[data-ai-next]').count(), 0);
  assert.doesNotMatch(await page.locator('.ai-transcript').innerText(), /OH-008|NOT_CLEARED|Not cleared/);
  await page.locator('#ai-app [data-open="records"]').click();
  assert.ok(await page.evaluate(() => assistantAudio.paused));
  await page.locator('[data-file-id="HR-014"]').click();
  await page.reload(); await ready(page); await openAssistant(page);
  assert.match(await page.locator('.ai-transcript').innerText(), /review remains open/);
  assert.ok(await page.locator('#assistant-notification').isHidden());
  assert.ok(await page.locator('#glitch-sound').evaluate(el => el.paused && el.currentTime === 0));
  await observe(page); await fileJessica(page);
  assert.ok(await balloon.isVisible(), 'filing opens the balloon without an Assistant click');
  assert.ok(await page.locator('#assistant-notification').isVisible());
  assert.deepEqual(await page.evaluate(() => hilfer.getState().completedCaseIds), ['CASE-001']);
  await page.waitForFunction(() => cuePlays === 1);
  await page.waitForFunction(() => document.querySelector('#glitch-sound').paused);
  assert.ok(await page.locator('#glitch-sound').evaluate(el => el.currentTime === 0 && el.volume === 0.2));
  assert.equal(await page.evaluate(() => filings), 1);
  await page.waitForFunction(() => hilfer.aiState.get() === 1);
  await page.waitForFunction(() => cuePlays >= 2);
  await page.waitForFunction(() => document.querySelector('#glitch-sound').paused);
  await page.evaluate(() => hilfer.reconcileClaim('CASE-001','OH-008','workEligibility'));
  assert.equal(await page.evaluate(() => cuePlays), 2); assert.equal(await page.evaluate(() => filings), 1);
  await page.screenshot({path:join(tmpdir(), 'hilfer-assistant-notification.png')});
  // Unread correspondence survives reload without replaying audiovisual rewards.
  await page.reload(); await ready(page);
  assert.ok(await page.locator('#assistant-notification').isVisible());
  assert.ok(await balloon.isHidden(), 'reload does not repeat a delivered popup');
  assert.equal(await portrait.getAttribute('src'), 'assets/arwa/ai_states/ai2.png');
  assert.ok(await portrait.evaluate(async img => { await img.decode(); return img.naturalWidth > 0; }));
  assert.ok(await page.locator('#glitch-sound').evaluate(el => el.paused && el.currentTime === 0));
  assert.ok(await page.locator('html').evaluate(el => !el.classList.contains('microglitch')));
  await page.locator('#assistant-notification').focus();
  await page.keyboard.press('Enter');
  assert.ok(await balloon.isVisible());
  assert.ok(await page.locator('#assistant-notification').isHidden());
  assert.ok(await page.locator('.ai-transcript').evaluate(el => el === document.activeElement));
  assert.match(await page.locator('.ai-transcript').innerText(), /entry for Jessica has been revised/);
  assert.notEqual(await page.locator('.ai-avatar').evaluate(el => getComputedStyle(el).filter), 'none');
  await page.screenshot({path:join(tmpdir(), 'hilfer-assistant-filed.png'), animations:'disabled'});
  assert.equal(await page.locator('.taskbar-item[data-window="ai"]').count(), 0, 'the docked Assistant does not create a taskbar window');
  await page.keyboard.press('Escape');
  assert.ok(await balloon.isHidden());
  assert.equal(await launcher.getAttribute('aria-expanded'), 'false');
  assert.ok(await launcher.evaluate(el => el === document.activeElement));
  await openAssistant(page);
  assert.ok(await balloon.isVisible());
  await page.getByRole('button',{name:'Dismiss Assistant',exact:true}).click();
  assert.ok(await balloon.isHidden());
  await page.reload(); await ready(page);
  assert.ok(await page.locator('#assistant-notification').isHidden(), 'read receipt survives reload');
  await page.locator('.start-button').click(); await page.locator('#reset-progress').click();
  await openAssistant(page);
  assert.match(await page.locator('.ai-transcript').innerText(), /Welcome to HILFER/);
  assert.doesNotMatch(await page.locator('.ai-transcript').innerText(), /entry for Jessica has been revised/);
  assert.equal(await page.locator('.ai-avatar').evaluate(el => getComputedStyle(el).filter), 'none');
  assert.equal(await portrait.getAttribute('src'), 'assets/arwa/ai_states/ai1.png');
  assert.equal(await page.evaluate(() => localStorage.getItem('hilfer:assistant:v1')), null);
  await observe(page); await fileJessica(page);
  await page.waitForFunction(() => cuePlays === 1); assert.ok(await page.locator('#assistant-notification').isVisible());
  // A failed audio cue must never roll back filing or suppress the notification.
  await page.evaluate(() => hilfer.resetProgress()); await openAssistant(page);
  await page.evaluate(() => { document.querySelector('#glitch-sound').play = () => Promise.reject(new Error('blocked')); });
  await fileJessica(page);
  assert.deepEqual(await page.evaluate(() => hilfer.getState().completedCaseIds), ['CASE-001']);
  assert.ok(await page.locator('#assistant-notification').isVisible());

  const mobile = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const small = await mobile.newPage(); listen(small); await small.goto(target); await ready(small); await openAssistant(small);
  await fileJessica(small); assert.ok(await small.locator('#assistant-notification').isVisible());
  const notice = await small.locator('#assistant-notification').boundingBox();
  assert.ok(notice.x >= 0 && notice.x + notice.width <= 390);
  await small.locator('#assistant-notification').click();
  assert.ok(await small.locator('#assistant-notification').isHidden());
  const mobileBalloon = await small.locator('#assistant-balloon').boundingBox();
  assert.ok(mobileBalloon.x >= 0 && mobileBalloon.x + mobileBalloon.width <= 390);
  await small.screenshot({path:join(tmpdir(), 'hilfer-assistant-mobile.png'), animations:'disabled'});
  await small.waitForFunction(() => document.querySelector('#glitch-sound').paused);
  await mobile.close();
  assert.deepEqual(errors, []);
  console.log('PASS: contextual Assistant, manual opening, dismiss/focus, notification, portrait variance, sound once, reload/reset and mobile; no missing assets or JS errors.');
} finally { await browser.close(); }
