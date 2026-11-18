# HILFER — Integration Contracts

**Current experiment:** source-to-report reconciliation. This is the implemented vertical-slice UX for Jessica, not a finalized rule for every future case. Static evidence/case content lives in JSON. The central store owns gameplay state. The report remains a derived projection — never a second save.

## Run and checks

From the repository root:

    python scripts/serve.py --port 8080

Open http://127.0.0.1:8080. The launcher binds to localhost and serves static files. Node 18+ runs the unit suites with `node --test` or `npm test`.

For browser checks, keep the server running and install Playwright and Microsoft Edge in your test environment. Set `HILFER_PLAYWRIGHT_MODULE` to the absolute path to Playwright's `index.mjs` if it is installed outside the project. `HILFER_URL` defaults to `http://127.0.0.1:8080`.

```sh
node tests/browser.check.js
node tests/assistant.browser.check.js
node tests/mail.browser.check.js
node tests/theme.browser.check.js
```

## Player-facing flow

1. Reconciliation opens with the **Consolidated Report**. CASE-001 already contains HR-014's **unverified** work-eligibility claim: AVAILABLE. The report does not reveal the competing Occupational Health claim.
2. Open Records; select a department and inspect a document. The `workEligibility` field is a single contextual button, `Compare status with report`. Other metadata and medical classifications remain ordinary information.
3. Selecting the field invokes the `onClaim(recordId, field)` callback and opens Reconciliation's **Case Register** with an inline comparison of the initial source and the inspected source. The player sees actual values, source IDs and dates.
4. Selecting the existing HR source does not complete the case. The player can keep the existing entry to investigate further. Choosing **Update report** immediately validates and files the supported replacement; there is **no extra Commit button, dropdown, or required drag**.
5. The consolidated report becomes filed, explicitly cites both HR-014 and OH-008 and shows `NOT_CLEARED`. Occupational causation remains `NOT_ESTABLISHED`, a distinct sourced assertion rather than an adjudicated incident-causality claim.
6. CASE-002 unlocks and distortion level rises to 1 exactly once. Reload restores the filed report; Start → Reset Demo Progress resets it to the provisional HR baseline.

## Data model

`data/records.json` defines stable record ID, type, title, department, employeeId, employee, timestamp/date, workPeriod, fields, caseIds and note. Static JSON is immutable in the store. Records exposes browsable documents rather than raw JSON.

`data/cases.json` defines `requiredEvidence`, authoritative `resolution: {field,value,sourceId}`, unlock rules, report metadata and optional **`provisional: {field,value,sourceId}`**. A provisional source must exist in the registry and support the specified value. It is an **existing report assertion**, not a correct or committed finding. The initial report reveals only its existing source, never the supported replacement.

`CASE-001` is the only fully playable example. `CASE-002` remains an explicitly reserved/unimplemented placeholder. Do not invent other tasks simply to show a progress bar.

## Ownership and APIs

`js/main.js` creates `createStore({records,cases,storage})` and mounts both apps using the same store.

Public store methods:

- `getRecord(id)`, `getRecords()`, `getCases()`, `getState()`, `getWarning()`.
- `discover(recordId)`: register a known record when inspected. Filing also registers the existing report source; this list is not an independent inspection history. Browsing search results does not discover records.
- **`reconcileClaim(caseId, recordId, field)`**: use a *previously inspected*, case-relevant field. Reject locked, completed, unknown, unsupported or baseline-only selections. For a valid revised source, link only the valid baseline and chosen records (any other required evidence must already be attached), validate against the case definition, atomically file the canonical resolution and emit progression events. This is the new primary action.
- `attachEvidence(caseId, recordId)`, `removeEvidence(caseId, recordId)`, `submitResolution(caseId, resolution)`: existing validated **legacy domain APIs** retained for compatibility and tests. They are not player-facing requirements for this iteration.
- `subscribe(fn)`, `onEvent(fn)`: subscribe to state and milestone events.
- `resetProgress()`: revert to a fresh session.

The Records adapter is `mountRecords(root, store, {onClaim})` from `js/apps/records-fixture.js`. `renderRecord(record)` generates a visually differentiated employee/medical form and a `data-claim-record` + `data-claim-field` button where appropriate. New record types need field-specific interaction metadata; **do not hardcode all records as `workEligibility`**.

