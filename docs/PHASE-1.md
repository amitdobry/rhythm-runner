# Phase 1 - First Playable Level, Hosted

Date: 2026-09-21. Status: M1 done, M2 next.

Phase 1 turns the Phase 0 foundation into a game a leaflet visitor can open in
a browser and play for one minute: a runner on a scrolling road, taps to the
beat, speed and energy, a score saved per player, and a small leaderboard.
It also gives the project its own home on Vercel, separate from every other
project on the account.

Phase 1 is built by Amit and Claude Code only. The students meet the game in
Phase 2 and change it from there, so everything tunable lives in one config
file and every game rule is a plain, named function.

---

## Decisions

| Question             | Decision                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Host                 | Vercel, **a new Vercel project named `rhythm-runner`**, imported from `github.com/amitdobry/rhythm-runner`. Not the LIVE project. |
| Server shape in prod | The same Express app, exported as one Vercel serverless function under `/api`. Local dev keeps `app.listen`.                      |
| Database             | Atlas Cluster0, database `rhythm_runner`, as in Phase 0. No new cluster.                                                          |
| Database user        | New user `rhythm_runner_app`, `readWrite` on `rhythm_runner` only. The admin user stays for the console.                          |
| Music                | A generated metronome click (Web Audio), no recorded track, so nothing copyrighted ships.                                         |
| Rendering            | HTML canvas 2D, no game framework. Enough for a road, a runner and parallax; easy to read for children.                           |
| Multiplayer          | Not in Phase 1. Leaderboard only. Live races would need WebSockets, which Vercel functions do not offer.                          |

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

**Scene.** The runner stays at the left third of a 16:9 canvas. Three layers
scroll left at different speeds: sky and skyline (slow), pavement and props
(medium), road with lane stripes (fast, tied to the runner's speed).

**Beat.** A metronome runs at a fixed BPM (start at 100). Each beat pulses a
ring around the runner and plays a click. The ring is the visual beat, so the
game is playable with sound off.

**Input.** Space, Enter or any tap/click on the canvas is "step". One input,
so a six-year-old and a phone user play the same game.

**Timing windows** (milliseconds from the nearest beat):

| Result  | Window      | Speed        | Energy | Combo   |
| ------- | ----------- | ------------ | ------ | ------- |
| Perfect | within 60   | +2.0         | +3     | +1      |
| Good    | within 120  | +1.0         | 0      | +1      |
| Miss    | otherwise   | -3.0         | -10    | reset 0 |
| No step | beat passed | speed decays | 0      | reset 0 |

**Speed.** Clamped between 0 and a max; decays a little every second so the
player must keep stepping. Road and props scroll at the current speed.

**Energy.** Starts at 100. At 0 the runner stumbles: speed drops to a crawl and
input is ignored for one beat, then energy resets to 30.

**Run.** One level is 60 seconds. Score = distance travelled x combo
multiplier, where the multiplier grows in steps (x1 at 0-9 combo, x2 at
10-19, x3 at 20+). The results screen shows distance, best combo, accuracy
and score, and offers "Run again" and "Leaderboard".

All numbers above live in `client/src/game/config.ts` and are the first thing
the students will change in Phase 2.

### Architecture on the client

```text
client/src/
├── game/
│   ├── config.ts        every tunable number, with a comment each
│   ├── engine.ts        pure state machine: tick(state, dt), step(state, now)
│   ├── beat.ts          BPM -> beat times, nearest-beat distance
│   ├── scoring.ts       windows, combo multiplier, final score
│   ├── audio.ts         Web Audio click, unlocked on first input
│   └── render.ts        draws a GameState onto a canvas (no logic)
├── pages/
│   ├── HomePage.tsx     lobby: Play, personal best, top 10
│   ├── PlayPage.tsx     canvas, HUD, results overlay
│   └── EnterPage.tsx    unchanged
└── services/api.ts      + submitScore, fetchTopScores, fetchMyBest
```

`engine.ts`, `beat.ts` and `scoring.ts` import nothing from the DOM and are
tested with vitest in Node. `render.ts` and `audio.ts` are the only files that
touch browser APIs. The loop uses `requestAnimationFrame` with a fixed
simulation step so speed does not depend on frame rate.

### Architecture on the server

- New collection `scores`, added to `COLLECTIONS` in `mongo.ts`:
  `{ playerId, nickname, score, distance, accuracy, bestCombo, bpm, createdAt }`
  with an index on `{ score: -1 }` and on `{ playerId: 1, score: -1 }`.
- Routes, all behind the session cookie:
  - `POST /api/scores` saves a run. The server checks ranges and rejects a
    score above the theoretical maximum for a 60-second run at that BPM.
  - `GET /api/scores/top?limit=10` leaderboard, one best row per player.
  - `GET /api/scores/me` personal best and run count.
- `server/src/scores/` holds the logic, `server/src/routes/scores.ts` the
  HTTP layer, mirroring the `player` folder.
- `api/index.ts` at the repo root wraps `createApp()` for Vercel, connecting
  to Mongo on first use and caching the client. `server/src/index.ts` stays
  for local development and the smoke test.

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

### M2. The engine, with tests

1. `config.ts`, `beat.ts`, `scoring.ts`, `engine.ts` with vitest tests:
   nearest-beat maths, each timing window, combo reset, energy floor and
   stumble, speed clamp and decay, final score, 60-second end.
2. Client-side vitest is added here (Node environment, no DOM needed).

Done when: `npm test` runs client and server tests and both pass.

### M3. It is a game

1. `render.ts`: sky, skyline, pavement, road, runner (simple shapes and a
   two-frame leg animation), beat ring, HUD (speed, energy, combo, time).
2. `audio.ts`: metronome click, unlocked on first tap.
3. `PlayPage.tsx`: canvas sized to the viewport, keyboard and touch input,
   countdown, run, results overlay with "Run again".
4. Tune the numbers so a first-time adult can finish a run with energy left.

Done when: a full 60-second run plays on desktop Chrome and on a phone.

### M4. Scores that stick

1. Server: `scores` collection, indexes, three routes, validation, tests for
   401, 400, impossible score, leaderboard shape.
2. Client: submit on run end, lobby shows personal best and top 10, results
   overlay shows rank.
3. `scripts/smoke.mjs` extended: enter -> submit score -> top -> me -> leave.

Done when: two different nicknames appear on the production leaderboard.

### M5. Ship and hand over

1. Mobile pass: safe areas, landscape hint, no page scroll while playing.
2. README: how to play, how to run, the config file for tuning.
3. This document updated with what was actually built and verified.
4. Memory note for Claude Code sessions updated with the production URL.

---

## Deferred to Phase 2 (with the students)

- their own runner art, props, backgrounds and a name for the runner;
- new levels: BPM changes, obstacles, power-ups, night mode;
- a PIN or room code so a nickname cannot be borrowed;
- live head-to-head races (needs an always-on API host);
- sounds beyond the click, and music with a licence;
- ESLint, if their code starts to need it.

## Open points for Amit

- Vercel Hobby or the Pro team? Depends on whether the workshop is paid.
- Portrait or landscape on phones? Plan assumes landscape with a hint.
- 60 seconds per run is a guess. Shorter for six-year-olds?
