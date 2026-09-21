# Phase 1 - First Playable Level, Hosted

Date: 2026-09-21. Status: M1 done, M2 next.

Phase 1 turns the Phase 0 foundation into a game a leaflet visitor can open in
a browser and play for one minute: a two-footed runner on a road with hills,
water and weather, each setting the pace the player must match; speed and
energy; a score saved per player; a leaderboard for PC and one for phones. It
also gives the project its own home on Vercel, separate from every other
project on the account.

Phase 1 is planned here and built by a Claude Code session following
`docs/PHASE-1-BUILD.md`. The students meet the game in Phase 2 and change it
from there, so everything tunable lives in one config file and every game rule
is a plain, named function.

---

## Decisions

| Question             | Decision                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Host                 | Vercel, **a new Vercel project named `rhythm-runner`**, imported from `github.com/amitdobry/rhythm-runner`. Not the LIVE project.     |
| Server shape in prod | The same Express app, exported as one Vercel serverless function under `/api`. Local dev keeps `app.listen`.                          |
| Database             | Atlas Cluster0, database `rhythm_runner`, as in Phase 0. No new cluster.                                                              |
| Database user        | New user `rhythm_runner_app`, `readWrite` on `rhythm_runner` only. The admin user stays for the console.                              |
| Music                | A generated metronome click (Web Audio), no recorded track, so nothing copyrighted ships.                                             |
| Rendering            | HTML canvas 2D, no game framework. Enough for a road, a runner and parallax; easy to read for children.                               |
| Multiplayer          | Not in Phase 1. Leaderboard only. Live races would need WebSockets, which Vercel functions do not offer.                              |
| Input                | Two feet. PC: two keys (or click left/right half). Phone: two big pads at the bottom of the screen. Beats alternate feet.             |
| PC vs phone          | Two input profiles. Touch is slower and less precise, so the phone gets wider timing windows and its own leaderboard.                 |
| Pace                 | No fixed metronome. Each step is due one _target interval_ after the previous step; terrain and weather set that interval.            |
| Course               | A fixed level-1 course of segments (terrain + weather + length), repeating. New levels are new lists; new terrains are one table row. |

### Why Vercel

- Free Hobby tier, no sleeping: a leaflet visitor gets the page at once.
- One origin for client and API, so the `httpOnly` session cookie works
  unchanged and the client keeps calling `/api/...` with no CORS.
- Preview deployment for every push, production on `main`.

Costs of that choice, accepted:

- Express has to run as a function: the database connection is opened lazily
  and cached across warm invocations instead of at process start.
- Atlas Network Access must allow `0.0.0.0/0`, because function IPs change.
  The scoped database user is the real fence.
- No WebSockets. If Phase 2 wants live head-to-head races, the API moves to a
  small always-on host (Render or Railway) and the client stays on Vercel.
- Vercel Hobby is licensed for non-commercial use. If the workshop is a paid
  business, put this project on a Pro team instead. Same code, no changes.

---

## The game (baseline the students will extend)

The full rules, in plain words, are in `docs/GAME-DESIGN.md`. In short:

**Scene.** The runner stays at the left third of the canvas. Three layers
scroll left: sky and skyline (slow), pavement and props (medium), the road
(fast, tied to the runner's speed). The road ahead shows the coming segments:
slopes up and down, water, and the weather as rain or wind streaks.

**Two feet.** Steps alternate left, right. On PC: `←`/`F` and `→`/`J`, or a
click on the left or right half. On a phone: two large pads at the bottom,
one per thumb. The runner's forward leg and a pulsing footprint show which
foot is due.

**Pace.** Each step is due one _target interval_ after the previous step. Flat
and clear: 600 ms. Uphill x1.3, downhill x0.8, water x1.5; rain x1.15, wind
x1.1; factors multiply. A ring shrinking around the due footprint (and an
optional click) shows when. The pace meter in the HUD shows whether the last
step was early or late.

**Judging.** Perfect within 60 ms (phone 80): speed +2, energy +3, combo +1.
Good within 120 ms (phone 160): speed +1, combo +1. Too fast, too slow or the
wrong foot: speed -3, energy -10, combo 0. No step in time: skipped, combo 0,
the beat passes to the other foot. Every step also costs the ground's and the
weather's energy (uphill 1, water 2, rain 1).

**Speed and energy.** Speed is clamped to [0, 20] and decays 0.8 per second
(x1.5 in wind). Energy at 0 means a stumble: speed drops to 1, input is
ignored for one interval, then energy resets to 30 and a fresh step is due.

**Run.** 60 seconds. Score grows every moment by speed x combo multiplier (x1
at 0-9 combo, x2 at 10-19, x3 at 20+). Results show distance, score, best
combo, accuracy and rank on the PC or phone leaderboard.

All numbers above live in `client/src/game/config.ts` and are the first thing
the students will change in Phase 2.

### Architecture on the client

```text
client/src/
├── game/
│   ├── config.ts        every tunable number: windows, TERRAIN, WEATHER, LEVEL_1, PC/MOBILE profiles
│   ├── course.ts        which segment is at a distance; what is coming up
│   ├── pace.ts          target interval for a segment; judge an offset; opposite foot
│   ├── scoring.ts       combo multiplier, accuracy
│   ├── engine.ts        pure state machine: tick(state, dt), step(state, foot)
│   ├── platform.ts      detect PC vs phone, remember an override
│   ├── audio.ts         Web Audio clicks, unlocked on first input
│   ├── render.ts        draws a GameState onto a canvas (no logic)
│   └── useGameLoop.ts   the React hook that owns time, input and the canvas
├── pages/
│   ├── HomePage.tsx     lobby: Play, personal bests, PC and Mobile leaderboards
│   ├── PlayPage.tsx     canvas, pads on mobile, HUD, results overlay
│   └── EnterPage.tsx    unchanged
└── services/api.ts      + submitScore, fetchTopScores, fetchMyBest
```

`engine.ts`, `course.ts`, `pace.ts` and `scoring.ts` import nothing from the
DOM and are tested with vitest in Node. `render.ts`, `audio.ts`,
`platform.ts` and `useGameLoop.ts` are the only files that touch browser APIs.
The loop uses `requestAnimationFrame` with a fixed simulation step so speed
does not depend on frame rate.

### Architecture on the server

- New collection `scores`, added to `COLLECTIONS` in `mongo.ts`:
  `{ playerId, nickname, score, distance, accuracy, bestCombo, runSeconds, platform, course, createdAt }`
  with indexes `{ platform: 1, course: 1, score: -1 }` and
  `{ playerId: 1, platform: 1, score: -1 }`.
- Routes, all behind the session cookie (details in `docs/API.md`):
  - `POST /api/scores` saves a run. The server checks ranges and rejects
    impossible distances, scores and combos.
  - `GET /api/scores/top?platform=pc|mobile` leaderboard, one best row per
    player, separate per platform.
  - `GET /api/scores/me` personal best per platform and run count.
- `server/src/scores/` holds the logic, `server/src/routes/scores.ts` the
  HTTP layer, mirroring the `player` folder.
- `api/index.mjs` at the repo root wraps `createApp()` for Vercel, connecting
  to Mongo on first use and caching the client (done in M1).
  `server/src/index.ts` stays for local development and the smoke test.

---

## Milestones

Each milestone is one or more small commits on `main`, verified before the
next starts. Tests and typecheck must be green at every commit.

### M1. Rhythm Runner has its own address

1. Add `api/index.ts`, `vercel.json` (API rewrite, SPA fallback) and a root
   build script. Make Mongo connect lazily in the function path.
2. Create the Vercel project `rhythm-runner` from the GitHub repo. Set
   `MONGODB_URI` (the new scoped user) and `MONGODB_DB_NAME` as environment
   variables. Never in the repo.
3. Atlas: add user `rhythm_runner_app`, allow `0.0.0.0/0` in Network Access.
4. Verify in production: `/api/health` says connected, enter -> reload ->
   leave works in Chrome, preview deploy appears on a test branch.
5. README: replace "hosted version coming" with the real URL. The leaflet can
   point at it from this moment.

Done when: a stranger with the link sees the enter screen and can enter.

**Done 2026-09-21.** Production: <https://rhythm-runner-eight.vercel.app>,
Vercel project `rhythm-runner` on the Circle team (Hobby). Verified: health
reports the database connected; enter -> me -> leave -> 401 via the API with a
Secure, HttpOnly cookie; deep link `/enter` and unknown API route behave; the
protected home page renders in Chrome with "Database: connected". Atlas allows
`0.0.0.0/0`. The database user is still the admin user; the scoped
`rhythm_runner_app` user is an open item.

Milestones M2 to M5 are specified file by file in `docs/PHASE-1-BUILD.md`.

### M2. The engine, with tests

1. `config.ts`, `course.ts`, `pace.ts`, `scoring.ts`, `engine.ts` with vitest
   tests: segment lookup and wrap-around, target interval per terrain and
   weather, each timing window on PC and mobile, wrong foot, too fast, skipped
   steps, pace change at a segment boundary, step energy cost, wind decay,
   stumble and recovery, speed clamp, score accumulation, 60-second end.
2. Client-side vitest is added here (Node environment, no DOM needed).

Done when: `npm test` runs client and server tests and both pass.

**Done 2026-09-21** (commit `f8892b7`, built by a separate implementing session):
42 client tests in four files, 9 server tests, typecheck clean, only the
game folder and the package files changed. Reviewed; three small follow-ups
are listed as M3 step 0 in `PHASE-1-BUILD.md`.

### M3. It is a game

1. `render.ts`: sky and weather, skyline, pavement, a road built from the
   upcoming segments (slopes, water), runner with the due leg forward, two
   footprints with the pace ring, segment banner, HUD with pace meter.
2. `audio.ts`: due click and result tones, unlocked on first input.
3. `platform.ts` and `useGameLoop.ts`: PC vs mobile detection, keys and pads,
   fixed-step loop, input queue.
4. `PlayPage.tsx`: both layouts, countdown, run, results overlay.
5. Tune so a first-time adult finishes with energy left on both platforms and
   notices the first hill.

Done when: a full run plays on desktop Chrome with keys and on a phone with
two thumbs; terrain and weather visibly change the pace.

### M4. Scores that stick

1. Server: `scores` collection, indexes, three routes, shared auth helper,
   validation, tests for 401, 400, 503 and impossible runs.
2. Client: submit on run end, lobby shows personal bests and the PC and Mobile
   leaderboards, results overlay shows rank.
3. `scripts/smoke.mjs` extended: enter -> submit score -> top -> me -> leave.

Done when: two different nicknames appear on the production leaderboard.

### M5. Ship and hand over

1. Mobile polish: safe areas, no page scroll, one-handed reach, upright hint.
2. README: how to play, how to run, the config file for tuning.
3. This document, `GAME-DESIGN.md` and `API.md` updated with what was actually
   built and verified.
4. Memory note for Claude Code sessions updated.

---

## Deferred to Phase 2 (with the students)

- their own runner art, props, backgrounds and a name for the runner;
- new terrains (mud, ice, sand) as rows in the `TERRAIN` table, new weathers,
  and new levels as new segment lists; a level picker;
- obstacles to jump, power-ups, night mode;
- an "expert" mode with the pace guide off, and its own leaderboard;
- a PIN or room code so a nickname cannot be borrowed;
- live head-to-head races (needs an always-on API host);
- sounds beyond the clicks, and music with a licence;
- ESLint, if their code starts to need it.

## Open points for Amit

- Vercel Hobby or the Pro team? Depends on whether the workshop is paid.
- 60 seconds per run is a guess. Shorter for six-year-olds?
- The pace guide (pulsing footprint and click) is always on in Phase 1. Keep it
  that way for the leaflet demo, or make "guide off" the real game later?
- Scoped Atlas user `rhythm_runner_app` still to be created; production runs on
  the admin user.