Reconciliation is `mountReconciliation(root, store, {openRecord})` from `js/apps/reconciliation.js`, returning `focusComparison()`, `presentClaim(recordId,field)`, `getActiveCaseId()` and `showReport()`. `js/main.js` bridges Records' `onClaim` to Reconciliation's `presentClaim`, then focuses the Reconciliation window. The link back to Records is `openRecord(id)`, which clears search filters and opens the requested source. `window.hilfer` exposes the store and Reconciliation APIs for development and tests.

### Claim workflow contract

`Records → onClaim(recordId, field) → Reconciliation.presentClaim(...)`

That action opens a comparison but does **not** mutate the official finding. When the player chooses the new source:

`Reconciliation → store.reconcileClaim(caseId, recordId, field) → saved resolution + milestone events`

This keeps UI selection, provenance validation, and administrative commitment distinct without forcing separate manual forms. The comparison's "Continue reviewing" option dismisses the proposal but **does not** falsely mark the discrepancy resolved.

## Living report

`js/apps/report.js` exports `deriveReport(cases,state,getRecord)` and `renderReport(report)`. It renders provisional values before reconciliation and authoritative source/context references after reconciliation. It does not persist a second document or imply that every sourced field is independently verified.

Source references navigate to Records. Report case links navigate to Case Register. The report is the player's work product and a later storytelling device about what HILFER permits to be entered into an official record.

## Persistence and progression

Key: `hilfer:save:v1`. Contents: version, discoveredEvidenceIds, attachedEvidence, resolutions, completedCaseIds, unlockedCaseIds, distortionLevel. No images, static JSON or separate report copy.

Save loading validates known/relevant IDs and reconstructs unlocks/distortion by replaying valid resolutions. Invalid/incompatible saves start clean; inaccessible storage allows in-memory play and displays a warning.

Milestone events are delivered by `store.onEvent` after state changes:

| Event | Detail |
| --- | --- |
| `hilfer:evidence-discovered` | `{recordId}` |
| `hilfer:evidence-attached` | `{caseId,recordId}` |
| `hilfer:case-reconciled` | `{caseId,resolution}` |
| `hilfer:case-unlocked` | `{caseId,byCaseId}` |
| `hilfer:distortion-changed` | `{previousLevel,level}` |
| `hilfer:progress-reset` | `{}` |

The distortion module listens for reconciliation milestones, not clicks or elapsed browser time. Replaying the same filed case must not duplicate milestones.

## Asset boundaries

Original art is in `assets/arwa/`, with provenance and usage guidance in `assets/arwa/CREDITS.md`. `css/assets.css` centralizes shell asset paths; `css/arwa.css` styles the shell, and `css/hilfer.css` supplies game document layouts, claim comparisons and effects. Original upstream desktop snapshot in `references/WIN98-template/` remains unchanged.

The initial medical/HR document graphics are placeholders pending Arwa's application-specific work. Prioritize legibility and believable paper/report composition, not more instructions or giant panels.

## Legacy drag contract — not the primary mechanic

The original store still validates ID-based attachment and explicit submission; the `beginRecordDrag(event,recordId)` helper is retained for compatibility. MIME was `application/x-hilfer-record-id`. Current document views do **not** require a drag or file tray. Do not reintroduce them without a considered UX test.

## Review questions

- Does selecting a highlighted status field feel discoverable without revealing its significance?
- Does comparing existing/current source claims communicate why one supersedes another?
- Can a first-time player finish Jessica without being coached?
- How should genuinely ambiguous evidence, official procedural constraints, and later nonlinear cases differ without multiplying UI controls?

## Editorial presentation

`js/apps/shared.js` formats display values, dates and document titles. Canonical enums, IDs and save data stay unchanged. Records prioritizes employee, document type and issued date; exact references and classifications live in native **Record details** disclosures. The report shows readable status/source/context, with audit provenance inside details. Technical placeholders are omitted from report rendering only; progression and the case register retain them.
## Contextual HILFER Assistant (demo)

`data/assistant.json` owns English correspondence for the configured case. `deriveAssistant(state, records, content)` in `js/apps/ai.js` projects welcome, investigating (relevant evidence discovered) and filed (committed resolution) phases. `mountAI` uses the existing store subscriptions/events; it never changes evidence, resolutions or progression. There is no LLM or Next-message sequence.

The Assistant is docked above the taskbar. An unseen dialogue signal opens its balloon without taking focus. The portrait, report notification and shell shortcut also open it manually. The shell dispatches `hilfer:assistant-open` for those shortcuts. Opening the correspondence manually acknowledges the report update in `hilfer:assistant:v1`. Demo reset clears the receipts and delivers the welcome again. Unavailable storage retains session behavior.

