# Phase 2 - Build Spec

Step-by-step specification for Phase 2, written for the Claude Code session
that implements it. `docs/PHASE-2.md` says what and why; this file says how.
When they disagree, this file wins. Phase 1 conventions still apply
(`CLAUDE.md`, `docs/PHASE-1-BUILD.md` ground rules).

Work one milestone at a time. At the end of each: `npm run format`,
`npm run typecheck`, `npm test`, verify the "Done when", commit, push, report,
stop.

---

## How the pieces link (read first)

```text
Leaflet QR  ──▶  https://amitdobry.github.io/workshop/?ref=LEAF5      (the landing page "בונים עם AI")
                    │  remembers the marker, shows three demo cards
                    ▼
             https://rhythm-runner-eight.vercel.app/?ref=LEAF5         (the game; M6 remembers it too)
                    │  play -> results -> workshop reveal
                    ▼
             https://amitdobry.github.io/workshop/?ref=LEAF5#contact   (the form + WhatsApp, credited to leaflet LEAF5)
```

The **leaflet marker** is defined by the landing page (source:
`amitdobry/memory-game`, `public/js/attribution.js`) and the game copies its
rules exactly, never inventing its own:

- `?ref=CODE` where CODE matches `/^[A-Za-z0-9]{3,12}$/`, stored upper-cased
  (the printed leaflets use `LEAF1`..`LEAF6`);
- or the older `?b=N` where N matches `/^[1-6]$/`, stored as `B` + N;
- anything else is "no marker". The marker is remembered in `localStorage` so
  a later visit is still credited. `ref` wins when both are present.

In this spec the remembered value is called `ref` (a string, `''` when none).

---

## M6. Conversion foundation

### Scope in one list

1. Hebrew only, right-to-left, everywhere.
2. Play before nickname: landing page with one big button; nickname only to save.
3. Four-step playable tutorial on first visit.
4. Results screen: animated numbers, save-score step, workshop reveal, sign-up button.
5. "Behind the game" panel.
6. Anonymous funnel analytics carrying the leaflet marker, plus a key-protected summary.
7. The dartboard pace target under the due foot (pulled forward from M8; see
   "Pace target" under M8 for the geometry). Rendering only.

Not in M6: any change to game balance, rendering of the scene other than the
pace target, the engine's
rules, the scores API, or the leaderboard logic. `client/src/game/engine.ts`,
`course.ts`, `pace.ts`, `scoring.ts` do not change. `config.ts` changes
**only** in the `label` strings of `TERRAIN` and `WEATHER`.

### Files

```text
client/index.html                      lang="he" dir="rtl", Heebo font link, Hebrew <title>
client/src/text/he.ts                  every user-visible string (new)
client/src/text/he.test.ts             no stray Latin (new)
client/src/text/links.ts               WORKSHOP_URL and workshopLink(ref) (new)
client/src/analytics/analytics.ts      sid, ref, track() (new)
client/src/game/tutorial.ts            pure tutorial state machine (new)
client/src/game/tutorial.test.ts       (new)
client/src/game/config.ts              Hebrew labels only
client/src/game/render.ts              HUD and banner strings from he.ts; RTL text settings
client/src/game/useGameLoop.ts         listenToInput option
client/src/App.tsx                     routes: / landing, /play, /enter -> /
client/src/pages/LandingPage.tsx       replaces HomePage.tsx (rename)
client/src/pages/PlayPage.tsx          tutorial, results flow, reveal, behind panel
client/src/pages/EnterPage.tsx         delete (its form moves into LandingPage and the results step)
client/src/player/RequirePlayer.tsx    delete (nothing is gated any more)
client/src/components/NicknameForm.tsx shared nickname form (new)
client/src/components/TutorialOverlay.tsx (new)
client/src/components/WorkshopReveal.tsx  (new)
client/src/components/BehindTheGame.tsx   (new)
client/src/components/Footprint.tsx    moved out of PlayPage (new)
client/src/styles.css                  RTL, landing, tutorial, reveal, panel
server/src/events/events.ts            validation, record, summary (new)
server/src/routes/events.ts            POST /api/events, GET /api/events/summary (new)
server/src/config.ts                   optional ADMIN_KEY
server/src/database/mongo.ts           COLLECTIONS.events + indexes
server/src/app.ts                      mount the router
server/test/events.test.ts             (new)
.env.example                           ADMIN_KEY line
docs/API.md                            events routes
```

### 1. Hebrew and RTL

