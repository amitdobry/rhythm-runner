# Phase 0 - Prepare the Ground

Date: 2026-09-20

Phase 0 delivers a clean, isolated, locally runnable starting point with basic
player identity and database readiness, and no game. This file records what was
decided, what was reused, and what is deliberately left for the students.

## Names

| What                | Name                   |
| ------------------- | ---------------------- |
| Product             | Rhythm Runner          |
| Folder / repository | `rhythm-runner`        |
| Root package        | `rhythm-runner`        |
| Frontend package    | `rhythm-runner-client` |
| Backend package     | `rhythm-runner-server` |
| MongoDB database    | `rhythm_runner`        |
| Collections         | `players`, `sessions`  |
| Session cookie      | `rr_session`           |

The technical foundation is generic: nothing in it knows about running, rhythm,
roads or energy. The students could turn it into a different small competitive
game without touching the server.

## Where it came from

The foundation was built new (option B) and copies only generic infrastructure
from the dice/board-game workshop project, **Workshop Game 0.1 "The Skeleton"**
at `C:\Users\Admin\AI Workshop\App 2 - day 2-5\workshop-game`
(github.com/amitdobry/workshop-game). That project was not modified.

Reused, with names changed:

- root / `client` / `server` layout and the root scripts (`install:all`, `dev`
  via `concurrently`, `build`, `test`, `typecheck`);
- `server/src/config.ts`: environment loading that refuses to start without
  `MONGODB_URI` and says how to fix it;
- `server/src/database/mongo.ts`: connect, ping, record connected/error state,
  a single list of the collections the app uses;
- the health route;
- Vite dev-server proxy of `/api` to Express, both `tsconfig.json` files;
- the plain CSS variables and panel look;
- the README conventions: Atlas steps, "never commit `.env`", folder map.

Not reused, because it is dice-game logic or a feature for later:

- the board, dice, pawns, turns, game engine and its tests, `GameContext`;
- the Engine Room x-ray page and both function registries;
- the GitHub Pages deploy workflow and the `/workshop-game/` Vite base path;
- `cors`: the Vite proxy makes the API same-origin, so it is not needed.

Changed on purpose:

- Express 5 instead of 4, only because it forwards errors from `async` route
  handlers to the error handler by itself, so no wrapper helper is needed.
- `createApp()` is separate from `index.ts` so tests can start the HTTP layer
  without a database.
- Prettier and `.editorconfig` were added (the source project had no formatter
  or linter). No ESLint: TypeScript `strict` catches most of what matters here.

## Login decision

The dice project has no login at all. The memory-game workshop project uses
hard-coded "pick your name" identities with no passwords.

A username/password system would add password hashing, storage, resets and
forgotten passwords, and would collect data from children, for no Phase 0
value. So Phase 0 uses a **workshop player identity**:

- a player types a nickname (2-20 letters in any language, digits, spaces,
  dashes or underscores); no email, no real name, no password;
- the server finds or creates the player, creates a session, and sets a random
  token in an `httpOnly`, `SameSite=Lax` cookie for 7 days;
- MongoDB removes expired sessions itself (TTL index on `expiresAt`);
- `/` is protected by `RequirePlayer`; without a session the browser is sent to
  `/enter`; log out deletes the session and clears the cookie.

Known limitation, stated openly: anyone who knows a nickname can enter as that
player. Acceptable for a classroom foundation. Revisit with the students before
scores or leaderboards make identity matter (options: a per-player PIN, or a
shared room code set in the server environment, as the memory game does).

## Database isolation

- Own database `rhythm_runner`; nothing else reads or writes it.
- It may live on the existing workshop Atlas cluster (zero cost). It is not the
  LIVE application's database and must never be pointed at it.
- Recommended: a dedicated Atlas database user with `readWrite` on
  `rhythm_runner` only. Creating that user needs the Atlas account, so it is a
  manual step (see README).
- `.env.example` holds names and placeholders only. `server/.env` is ignored by
  Git and was never committed.

## Verification performed on 2026-09-20

- `npm run install:all`, `npm run typecheck`, `npm --prefix client run build`: clean.
- `npm test`: 9 server tests pass (config failure message, nickname rules,
  health, 401/400/503/404 paths) with no database.
- Server started without `MONGODB_URI`: exits 1 with the clear message.
- `npm run smoke` with an unreachable database: server up, health reports
  `error`, entering answers 503.
- `npm run smoke` against the workshop cluster, database `rhythm_runner`:
  enter -> me -> leave -> 401, all pass. Credentials were passed to that one
  process at run time and written nowhere in this project.
- Browser flow at http://localhost:5173 (Chrome): visiting `/` with no session
  lands on `/enter`; entering a nickname shows the protected home screen with
  the placeholder text and "Server: ok · Database: connected"; a full reload
  keeps the session; Log out returns to `/enter`; visiting `/` again is
  redirected to `/enter`.
- Test players left in `rhythm_runner.players` by this verification: "Smoke Test",
  "Proxy Check", "amit", "Phase Zero". Safe to delete at any time.

Known moderate `npm audit` advisories, both only fixable by a major upgrade and
left alone for now: `react-router` 6.x (client) and `@vitest/mocker` (server,
dev only).

## Deferred to Phase 1 and later (with the students)

- the runner, road, pavement, background, rhythm input, speed, energy;
- scoring, races, levels, leaderboards, multiplayer;
- any gameplay collections (scores, races, ...);
- stronger identity (PIN or room code), roles, admin;
- client-side tests (vitest + a DOM environment) when there is game logic to test;
- ESLint, if the students' code starts to need it;
- a GitHub remote, CI and deployment (remote added 2026-09-21; hosting is planned in `docs/PHASE-1.md`).