The existing `hilfer:case-reconciled` event plays the imported glitch cue at 20% volume for at most 1.5 seconds. The visual microglitch remains 650 ms. Reload/duplicate submissions do not emit another cue; reset/page exit stops playback. Rejected audio playback never interrupts filing or assistant notification.

Checks: `node --test`, existing `node tests/browser.check.js`, and `node tests/assistant.browser.check.js` (same Playwright/Edge environment variables). The assistant check covers fresh play, contextual messages, actual audio start/stop, unread/read reloads, reset/replay, rejected audio, portrait variance, balloon dismissal and focus, and mobile notification access.

## Graphite appearance

Display Properties → Color scheme → Archive / Graphite switches to Arwa's desaturated artwork across desktop, title bars, taskbar, Start, department folders, record-file glyphs and the logo. Asset choices live in `css/assets.css`; the palette and Altynai's multiply treatment live in `css/arwa.css`. Theme selection is independent of gameplay/distortion and uses the existing session-only selector. Distortion aliases retain the selected theme; returning to Standard restores its original art. `node tests/theme.browser.check.js` checks both directions, actual Jessica reconciliation, reload and mobile.

The desktop uses the pixelated HILFER logo by default. Display Properties still offers **Use original logo / Use pixelated logo** for live demo comparisons. It sets presentation-only `data-logo-style` on the root and overrides `--art-desktop-logo`; paper/Start logos are unaffected. An explicit choice remains through color-scheme changes during the session, using the matching pixel variant when appropriate. Reload restores the pixelated default; no game/save state is changed.

## HILFER Mail

`data/emails.json` is the fixed demo corpus of five conversations and twelve messages. Inbox has three conversations, Archive has two, and Sent has no messages from Reconciliation Desk. All timestamps are provisional. See [MAIL_CONTRACT.md](MAIL_CONTRACT.md) for the original corpus contract.

`createMailModel` applies the configured grants before listing, searching, counting, opening or resolving a reference. `setGrants(grants)` updates those gameplay permissions and removes access to any now-restricted reader. The corpus is part of the static app bundle.

- `listThreads()` returns one row per authorized conversation, ordered by its latest applicable message. The row includes a preview. Search expands a matching message when the conversation opens. Sent derives membership from mail actually sent by Reconciliation Desk.
- `selectThread(id)` selects without marking mail read. `openThread(id)` marks the whole conversation read. Each thread has one independent desktop window with dates, sender details and expandable messages. Readers can coexist, are not restored on reload, and close on demo reset or revoked access.
- `setThreadDeleted(id, value)` moves or restores a thread locally. Deleted Items has its own search scope and is excluded from ordinary search. Restore returns the thread to its authored folder and any applicable Sent view.
- `getReference(messageId, recordId)` resolves authorized references. MAIL-004 opens HR-014 through the existing Records API. Reading or moving mail does not change formal Reconciliation state.

Read IDs/folder/selected thread and optional selected message ID persist under `hilfer:mail-ui:v1` with version 1, independently of game/Assistant saves. Invalid or inaccessible storage falls back to safe in-memory reading. `hilfer:progress-reset` clears Mail receipts, query and selection. Keyboard: arrows/Home/End select table rows or folders without reading; Enter opens the selected message, Ctrl+F focuses search, Escape closes a message or menu. Tab/Enter operate native menus, controls and Records links.

Checks: `node --test` includes fixed-corpus hash, reference/anchor validation, sorting, access denial/direct lookups/counts, revoked grants, receipt persistence/reset/blocked storage and game-state separation. `node tests/mail.browser.check.js` verifies all 12 exact bodies and metadata, five conversations, empty Sent, search, HR-014 navigation and Jessica, reload/reset, restricted fixture, keyboard/mobile/Graphite, malformed/blocked receipts and window controls.

The standard-library static launcher `scripts/serve.py` (also `npm start`) uses a larger connection accept queue. Default Python HTTP-server backlog intermittently refused simultaneous startup asset requests on this Windows host; five cold boots passed with the increased queue. It serves only static files from the repository, binds localhost and adds no runtime backend or dependency.

## Glitch system (scripted narrative events)

`js/effects/glitch-system.js` exports `mountGlitchSystem(store, {storage, root, sounds})`,
returning `{triggerGlitch(id, {key, payload, once}), hasTriggered, resetGlitches}`. Each
glitch is a scripted visual sequence with a defined duration, an associated sound, and a
cleanup; none mutates evidence, resolutions, case or Mail state. "Already triggered" flags
are stored separately from gameplay progress under `hilfer:glitches:v1` (`{version,
triggered}`), following the same pattern as the Assistant's own UI receipt. Malformed or
unavailable storage degrades to in-session-only behavior, like the rest of the shell.
`hilfer:progress-reset` clears it via `resetGlitches()`.

