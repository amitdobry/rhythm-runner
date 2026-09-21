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
8. Feel and difficulty: easier windows, softer penalties, and every step
   answered on screen (see "Item 8" below). Config values and rendering only.
9. Sound: Amit's recordings for every moment, plus a quiet loop (built; see
   "Item 9"). Follow-ups: mute button, start-cue length, failure-sound priority.
10. One game, one board: no device toggle, a single leaderboard (see "Item 10").

Not in M6: rendering of the scene other than items 7 and 8, the engine's
rules, the scores API, or the leaderboard logic. `client/src/game/engine.ts`,
`course.ts`, `pace.ts`, `scoring.ts` do not change. `config.ts` changes only
in the `label` strings of `TERRAIN` and `WEATHER` and in the numbers listed
under item 8.

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
| yourBestOne         | השיא שלכם: {score} · ריצה אחת                                                                                                    |
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
                       under it: the full "High scores" panel (public, default tab = detected platform), then "כבר שיחקתי, יש לי כינוי"
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

### Item 8. Feel and difficulty (Amit, 2026-09-21: "it is too hard, and it

is not clear when I clicked right")

Two problems, two fixes. Neither touches `engine.ts`.

**A. Easier.** New values in `config.ts`. Everything not listed stays.

| Value                   | Was | Now | Why                                         |
| ----------------------- | --- | --- | ------------------------------------------- |
| PC perfectWindowMs      | 60  | 90  | a first-time adult lands green often enough |
| PC goodWindowMs         | 120 | 170 | yellow is a real zone, not a sliver         |
| Mobile perfectWindowMs  | 80  | 110 | thumbs                                      |
| Mobile goodWindowMs     | 160 | 210 |                                             |
| speed.start             | 4   | 6   | the world moves from the first second       |
| speed.perfectBoost      | 2   | 2.5 | green feels like a push                     |
| speed.goodBoost         | 1   | 1   | yellow is small progress                    |
| speed.missPenalty       | 3   | 1.5 | red is a small kill of pace, not a wall     |
| speed.decayPerSecond    | 0.8 | 0.6 | fewer punishing moments between steps       |
| speed.stumbleSpeed      | 1   | 2   |                                             |
| energy.missLoss         | 10  | 6   | a stumble takes a run of misses, not four   |
| energy.stumbleRecoverTo | 30  | 50  | getting up is a fresh chance                |

Wrong foot keeps costing the same as a miss (now small). `requireAlternatingFeet`
stays true. Terrain and weather tables unchanged. Engine tests that assert the
old literals must read the value from `DEFAULT_CONFIG` instead of a number;
the rules they test do not change. `docs/GAME-DESIGN.md` gets the new numbers.

**B. Every step answered.** In `render.ts`, for 220 ms after `lastEvent.atMs`
(stars 350 ms), driven by `lastEvent.kind`, all eased out, all sizes and
colours from constants at the top of the file:

| Event                         | Runner                             | Popup over the runner's head          | From the target                                           | Extra                               |
| ----------------------------- | ---------------------------------- | ------------------------------------- | --------------------------------------------------------- | ----------------------------------- |
| perfect                       | lunges forward 14 px, springs back | "+2.5" in FLASH_PERFECT, rising 30 px | eight stars burst outward and fade (FLASH_GOOD and white) | six speed streaks behind the runner |
| good                          | lunges 7 px                        | "+1" in FLASH_GOOD                    | three stars                                               |                                     |
| tooFast / tooSlow / wrongFoot | leans back 8 px                    | the Hebrew reason in FLASH_BAD        | target flashes red                                        | whole scene shakes 2 px for 120 ms  |
| skipped                       | none                               | "פספוס" in HUD_MUTED                  | target flashes red, ring restarts                         |                                     |
| stumble                       | existing tilt                      | "אופס!" in FLASH_BAD                  |                                                           | red vignette at the canvas edges    |

Stars: small five-point shapes, 4-7 px, launched from the target's rim at
random angles with a little upward bias, decelerating, fading to zero; drawn
from `lastEvent.atMs` and `state.distance` only (no random per frame: seed
the angles from `lastEvent.atMs` so two frames of the same state agree).

The popup numbers come from `config.speed` (`+${perfectBoost}`), never typed
in. The speed bar in the HUD flashes the result colour for the same 220 ms.
The pace meter in the HUD is removed: the dartboard (item 7) now carries that
information and the HUD gets simpler.