- `client/index.html`: `<html lang="he" dir="rtl">`, `<title>Rhythm Runner - רץ הקצב</title>`,
  a Google Fonts link for **Heebo** 400/700/900 (the landing page's font), CSS
  `font-family: 'Heebo', system-ui, sans-serif` on `body` and in `render.ts`'s
  font constants.
- `client/src/text/he.ts` exports one frozen object `T` with **every** string a
  user can see, including HUD labels, banner texts, button labels, hints,
  errors and the reveal copy. Components import `T`; no Hebrew literal lives in
  a component. Numbers are formatted with `toLocaleString('he-IL')`.
- `he.test.ts`: walks every string value in `T` and asserts it contains no
  Latin letters except in this allowlist: `Rhythm Runner`, `PC`, `F`, `J`,
  `AI`, `Claude Code`. This is the guard that keeps the app Hebrew.
- Everything that is spatial stays in physical position: the left pad is on
  the physical left (`.play-pads { direction: ltr }`), the runner stays at the
  left third, the pace meter keeps "early" on the left. Only text direction
  changes.
- Numbers and Latin tokens inside Hebrew text get `<bdi>` or the `.num` class
  (`direction: ltr; unicode-bidi: isolate`), as the landing page does.
- `render.ts`: Hebrew labels via `ctx.direction = 'rtl'` for text runs that are
  Hebrew; keep `textAlign` positions as they are. Numbers drawn separately from
  their labels so they never reorder.
- `config.ts` labels become Hebrew (the only change in that file):
  flat `כביש ישר. קצב קבוע!`, uphill `עלייה! צעדים איטיים וחזקים`,
  downhill `ירידה! רגליים מהירות`, water `מים! צעדים גדולים ואיטיים`,
  rain `גשם. צעדים זהירים`, wind `רוח נגדית. ממשיכים לדחוף`, clear ``.

The string table. Use exactly these; add missing ones in the same register
(short, warm, second person plural, exclamation marks only where shown):

| Key                 | Hebrew                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| brand               | Rhythm Runner                                                                                                                    |
| tagline             | רצים בקצב של הכביש                                                                                                               |
| playNow             | מתחילים!                                                                                                                         |
| start               | יאללה, רצים!                                                                                                                     |
| practiceAgain       | לתרגל שוב                                                                                                                        |
| skip                | דלגו                                                                                                                             |
| left                | שמאל                                                                                                                             |
| right               | ימין                                                                                                                             |
| perfect             | מושלם!                                                                                                                           |
| good                | טוב!                                                                                                                             |
| otherFoot           | הרגל השנייה!                                                                                                                     |
| tooFast             | מהר מדי                                                                                                                          |
| tooSlow             | לאט מדי                                                                                                                          |
| skipped             | פספסתם צעד                                                                                                                       |
| stumble             | אופס! נפילה                                                                                                                      |
| time                | זמן                                                                                                                              |
| speed               | מהירות                                                                                                                           |
| energy              | אנרגיה                                                                                                                           |
| combo               | קומבו                                                                                                                            |
| score               | ניקוד                                                                                                                            |
| distance            | מרחק                                                                                                                             |
| bestCombo           | הקומבו הכי טוב                                                                                                                   |
| accuracy            | דיוק                                                                                                                             |
| playedOnPc          | מחשב                                                                                                                             |
| playedOnMobile      | טלפון                                                                                                                            |
| runFinished         | סיימתם את הריצה!                                                                                                                 |
| runAgain            | עוד פעם!                                                                                                                         |
| home                | לדף הבית                                                                                                                         |
| saveScore           | שמירת התוצאה בטבלה                                                                                                               |
| nicknameLabel       | איך לקרוא לכם? כינוי, לא שם מלא                                                                                                  |
| nicknamePlaceholder | למשל: קפטן קוד                                                                                                                   |
| enter               | כניסה                                                                                                                            |
| playedBefore        | כבר שיחקתי, יש לי כינוי                                                                                                          |
| hello               | שלום, {name}                                                                                                                     |
| logOut              | יציאה                                                                                                                            |
| rank                | מקום {n} בטבלה                                                                                                                   |
| scoreNotSaved       | התוצאה לא נשמרה, אבל הריצה הייתה אמיתית                                                                                          |
| highScores          | טבלת השיאים                                                                                                                      |
| tabPc               | מחשב                                                                                                                             |
| tabMobile           | טלפון                                                                                                                            |
| yourBest            | השיא שלכם: {score} · {runs} ריצות                                                                                                |
| noRunsYet           | עוד אין ריצות. תהיו הראשונים!                                                                                                    |
| scoresUnavailable   | הטבלה לא זמינה כרגע                                                                                                              |
| tutorialTitle       | בואו נתרגל                                                                                                                       |
| tutorialHint        | לחצו על הרגל שמהבהבת                                                                                                             |
| tutorialOtherFoot   | הרגל השנייה!                                                                                                                     |
| tutorialDone        | מעולה! מוכנים?                                                                                                                   |
| pcHowTo             | רגל שמאל: ← או F. רגל ימין: → או J. שומרים על הקצב של הכביש.                                                                     |
| mobileHowTo         | לוחצים שמאל, ימין, שמאל, ימין, בקצב של הכביש.                                                                                    |
| landscapeHint       | סובבו את הטלפון לעמידה                                                                                                           |
| revealTitle         | שיחקתם במשחק שנבנה עם בינה מלאכותית                                                                                              |
| revealBody          | עמית בנה את המשחק הזה יחד עם AI. בסדנה "בונים עם AI" ילדים לומדים להפוך רעיונות משלהם למשחקים ולאפליקציות אמיתיים.               |
| revealCta           | לפרטים והרשמה לסדנה                                                                                                              |
| behindLink          | איך בינה מלאכותית עזרה לבנות את המשחק?                                                                                           |
| behindTitle         | מאחורי המשחק                                                                                                                     |
| behindSteps         | 1. עמית תיאר את רעיון המשחק. 2. ה-AI עזר לתכנן את החוקים. 3. ה-AI כתב קוד. 4. עמית בדק, תיקן ושיפר. 5. ביחד הפכו רעיון למשחק חי. |
| behindRule          | חוק אחד מתוך המנוע: צעד מושלם = מהירות +2, אנרגיה +3, קומבו +1                                                                   |
| behindBridge        | בסדנה הילדים לומדים בדיוק את הדרך הזאת: מרעיון לאפליקציה.                                                                        |
| behindClose         | סגירה                                                                                                                            |
| builtWith           | נבנה על ידי עמית עם Claude Code                                                                                                  |

### 2. Flow and routing

```text
/        LandingPage   brand, tagline, huge "מתחילים!" -> /play
                       under it: top 5 of the detected platform (public), "כבר שיחקתי, יש לי כינוי"
                       (expands NicknameForm inline; after entering: "שלום, X", personal best, "יציאה"),
                       the full High scores panel (as in M4), "איך בינה מלאכותית עזרה..." link (BehindTheGame),
                       footer "נבנה על ידי עמית עם Claude Code"
/play    PlayPage      works with or without a session
/enter   -> Navigate to "/" (old links keep working)
```

- `RequirePlayer` is deleted. `PlayerContext` stays: it still fetches `/me`
  on load and exposes `player`, `enter`, `logout`.
- `NicknameForm` is the old `EnterPage` form, as a component: label, input,
  button, error line; calls `enter(nickname)` and an `onEntered` callback.

### 3. Tutorial

`client/src/game/tutorial.ts` (pure, tested):

```ts
export const TUTORIAL_FEET: Foot[] = ['left', 'right', 'left', 'right'];
export interface TutorialState {
  stepIndex: number;
  expected: Foot;
  done: boolean;
  hint: 'none' | 'otherFoot';
}
export function createTutorial(): TutorialState; // stepIndex 0, expected 'left'
export function tutorialPress(state: TutorialState, foot: Foot): TutorialState;
// right foot: stepIndex + 1, expected = next in TUTORIAL_FEET, hint 'none', done when stepIndex === 4
// wrong foot: same stepIndex, hint 'otherFoot'. There is no failure state.
```

`TutorialOverlay.tsx` sits over the canvas: title, hint line, two large
footprints (the `Footprint` component), the expected one pulsing (CSS
animation), a small "דלגו" link. On the fourth correct press it shows
"מעולה! מוכנים?" for 700 ms, then the page starts the countdown. Runs when
`localStorage.rr_tutorial_done` is absent; sets it on completion or skip.
"לתרגל שוב" on the pre-start overlay runs it again.

Input during the tutorial: `PlayPage` owns one `handleFoot(foot)`; the pads
call it always; in tutorial mode it goes to `tutorialPress`, otherwise to
`pressFoot`. `useGameLoop(canvasRef, config, { listenToInput })`: when
`listenToInput` is false the hook attaches no keyboard or canvas listeners, and
`TutorialOverlay` attaches its own (same key map, left half / right half).

Tests: the four-press happy path; a wrong foot sets the hint and does not
advance; `done` after four; presses after `done` change nothing.

### 4. Results screen

Order on the results overlay, top to bottom:

1. "סיימתם את הריצה!"
2. Distance, score, best combo, accuracy, platform. Score and distance count
   up from 0 to the final value over 600 ms (`requestAnimationFrame`, ease-out).
3. Save step:
   - signed in: submit once as in M4, show "מקום {n} בטבלה" or "התוצאה לא נשמרה...".
   - not signed in: button "שמירת התוצאה בטבלה" -> `NicknameForm` inline ->
     on entered, submit the **pending summary** (held in `PlayPage` state) ->
     rank line. If the child presses "עוד פעם!" instead, the unsaved run is
     gone; that is fine and needs no warning.
4. Buttons: "עוד פעם!" (large, primary) and "לדף הבית".
5. `WorkshopReveal`: appears 1.2 s after the results (fade in), below the
   buttons, never covering the numbers: title, body, one button "לפרטים והרשמה
   לסדנה" that opens `workshopLink(ref)` in a new tab. The button is not
   rendered when `WORKSHOP_URL` is empty.
6. Link "איך בינה מלאכותית עזרה לבנות את המשחק?" -> `BehindTheGame` panel
   (modal card: title, the five steps as a list, the one rule in a code-like
   box, the bridge line, close). Same component on the landing page.

`client/src/text/links.ts`:

```ts
export const WORKSHOP_URL = 'https://amitdobry.github.io/workshop/';
export function workshopLink(ref: string): string;
// no marker:        WORKSHOP_URL + '#contact'
// ref 'LEAF5':      WORKSHOP_URL + '?ref=LEAF5#contact'
// legacy 'B3':      WORKSHOP_URL + '?b=3#contact'      (the landing page understands both)
```

### 5. Analytics

Client `client/src/analytics/analytics.ts`:

- `sid`: 20 random `[a-z0-9]` characters, created once, `localStorage.rr_sid`.
- `ref`: on load apply the marker rules above to `location.search`; if a
  marker is found store it in `localStorage.rr_ref`; otherwise read the stored
  one (re-validated); else `''`. Pure function `readMarker(search): string`
  exported and unit-tested: `?ref=leaf5` -> `LEAF5`; `?b=3` -> `B3`;
  `?ref=x` -> `''`; `?b=9` -> `''`; `?ref=LEAF2&b=3` -> `LEAF2`.
- `track(name: EventName, data?: Record<string, number | string | boolean>)`:
  `fetch('/api/events', { method: 'POST', keepalive: true, body: JSON.stringify({ sid, name, platform, ref, data }) })`,
  errors swallowed. Never send the nickname or any free text.
- `EventName` union, exactly: `landing_viewed`, `play_pressed`, `tutorial_started`,
  `tutorial_completed`, `tutorial_skipped`, `run_started`, `run_completed`,
  `run_abandoned`, `run_again`, `save_pressed`, `score_saved`,
  `returning_entered`, `leaderboard_viewed`, `workshop_shown`,
  `workshop_clicked`, `behind_opened`.
- `run_completed` data: `{ score, distance, accuracy, bestCombo, skipped, misses, platform }`
  (numbers only). `run_abandoned` data: `{ atSeconds }`. `landing_viewed` once
  per page load. `run_abandoned` fires from `PlayPage`'s unmount or
  `pagehide` while `phase === 'running'`.

Server:

- `server/src/config.ts`: `adminKey: process.env.ADMIN_KEY?.trim() || null`.
- `COLLECTIONS.events`; indexes `{ at: 1 }` with `expireAfterSeconds` 180 days,
  `{ name: 1, at: -1 }`, `{ ref: 1, at: -1 }`.
- `events.ts`: `EVENT_NAMES` (the union above), `validateEvent(body)`:
  `sid` 8-40 chars `[a-z0-9]`, `name` in the list, `platform` in
  `pc|mobile|unknown`, `ref` `''` or `/^[A-Z0-9]{1,12}$/`, `data` absent or an object with
  at most 8 keys whose values are finite numbers, booleans, or strings of at
  most 40 characters; serialised `data` at most 512 bytes. `recordEvent`,
  `summarize(db, days)` returning
  `{ days, byName: { [name]: { events, sessions } }, byRef: { [ref]: { opened, played, completed, workshopClicked } } }`
  (`ref` `''` is reported under the key `direct`)
  where each figure counts distinct `sid`s (`opened` = `landing_viewed`,
  `played` = `run_started`, `completed` = `run_completed`).
- `routes/events.ts`: `POST /api/events` -> `204` always when the body is valid
  (also when the database is down: analytics never fails the client); `400`
  when invalid. `GET /api/events/summary?days=7` (1..90, default 7): `404` when
  `ADMIN_KEY` is unset or the `x-admin-key` header does not match; `503`
  without a database; else `200` with the summary.
- Tests (no database): valid event -> 204; unknown name -> 400; sid with a
  dash -> 400; data with 9 keys -> 400; summary without key -> 404; with a
  wrong key -> 404 (set `ADMIN_KEY` in the test's environment before
  `createApp`); with the right key and no database -> 503.
- `.env.example`: `ADMIN_KEY=` with a comment. `docs/API.md`: both routes.

### 6. The marker on the game side

Any game URL with `?ref=CODE` or `?b=N` sets `ref` as above; it is sent with
every event and put into `workshopLink`. The landing page already links to the
game with the visitor's marker and reads it back on `#contact`; nothing else
is needed for credit to flow.

### Done when

- On a phone, a fresh visit to `/?ref=LEAF5` reaches the results screen with taps
  only: `מתחילים!` -> four tutorial taps -> countdown -> run -> results. No
  typing anywhere before that.
- Saving with a nickname puts the run on the board and shows a rank.
- The workshop button opens `https://amitdobry.github.io/workshop/?ref=LEAF5#contact`.
- `he.test.ts` passes; no English text is visible anywhere except the brand,
  key names and "AI" / "Claude Code".
- With `ADMIN_KEY` set in Vercel, `GET /api/events/summary?days=1` with the
  header shows ref `LEAF5` with `opened`, `played` and `completed` at 1 or more.
- All tests green: server 22 + new events tests, client 45 + tutorial + he.

---

## M7. Replay and social (outline; spec before starting)

Weekly board default with all-time tab; own row under the top 10; personal
best celebration; one truthful contextual challenge per run; result card
(canvas-generated PNG, native share, download, copy link); nickname safety.

## M8. Character polish (outline; spec before starting)

Face and expressions, squash and stretch, three colourways, finish climax,
weather transitions.

### Pace target: a dartboard under the due foot (Amit, 2026-09-21)

Replace the single pulsing footprint ring with a **static target** and a
**moving ring**, so the player sees exactly when to step:

- The target sits under the due foot: three concentric zones like a dartboard.
  Red outside, a yellow band, a green disc in the middle.
- The moving ring starts large right after the previous step and shrinks
  linearly towards the centre, reaching the edge of the green disc exactly at
  `nextDueMs`. Step when the ring is on green.
- The zones are the timing windows made visible. With `interval` the current
  target interval and `base` the green radius in pixels:
  ring radius `r(t) = base * (1 + (nextDueMs - t) / interval)` (so it keeps
  shrinking past due, into the centre: "too slow");
  green disc: `base * (1 - perfect/interval)` .. `base * (1 + perfect/interval)`;
  yellow band out to `base * (1 + good/interval)` and in to `base * (1 - good/interval)`;
  red beyond. The bands are therefore wider on mobile, automatically.
- On a step the ring freezes for 150 ms where it was and flashes the result
  colour; on a skipped step the target flashes red and the ring restarts.
- A new segment changes `interval`, so the ring visibly speeds up or slows
  down: the pace change becomes something you see, not only read.
- Colours: green `FLASH_PERFECT`, yellow `FLASH_GOOD`, red `FLASH_BAD`, ring white.

This is a rendering change only; `engine.ts` already exposes everything it
needs (`nextDueMs`, `expectedFoot`, `currentTargetIntervalMs`, the windows in
`config`). **Pulled forward into M6 as item 7** (Amit, 2026-09-21): it replaces
the M3 pace ring in `render.ts` (`drawPaceRing` and the footprint pulse); the
footprint flash on events stays. The green disc radius `base` is the old ring's
resting radius. Acceptance: at 100 steps per minute on flat ground a
first-time adult can tell from the target alone, sound off, when to step.

---

## Landing page task (outside this repo)

Done by the planner on 2026-09-21. The live landing page
(<https://amitdobry.github.io/workshop/>) is published by the `amitdobry/workshop`
repository's workflow **from the source in `amitdobry/memory-game`**,
`landing/index.html` (local clone: `C:\Users\Admin\AI workshop 10-13`). That
source now has a third card "דוגמה 03 - Rhythm Runner", a three-column grid on
desktop, and a script that rewrites the card's link with the visitor's marker
(`?ref=CODE` or `?b=N`). Its static-site test covers the card.

The folder `AI Workshop\App 2 - day 2-5\landing-page` is an old copy and is
marked as superseded; do not edit it.