Registered glitches: `desktop_distortion` (first glitch — see below), `email_multiplication`
(visual duplicate windows, triggered on the first opened Mail message in `js/apps/emails.js`) and
`error_windows` (a cascading, then rapidly self-closing, stack of system-error dialogs, with
its own error sound). All only ever create transient DOM elements appended to `#desktop` with
`inert` set where applicable (`desktop_distortion`'s overlay element, plus the echo/dialog
windows of the other two); none are registered with `script.js`'s window manager (no taskbar
entry, no real window ID, no focus/z-index persistence), so they cannot corrupt real window or
Mail state.

**`email_multiplication` triggers on the first opened Mail message**, regardless of folder;
this makes the second glitch visible during normal inbox use. **`error_windows` remains tied to
Tito's `MAIL-010`**. Each real message opens first; after a short delay, the applicable visual
copies or transient system-error dialogs appear, play their supplied sounds, and clean
themselves up. The actual Mail reader remains usable afterward. These are scoped presentation
events, not new investigation mechanics.

**`desktop_distortion` (first glitch) — re-added.** A previous iteration of this glitch was
reverted at the user's request back to the plain `html.microglitch` flourish in
`js/effects/distortion.js`. The 2026 "Final Glitch Fixes" request explicitly asked for this
glitch back, considerably more visual, and fixed the white-screen bug the old prototype left
behind — see "White-screen root cause" below. `html.microglitch` itself is untouched and keeps
firing its own brief shake on every `hilfer:case-reconciled` (not just the first); the two are
independent and visually layer rather than conflict.

`desktop_distortion` triggers once, the first time `completedCaseIds.length` reaches 1 (wired
in `js/main.js`). It appends a `.desktop-glitch-overlay` div to `#desktop` and toggles
`.desktop-glitch-active` on `#desktop`, driving a five-stage, ~3.4s CSS animation
(`css/hilfer.css`: `desktopGlitchShift`/`Overlay`/`Jitter` keyframes) — normal completion, an
initial small-scale RGB/offset disruption, a stronger escalation burst, a quiet beat where the
AI-state swap (below) lands, then stabilization. The overlay/class are removed by a JS timer
matched to the animation length, so nothing persists afterward; `prefers-reduced-motion`
disables the animations.

**White-screen root cause:** the old `:root[data-distortion="1"] #desktop` rule set
`background-image: linear-gradient(#fdebe8,#fdebe8), var(--wallpaper-distorted)`, but
`--wallpaper-distorted` was never defined anywhere (it fell back to the initial value `none`),
so only the near-white gradient layer painted over the entire desktop. The fix removes that
undefined-var background swap entirely; distortion is now expressed with `filter` on `#desktop`
plus the scanline overlay already present, and the real wallpaper now lives in
`--wallpaper-clean` (see "AI state / wallpaper sync" below) instead of being replaced by a
second, broken variable.

### AI state / wallpaper sync

`js/effects/ai-state.js` exports `mountAIState(store, {storage})` → `{get, set, advance, reset,
portraitFor, wallpaperFor}`. One integer state (persisted under `hilfer:ai-state:v1`, a UI-only
namespaced key separate from gameplay saves) drives both the AI assistant's portrait
(`js/apps/ai.js`, via `aiState.portraitFor(state)`) and the desktop wallpaper (written to the
`--wallpaper-clean` CSS custom property on `:root`), so the two can never desync. Setting the
state dispatches `window` event `hilfer:ai-state-changed`, which `ai.js` listens for directly to
refresh its `<img>` — no separate polling state machine. The two recurring authored milestones
(first case completion and the first opened Mail message) each skip one intermediate asset
(`advance(2)`), producing display stages 1 → 3 → 5. Their order is independent; the state
controller clamps at the last available portrait/wallpaper pair.

