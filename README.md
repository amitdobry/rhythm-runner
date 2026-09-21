# Rhythm Runner

A small competitive running game that the students will design and build in the
AI coding workshop. A runner stays in place while the road and scenery move; the
player presses at the right rhythm, manages speed and energy, and earns a score.

**Right now there is no game.** This is Phase 0: a clean, verified foundation.
What exists is a server, a database connection, a front door (pick a nickname),
and one deliberately empty protected screen. See `docs/PHASE-0.md` for what was
decided and why.

## Coming from the workshop leaflet?

This repository is the live record of a game that children build, step by step,
in the AI coding workshop.

**Try it: <https://rhythm-runner-eight.vercel.app>**

Today it holds the foundation only: pick a nickname and you are in. The first
playable level is being built now (see `docs/PHASE-1.md`).

---

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
npm run smoke     # starts the real server and walks the enter / me / leave flow
npm run format    # Prettier
```

---

## Where things live

```text
rhythm-runner/
├── client/                 the part that runs in the browser (React + Vite)
│   └── src/
│       ├── pages/          EnterPage (the front door), HomePage (protected, empty)
│       ├── player/         who is playing: PlayerContext, RequirePlayer guard
│       └── services/       api.ts - how the browser talks to the server
├── server/                 the part that runs on a computer you control (Express)
│   ├── src/
│   │   ├── config.ts       reads server/.env and refuses to start without it
│   │   ├── database/       mongo.ts - the one place that talks to MongoDB
│   │   ├── player/         players.ts and sessions.ts
│   │   ├── routes/         health.ts, player.ts - the addresses the browser can call
│   │   ├── errors.ts       404 for unknown API routes, one error handler
│   │   ├── app.ts          builds the Express app
│   │   └── index.ts        starts it
│   └── test/               vitest smoke tests
├── scripts/smoke.mjs       start the real server, prove the flow, stop it
├── api/index.mjs           Vercel entry: the same Express app as one serverless function
├── vercel.json             build, output directory, /api rewrite and SPA fallback
├── docs/PHASE-0.md         decisions, what was reused, what is deferred
├── docs/PHASE-1.md         the plan for the first playable level and hosting
└── .env.example            variable names and placeholders only
```

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

That is a workshop identity, not an account. Anyone who knows a nickname can
enter as it. That is fine for a classroom and is on the list to revisit with the
students when scores and leaderboards arrive.
