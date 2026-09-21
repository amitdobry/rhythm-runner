# Rhythm Runner

A small competitive running game, built with AI, that is the public demo for
Amit's AI coding workshop for children. The game is the advert: if it is fun,
it sells the course by itself. A two-footed runner stays in place while the
road and scenery move; the player steps left, right, left, right at the pace
the terrain and weather ask for, manages speed and energy, and earns a score.

Status: Phase 1 is complete. The game is playable on a PC and on a phone, runs
are scored, and the leaderboards are live. See `docs/README.md` for the plan.

## Coming from the workshop leaflet?

This repository is the live record of a game that children build, step by step,
in the AI coding workshop.

**Try it: <https://rhythm-runner-eight.vercel.app>**

Pick a nickname, play a 60-second run, and see where you land on the board.
More levels, obstacles and artwork come in Phase 2 (see `docs/PHASE-1.md`).

---

## How to play

The runner has two feet, and so do you. Steps alternate: left, right, left,
right. Step with the foot whose footprint is pulsing; the ring around it
shrinks to show when the step is due.

|            | On a PC                                          | On a phone                     |
| ---------- | ------------------------------------------------ | ------------------------------ |
| Left foot  | `<-` or `F`, or click the left half of the game  | the big left pad at the bottom |
| Right foot | `->` or `J`, or click the right half of the game | the big right pad              |

There is no fixed beat. Each step is due one interval after your last one,
and the ground decides how long that interval is: 600 ms on flat road in
clear weather, x1.3 uphill, x0.8 downhill, x1.5 through water, and again
x1.15 in rain or x1.1 in a headwind. The factors multiply, so uphill in the
rain asks for 897 ms between steps. Read the road ahead and change your pace
before you reach it.

A step within 60 ms of when it was due is Perfect; within 120 ms it is Good.
Anything else, and the wrong foot, costs speed and energy. On a phone those
windows are 80 and 160 ms, because a thumb on glass arrives later than a
finger on a key - which is also why PC and phone have separate leaderboards.

Speed drains away on its own, so you must keep stepping. At zero energy the
runner stumbles. Score grows every moment by speed times your combo
multiplier, so a steady runner beats a fast one who keeps missing. A run
lasts 60 seconds.

`docs/GAME-DESIGN.md` has the full rules.

## Tuning the game

Every number that decides how the game feels lives in one file:
`client/src/game/config.ts`. Change one, reload the page, play.

| What              | Where in `config.ts`                                                  |
| ----------------- | --------------------------------------------------------------------- |
| The base pace     | `baseStepIntervalMs` (600 ms = 100 steps/minute)                      |
| Timing windows    | `perfectWindowMs`, `goodWindowMs` in `PC_CONFIG` and `MOBILE_CONFIG`  |
| Ground            | the `TERRAIN` table: pace factor and energy per step                  |
| Weather           | the `WEATHER` table: pace factor, speed drain, energy                 |
| The course        | `LEVEL_1`: a list of segments, each a terrain, a weather and a length |
| Speed and energy  | the `speed` and `energy` blocks of `PC_CONFIG`                        |
| Combo multipliers | `comboMultipliers`                                                    |

Things worth trying: a 500 ms base pace; a new `mud` terrain at x1.4 and 3
energy a step; a level that is all hills; `requireAlternatingFeet: false` as
an easy mode for the youngest players. Adding a terrain is one line in
`TERRAIN` plus a colour in `render.ts`.

The rules themselves are in `client/src/game/engine.ts` and are covered by
tests, so a change that breaks them fails `npm test` rather than the game.

## Running it locally

You need Node.js 20 or newer.

### 1. Get a MongoDB connection string

This project has its own database, `rhythm_runner`, and should use a database
user that can reach only that database.

1. In MongoDB Atlas, open the workshop cluster (a free M0 cluster is enough).
2. **Database Access** -> Add New Database User -> give it a password, and under
   _Database User Privileges_ choose _Specific Privileges_: role `readWrite`,
   database `rhythm_runner`.