Acceptance: a first-time adult on PC finishes a run with energy above 0, sees
green often, and can say after one run which of their steps were good and
which were not, without being told.

### Item 8 outcome (reviewed 2026-09-21)

Done in commits `63174ca`, `15bdd33`, `c04614c`, `ed681c6`: the twelve values,
every step answered on screen, the board under the start button, the plural
fix, the docs. Four engine tests now read their expectations from
`DEFAULT_CONFIG`; the stumble test loops until energy runs out. `behindRule`
was corrected to say +2.5. Accepted as built. Amit's play-test decides whether
the windows move again.

Also shipped on Amit's direct request, accepted: `b673a4e` matches keys on
`event.code` (physical key) so F and J work on a Hebrew keyboard layout, with
`event.key` letters as a fallback; five tests including the Hebrew case.

### Item 9. Sound (built 2026-09-21 on Amit's direct request; recorded by Amit)

As built, commits `14d319b` to `599814f`. Files in `client/public/sounds/`,
named for **when** they play, not what they are:

| File          | Plays when                      | Size                              |
| ------------- | ------------------------------- | --------------------------------- |
| `start.mp3`   | the run starts (with the 3-2-1) | 58 KB                             |
| `perfect.mp3` | a perfect step                  | 33 KB                             |
| `good.mp3`    | a good step                     | 16 KB                             |
| `bad.mp3`     | too fast, too slow, wrong foot  | 68 KB                             |
| `sad.mp3`     | a beat passes with no step      | 31 KB                             |
| `stumble.mp3` | energy hits zero                | 40 KB                             |
| `finish.mp3`  | the run ends                    | 65 KB                             |
| `music.mp3`   | quiet loop during the run       | 3.75 MB, lazy-loaded at run start |

Effects are fetched on page load and decoded through Web Audio; playback waits
for the context to wake and the buffer to decode, so the first cue is heard.
The synthesized due-tick remains. Volumes are constants in `audio.ts`:
`MUSIC_VOLUME` 0.12, `EFFECT_VOLUME` 0.55, `TICK_VOLUME` 0.06, a guess until
Amit has listened.

Follow-ups, part of item 10's prompt:

- **Mute button.** A speaker icon in the play header and on the pre-start
  overlay; toggles all sound; remembered in `localStorage.rr_muted`; default
  on. A corridor demo needs a one-tap silence.
- **Start cue length.** The cue starts with the countdown; if the recording is
  longer than 3 s, fade it out over the last 200 ms so it never runs into the
  first step.
- **Failure sounds close together.** Priority order stumble > bad > sad. When
  a lower-priority failure sound would start within 300 ms of a higher one,
  skip it. The visual feedback always plays.
- **Music size.** Keep 3.75 MB for now (lazy-loaded). Amit may export a mono
  96 kbps version; if he does, drop it in with the same name.

### Item 10. One game, one board (Amit, 2026-09-21)

The phone layout is a responsive layout, not a second game. Supersedes the
"Two ways to play" table's override row, the pre-start toggle from M3 and the
two-board design from M4.

- **No toggle.** Remove the מחשב / טלפון buttons from the pre-start overlay.
  The layout is chosen by `detectPlatform()` alone. The `?platform=` URL
  override and `rr_platform` stay as a hidden testing aid, undocumented in the UI.
- **One leaderboard.** `GET /api/scores/top?limit`: no `platform` parameter (if
  one is sent, ignore it); `$match { course: 'level-1' }` only; one best row per
  player across both platforms. `GET /api/scores/me` -> `{ best: ScoreRow | null, runs }`.
  `rank` counts all other players. New index `{ course: 1, score: -1 }`; the old
  platform indexes may stay.
- **Platform kept for analytics.** `ScoreDoc.platform` and `RunSummary.platform`
  remain and are still validated; events keep `platform`. Nothing in the UI
  compares the two any more.
- **Client.** The "High scores" panel loses its tabs; one table; the player's row
  highlighted; `yourBest` / `yourBestOne` from the single best. The results
  line still says "מכשיר: מחשב / טלפון" as information, never as a category.
  Strings `tabPc`, `tabMobile` removed from `he.ts`.
- **Tests.** Server: `top` without `platform` -> 200 shape; the old 400 test goes.
  Smoke script: no `platform` in the top call; `me.best` is one row.
