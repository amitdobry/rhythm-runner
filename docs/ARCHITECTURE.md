# Architecture

How the pieces of Rhythm Runner fit together, and why they are split this way.

## The three parts

```text
 Browser (React + Vite)          Vercel function (Express 5)        MongoDB Atlas
 ─────────────────────           ───────────────────────────        ─────────────
 pages/  player/  game/   ──/api──▶  routes/  player/  scores/  ──▶  rhythm_runner
 services/api.ts                     database/mongo.ts                players
                                                                      sessions
                                                                      scores (M4)
```

- **Client** - everything the player sees. Talks to the server only through
  `client/src/services/api.ts`. Game logic (`client/src/game/`) is pure
  TypeScript with no DOM, so it can be unit-tested in Node and tuned without
  touching anything that deals with the browser.
- **Server** - the rules the browser must not be trusted with: who is playing,
  which scores are real, what the leaderboard says. One Express app, built by
  `createApp()` in `server/src/app.ts`, used in three ways: local dev
  (`index.ts` listens on a port), tests (listen on port 0, no database) and
  production (`api/index.mjs` exports it as a Vercel function).
- **Database** - MongoDB Atlas, database `rhythm_runner`, on the free cluster.
  `server/src/database/mongo.ts` is the only file that opens a connection and
  the only place collections and indexes are declared.

## One request, end to end

Player presses "Enter" with nickname "Maya":

1. `EnterPage` calls `enterAsPlayer('Maya')` in `services/api.ts`.
2. `fetch('/api/player/enter')`. In dev, Vite proxies `/api` to `:4000`. In
   production, `vercel.json` rewrites `/api/*` to the function.
3. `api/index.mjs` (production only) makes sure MongoDB is connected, then
   hands the request to the Express app.
4. `routes/player.ts` normalises the nickname, `players.ts` finds or creates
   the player, `sessions.ts` stores a random token with a 7-day expiry, and the
   response sets the `rr_session` cookie (httpOnly, SameSite Lax, Secure in
   production).
5. `PlayerContext` stores the player; `RequirePlayer` now lets `/` render.
6. Every later request carries the cookie; `GET /api/player/me` answers who it is.

## Why same-origin matters

Client and API share one origin in both dev (Vite proxy) and production (one
Vercel project). That is what lets a plain httpOnly cookie be the whole
session mechanism: no CORS, no tokens in JavaScript, nothing to leak. Splitting
the client and API onto different hosts would break this; see the decision
notes in `PHASE-1.md`.

## The game loop (M3)

```text
requestAnimationFrame ──▶ useGameLoop
                            │  accumulate elapsed ms (cap 250)
                            │  drain queued foot presses: state = step(state, foot)
                            │  while (>= 10) state = tick(state, 10)
                            │  when timeMs passes nextDueMs: metronome.click('due')
                            └─▶ render(ctx, state)
```

`tick` and `step` are pure functions in `engine.ts`; `course.ts` says which
terrain and weather the runner is on, `pace.ts` turns that into the interval
the next step must match. The hook is the only place that knows about time,
keyboard, pointer, pads and canvas. This is deliberate: a child can change how
the game _behaves_ in `config.ts` (a new terrain is one table row, a new level
one list) without touching anything that deals with the browser.

## Production shape

```text
GET  /                 ──▶ client/dist/index.html (static, CDN)
GET  /assets/*         ──▶ client/dist/assets/*   (static, CDN)
GET  /enter, /play     ──▶ index.html (SPA fallback rewrite)
*    /api/*            ──▶ api/index.mjs (serverless function) ──▶ Express
```

The function is stateless between cold starts. The MongoDB client is cached in
module scope, so warm invocations reuse it. There is no WebSocket and no
background job; anything that needs a live connection belongs to a later phase
on a different host.

## Folder map

```text
rhythm-runner/
├── api/index.mjs            Vercel entry (production only)
├── vercel.json              build, output dir, rewrites
├── client/src/
│   ├── game/                pure engine + render/audio adapters (M2, M3)
│   ├── pages/               EnterPage, HomePage, PlayPage
│   ├── player/              PlayerContext, RequirePlayer
│   └── services/api.ts      the only place that calls fetch
├── server/src/
│   ├── app.ts               createApp(): routes + error handling
│   ├── index.ts             local dev entry: connect, listen
│   ├── config.ts            env loading, fails loudly
│   ├── database/mongo.ts    connection, COLLECTIONS, indexes
│   ├── player/              players.ts, sessions.ts, auth.ts (M4)
│   ├── scores/              scores.ts (M4)
│   ├── routes/              health.ts, player.ts, scores.ts (M4)
│   └── errors.ts            HttpError, notFound, errorHandler
├── server/test/             vitest, no database needed
├── scripts/smoke.mjs        real server, real flow
└── docs/                    you are here
```