3. **Network Access** -> make sure your current IP address is allowed.
4. **Connect** -> **Drivers** -> copy the connection string. It looks like
   `mongodb+srv://USER:PASSWORD@cluster.xxxxx.mongodb.net/`.

### 2. Configure the server

```bash
cp .env.example server/.env
```

Open `server/.env` and paste the connection string into `MONGODB_URI`.
Never commit that file. Never paste a real connection string into chat, code or docs.

### 3. Install and run

```bash
npm run install:all
npm run dev
```

- App: <http://localhost:5173>
- Server health check: <http://localhost:4000/api/health>

The server refuses to start, with a clear message, if `MONGODB_URI` is missing.
If the database is unreachable the server still starts, `/api/health` says so,
and entering as a player answers 503 until it is fixed.

### 4. Check it

```bash
npm test          # server tests (no database needed)
npm run typecheck # both sides
npm run smoke     # starts the real server and walks enter -> run -> board -> leave
                  # (it uses the throwaway database rhythm_runner_smoke, never production)
npm run format    # Prettier
```

---

## Where things live

```text
rhythm-runner/
├── client/                 the part that runs in the browser (React + Vite)
│   └── src/
│       ├── game/           the game itself (see below)
│       ├── pages/          EnterPage (front door), HomePage (play + scores), PlayPage
│       ├── player/         who is playing: PlayerContext, RequirePlayer guard
│       └── services/       api.ts - how the browser talks to the server
├── server/                 the part that runs on a computer you control (Express)
│   ├── src/
│   │   ├── config.ts       reads server/.env and refuses to start without it
│   │   ├── database/       mongo.ts - the one place that talks to MongoDB
│   │   ├── player/         players.ts, sessions.ts, auth.ts (who is asking?)
│   │   ├── scores/         scores.ts - checking, saving and ranking runs
│   │   ├── routes/         health.ts, player.ts, scores.ts - the addresses the browser can call
│   │   ├── errors.ts       404 for unknown API routes, one error handler
│   │   ├── app.ts          builds the Express app
│   │   └── index.ts        starts it
│   └── test/               vitest smoke tests
├── scripts/smoke.mjs       start the real server, prove the flow, stop it
├── api/index.mjs           Vercel entry: the same Express app as one serverless function
├── vercel.json             build, output directory, /api rewrite and SPA fallback
├── docs/PHASE-0.md         decisions, what was reused, what is deferred
├── docs/PHASE-1.md         the plan for the first playable level and hosting
├── docs/GAME-DESIGN.md     the rules of the game in plain words
└── .env.example            variable names and placeholders only
```

The game folder in detail:

```text
client/src/game/
├── config.ts        every tunable number: windows, terrain, weather, level 1
├── engine.ts        the rules: tick() lets time pass, step() is a foot press
├── course.ts        where the runner is on the road
├── pace.ts          how long a step may take, and how a step is judged
├── scoring.ts       combo multiplier and accuracy
├── render.ts        draws one moment of the game on the canvas
├── useGameLoop.ts   the animation frame, the canvas size and the input
├── platform.ts      is this a PC or a phone?
└── audio.ts         the click, made by the browser itself
```

The first five are pure: no browser, no React, no clock. That is why they can
be tested, and why `npm test` catches a broken rule before the game does.

## How it is hosted

Production is the Vercel project `rhythm-runner` (its own project, not shared
with anything else). Every push to `main` deploys. The React build is served
as static files; `api/index.mjs` runs the Express app as a serverless function
and connects to MongoDB Atlas on the first request. `MONGODB_URI` and
`MONGODB_DB_NAME` are environment variables of the Vercel project, never
part of the repository.

## How entering works

There are no passwords. A player types a nickname; the server finds or creates
that player in the `players` collection, stores a session in the `sessions`
collection, and hands the browser a random token in a cookie that JavaScript
cannot read. Every screen inside the app asks "who am I?" through that cookie.
Log out deletes the session.

That is a nickname, not an account. Anyone who knows a nickname can enter as
it. That is fine for a public demo with nothing to protect; a PIN can be added
later if leaderboard cheating becomes a problem.