- **Docs.** `docs/API.md` scores section, `docs/GAME-DESIGN.md` ("one leaderboard
  for everyone"; remove "separate boards"), `docs/README.md` status.

Done when: the landing panel shows one list mixing Amit (phone) and any PC
run; the results screen shows a rank against everyone; no toggle anywhere.

### M6 complete (reviewed 2026-09-21)

Items 1-10 built and accepted; Amit's play-test on phone and PC: "really good,
fun". Item 10 (commits `6477d79` to `45424e9`): no toggle, one board with a
mixed PC/phone list on production, mute button, start-cue fade, failure-sound
priority. Also on Amit's direct request: `ee4c78f` hides the pads once the run
is over, `1a9ca5c` centres a button-shaped link. Implementer decisions
accepted: condition-style mute labels ("הקול פועל" / "הקול כבוי"); dead CSS
removed; `rememberPlatform` kept for the hidden override. Still not run: the
smoke script's real-database path (`server/.env` absent).

### M6 outcome, steps a-f (reviewed 2026-09-21)

Done in commits `10e6f22` to `3672cff`: 29 server tests, 64 client tests,
typecheck clean, engine files and balance untouched, Vercel files untouched.
Verified on production by the implementer: Hebrew RTL landing, practice with
four pad taps into the countdown, Hebrew HUD, marker remembered, events
routes answering. Items 7 (dartboard) done; item 8 not started, authorised
now as its own commits.

Implementer decisions, all accepted and now part of the spec:

- Dartboard `base` is 22 x scale (the old ring's 13 gave a 3 px green band)
  and the footprints are 46 x scale apart. The formulas define the target;
  the prose above was corrected to match them (green is a band, red centre).
- `he.test.ts` strips `{name}`-style placeholders before the Latin check.
- Six strings added: `name`, `meters`, `device`, `savingScore`, `entering`,
  `enterFailed`.
- The health line is gone from the landing page. The platform toggle stays on
  the pre-start overlay, labelled מחשב / טלפון. After "דלגו" the pre-start
  overlay shows; after completing the practice the countdown starts by itself.
- `run_abandoned.atSeconds` is timed in `PlayPage` with `Date.now()` (allowed
  there), capped at `runSeconds`.
- `readAdminKey()` in `config.ts`; the events TTL constant lives in
  `mongo.ts`; `?days=` clamps to 1-90; `BehindTheGame` was built with the
  landing page.

Two small fixes, to be done with item 8:

- Remove the separate top 5 on the landing page; the "High scores" panel moves
  up to sit directly under the מתחילים! button. Same names twice was noise.
- Grammar: when `runs === 1` use `yourBestOne` ("ריצה אחת"); otherwise
  `yourBest`.

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

## M7. Replay and identity

Three things: a weekly board so the top stays winnable, a personal-best
celebration so a good run has a moment, and a **nickname you claim with a
four-digit PIN** so nobody can play as you and a clean cache does not lose
you. Dropped from the earlier outline: the contextual challenge and the share
card (decide after the weekly board is live).

### Scope in one list

1. Sessions last a year, not a week.
2. Claim a nickname with a PIN at the first save; the PIN is asked only from a
   device the game does not know.
3. Weekly board (Sunday to Sunday, Israel time) as the default; all-time as the
   second view; the player's own row under the top 10 when outside it.
4. Personal-best celebration on the results screen.
5. Admin PIN reset behind the admin key.
6. Clean start: Amit drops `players`, `sessions` and `scores` in Atlas when M7
   deploys (indexes are recreated on the next cold start). Nothing on the
   board today is real.

Not in M7: engine, balance, rendering of the scene, sounds, analytics names
(two new events only, below).

### Files

```text
server/src/player/pin.ts            hashPin, verifyPin (scrypt), lock rules (new)
server/src/player/players.ts        PlayerDoc gains pin fields; claim / verify helpers
server/src/player/sessions.ts       SESSION_DAYS 365
server/src/routes/player.ts         enter with PIN; reset-pin (admin)
server/src/scores/week.ts           weekKeyFor(date) (new, pure, tested)
server/src/scores/scores.ts         weekKey on save; top by range; me by range; PB detection
server/src/routes/scores.ts         range query; me shape
server/src/database/mongo.ts        indexes
server/test/pin.test.ts, week.test.ts, players.test.ts, scores.test.ts, app.test.ts
scripts/smoke.mjs                   enter with PIN; wrong PIN; weekly top
client/src/components/NicknameForm.tsx   PIN field
client/src/pages/LandingPage.tsx         week / all-time switch, own row
client/src/pages/PlayPage.tsx            celebration; ranks line
client/src/components/Celebration.tsx    confetti (new)
client/src/services/api.ts, text/he.ts, analytics/analytics.ts, styles.css
docs/API.md, docs/GAME-DESIGN.md, docs/README.md
```

### 1. Sessions

`SESSION_DAYS = 365`. Cookie `maxAge` follows. The sessions TTL index already
expires by `expiresAt`, nothing else changes. A device that entered once stays
known for a year.

### 2. Claim a nickname with a PIN

**Data.** `PlayerDoc` gains `pinHash: string`, `pinSalt: string`,
`pinAttempts: number`, `pinLockedUntil: Date | null`. Every player has a PIN
(the wipe removes the old PIN-less ones).

**`pin.ts`** (pure except for randomness, `node:crypto` only, no dependency):

```ts
export const PIN_PATTERN = /^\d{4}$/;
export function isPin(value: unknown): value is string;
export function hashPin(pin: string, salt?: string): { hash: string; salt: string }; // scrypt, 16-byte random salt, N=16384, hex
export function verifyPin(pin: string, hash: string, salt: string): boolean; // timingSafeEqual
export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;
export function nextLock(
  attempts: number,
  now: Date
): { attempts: number; lockedUntil: Date | null };
// attempts+1; when it reaches MAX_ATTEMPTS -> lockedUntil = now + LOCK_MINUTES, attempts reset to 0
```

**`POST /api/player/enter`** body `{ nickname, pin }`:

| Case                                        | Result                                                               |
| ------------------------------------------- | -------------------------------------------------------------------- |
| bad nickname or `pin` not four digits       | `400` (`code: 'bad_input'`)                                          |
| name unknown                                | create player with the PIN, session, `200 { player, claimed: true }` |
| name known, locked (`pinLockedUntil` > now) | `423 { error, code: 'locked', retryAfterSeconds }`                   |
| name known, PIN matches                     | reset attempts, session, `200 { player, claimed: false }`            |
| name known, PIN wrong                       | `nextLock`, `401 { error, code: 'wrong_pin', attemptsLeft }`         |

A valid session cookie never needs a PIN: `GET /me` is unchanged. The
nickname is the only public part; the server never returns whether a name
exists except through this route's answer.

**`POST /api/player/reset-pin`** body `{ nickname }`, header `x-admin-key`:
clears the PIN (`pinHash = ''`) and the lock; `404` without the key (same
hiding as the events summary); `200 { ok: true }`. A player with an empty
`pinHash` is claimed by the next `enter` for that name, whatever PIN it brings.

**Client.** `NicknameForm` gets a second field: PIN, `inputMode="numeric"`,
`maxLength 4`, `autocomplete="off"`, masked, with a plain sentence under it.
One form for both the first claim and a return; the server decides. Errors
by `code`: `wrong_pin` -> `T.wrongPin`, `locked` -> `T.pinLocked` with the
minutes, `bad_input` -> `T.pinFormat`. The PIN is never stored in the browser;
the session cookie is what the device keeps. Strings:

| Key         | Hebrew                                                                              |
| ----------- | ----------------------------------------------------------------------------------- |
| pinLabel    | קוד סודי, 4 ספרות                                                                   |
| pinHint     | הקוד שומר על השם שלכם: בלי הקוד אף אחד אחר לא יכול לשמור תוצאה בשם הזה. תזכרו אותו! |
| pinFormat   | הקוד הוא בדיוק 4 ספרות                                                              |
| wrongPin    | הקוד לא מתאים לשם הזה. אם זה לא השם שלכם, בחרו שם אחר. נותרו {n} ניסיונות           |
| pinLocked   | יותר מדי ניסיונות. נסו שוב בעוד {minutes} דקות, או בחרו שם אחר                      |
| nameClaimed | השם {name} שלכם עכשיו. הקוד שומר עליו                                               |
| welcomeBack | ברוכים השבים, {name}!                                                               |

Events: `pin_wrong` (no data), `pin_locked`.

### 3. Weekly board

**Week key.** `week.ts`: `weekKeyFor(date: Date): string` returns the
`YYYY-MM-DD` of the Sunday that starts the week containing `date` **in
Asia/Jerusalem** (use `Intl.DateTimeFormat` with `timeZone: 'Asia/Jerusalem'`
to read the local weekday and date; no library). Tests: a Saturday 23:59
Jerusalem and the following Sunday 00:01 map to different keys; a Sunday maps
to itself; a UTC time that is already Sunday in Jerusalem but Saturday in UTC
maps to the Jerusalem Sunday. `weekEndFor(key)` gives the next Sunday.

**Save.** `ScoreDoc.weekKey` set from `createdAt` at save time. Index
`{ course: 1, weekKey: 1, score: -1 }`.

**Routes.**

```text
GET /api/scores/top?range=week|all&limit   default week, limit default 10 max 50, public
  -> 200 { range, weekStart, weekEnd, rows: ScoreRow[], me: { rank, row } | null }
     me is filled only when a valid session cookie is present and the player has a
     score in that range; rank is the player's position in that range (1 = best).
GET /api/scores/me
  -> 200 { best: { week: ScoreRow | null, all: ScoreRow | null }, runs }
POST /api/scores
  -> 201 { saved, rankWeek, rankAll, personalBest, previousBest }
     personalBest: true when score > the player's best before this save (first
     save counts as a personal best with previousBest null).
```

Leaderboard queries add `$match { weekKey }` for `week`. `rankOf` takes the
range. `bestScoreFor` is read **before** the insert to compute `personalBest`.

**Client.** The "High scores" panel: a small two-way switch "השבוע / כל הזמנים"
(default השבוע), a line under the title "הטבלה מתאפסת ביום ראשון" for the weekly
view, the table, and when `me` is present and `me.rank > rows.length`, a
separator and the player's own row with its rank. Strings: `thisWeek`
השבוע, `allTime` כל הזמנים, `resetsSunday` הטבלה מתאפסת ביום ראשון,
`yourRow` המקום שלכם.

### 4. Personal-best celebration

On the results screen, once the save answers with `personalBest: true`:

- A banner above the numbers: "שיא חדש!" (`T.newBest`), or "השיא הראשון
  שלכם!" (`T.firstBest`) when `previousBest` is null; large, FLASH_PERFECT.
- `Celebration.tsx`: 40 confetti pieces (DOM `<i>` elements, CSS animation,
  1.4 s, colours FLASH_PERFECT / FLASH_GOOD / white / RING), rendered once,
  removed after. No canvas change, no new sound (the finish cue already plays).
- The ranks line: "מקום {week} השבוע · מקום {all} בכל הזמנים" (`T.ranks`).
  Event: `personal_best`.

No celebration when `personalBest` is false; the ranks line still shows.

### 5. Tests (no database)

- `pin.test.ts`: isPin accepts `0000`, rejects `123`, `12345`, `12a4`; hash
  then verify true; wrong pin false; two hashes of the same pin differ (salt);
  nextLock reaches a lock at the fifth attempt and resets attempts.
- `week.test.ts`: the four cases above.
- `app.test.ts`: enter without pin -> 400; with pin and no database -> 503;
  reset-pin without key -> 404.
- `scores.test.ts`: top with `range=all` -> 503 (public, no 401); `range=x`
  -> 400; `validateRun` unchanged.
- Smoke script: enter new name + PIN -> 200 claimed; leave; enter same name
  wrong PIN -> 401 wrong_pin; right PIN -> 200 not claimed; save two runs, the
  second higher -> `personalBest` true then rank 1 in both ranges; top
  `range=week` contains the name with `me.rank` 1.

### Done when

- A fresh device saves a run under a new name with a PIN. Storage cleared, the
  same name with a wrong PIN is refused with the attempts-left message; with
  the right PIN it enters and the board greets it.
- The landing panel opens on "השבוע" with the reset line; "כל הזמנים" switches;
  a player outside the top 10 sees their own row.
- A run better than the player's previous best shows the banner and confetti;
  a worse run shows the ranks line only.
- Atlas collections dropped by Amit; the board starts empty; server tests
  (29 + new) and client tests (69 + new) green; production verified.

---

## M8. Character polish (outline; spec before starting)

Face and expressions, squash and stretch, three colourways, finish climax,
weather transitions.

### Pace target: a dartboard under the due foot (Amit, 2026-09-21)

Replace the single pulsing footprint ring with a **static target** and a
**moving ring**, so the player sees exactly when to step:

- The target sits under the due foot: three concentric zones like a dartboard.
  From the rim inward: red, a yellow band, a **green band** at the due
  radius, a yellow band, and a red centre (the centre means "far too late").
  The formulas below are the definition; this sentence only describes them.
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