`AI_PORTRAITS` / `WALLPAPERS` in that module list the actual supplied files found under
`assets/arwa/ai_states/` (`ai1.png`, `ai2.png`, `3.png`, `4.png`, `7.png`) and
`assets/arwa/wallpapers/` (`1.png` through `11.png`, of which `1`–`4` and `7` are used so the
array lengths line up 1:1 with the AI-portrait array). The filenames carry no explicit ordering
contract from Arwa; state 0 → 4 is an editorial choice (ai1 "nominal" → ai2 → 3 → 4 → 7
"most distorted") recorded here so it can be corrected in one place if the intended order
differs. The first-case `desktop_distortion` advances the shared state at its midpoint, and the
first Mail-message opening advances it when the email multiplication glitch fires. These are
meaningful milestones, not arbitrary UI interactions; state does not reset when closing the
Assistant window. A reload reapplies the saved state to both portrait and wallpaper, and
`hilfer:progress-reset` resets it to state 0. Reset Demo Progress also clears the session-only
logo style override so the pixelated logo default is restored.

## Footage application

`js/apps/footage.js` exports `mountFootage(root)`, mounted onto `#footage-app` inside the
`#footage-window` section in `index.html` (window id `footage`, already present in
`script.js`'s `applicationTitles`/desktop icon, previously falling back to an auto-generated
placeholder window because no real markup or app existed yet). `FOOTAGE_ITEMS` is a plain
array of `{id, title, description, src, staticSrc}`; add entries there for future footage, no
other code changes required. Only `assets/footage/first hald draft.mov` currently exists and is
used (there is no second clip — do not add placeholder entries for footage that doesn't
exist). The player is a native `<video>` with custom play/pause, seek, time, volume and
fullscreen controls, reusing Reconciliation's `.app-toolbar` / `.reconciliation-tabs` /
`.case-list` / `.case-detail` classes for visual consistency rather than introducing new chrome.
`assets/sounds/static-humming.wav` plays (looped) only while the video is actually playing —
started on the video's `play` event, stopped on `pause`/`ended`/window-close/`pagehide` — never
on merely opening the app. Browser autoplay restrictions are handled by starting the static
track from the same `play` event the user's own Play-button click produces, so it has a user
gesture to piggyback on.

## Reports application

`js/apps/reports.js` exports `mountReports(root)`, mounted onto `#reports-app` inside the
`#reports-window` section (window id `reports`, same previously-placeholder situation as
Footage). `REPORT_ITEMS` lists the two files actually found in `assets/reports/` (`3 (1).png`,
`4 (1).png`) as `format: 'image'`; the viewer renders them with `<img>` at native resolution
inside a scrollable pane, original files untouched, no added/invented metadata or OCR text.
`assets/arwa/reports/report_spacco.png` / `report_tim.png` are a separate, unrelated-looking
pair (likely UI reference art rather than sample case reports) and were **not** added to
`REPORT_ITEMS` — flag this to Arwa/the team if they were meant to appear here too. A `format:
'text'` case is scaffolded in `renderViewer` for a plain-text report if one is added later;
anything else falls back to an explicit "not yet supported" message rather than silently
omitting the file.

## Custom cursors

`cursor.png` / `cursor_finger.png` are preserved as supplied masters. Their nearest-neighbor
96px derivatives are reduced again to small 32px-high browser cursor assets
(`assets/arwa/cursor-small.png`, `assets/arwa/cursor_finger-small.png`) and wired via CSS
`cursor: url(...) <hotspot-x> <hotspot-y>, <fallback>` in `css/hilfer.css`:
the default cursor on `html, body`, and the finger cursor on an explicit selector list covering
buttons, links, desktop icons, tabs, list rows and range inputs across every app (not scoped to
one window), each with a generic fallback keyword per the CSS spec. The cursor artwork is
18×32px and 26×32px respectively, with hotspots scaled to match; the supplied masters are not
replaced or modified.

### Classic Mail windows (second UI iteration)

The two supplied reference images govern layout only; their mockup folders/messages were not imported. Mail now has a menu bar, disabled unsupported outgoing actions, a beveled toolbar, a left folder tree, and a message table (state/From/Subject/Received) with no preview. Counts and read icons are per-message; the legacy conversation counts remain available in the model. Prev/Next select rows; Open or double-click/Enter opens the actual message. On narrow screens the table scrolls horizontally instead of dropping columns or shrinking text.

Each reader is a `.window` under `#desktop` registered through existing `openWindow`/`closeWindow`, drag/resize/control/focus/taskbar handling. One reader per message is reused; different messages coexist, survive closing Mail, and show their real subject in title/taskbar. The shell resolves dynamic titles from `.window-title` and emits `hilfer:window-closed` with `{windowId}`. Readers use 14px text and independent body scrolling. Reset removes every reader; permission revocation also removes unauthorized readers. Open windows themselves are not restored after reload, while receipts and selection remain compatible with v1 saves.
