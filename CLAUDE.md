# Rhythm Runner - instructions for Claude Code

A small competitive running game for a children's AI coding workshop.
React + Vite client, Express 5 + MongoDB server, hosted on Vercel.
Production: <https://rhythm-runner-eight.vercel.app> (deploys on every push to `main`).

## Read first

- `docs/PHASE-1.md` - what Phase 1 delivers and why (the plan).
- `docs/PHASE-1-BUILD.md` - the step-by-step build spec: files, signatures,
  rules, tests, definition of done per milestone. **Follow it in order.**
- `docs/PHASE-0.md` - what already exists and the decisions behind it.

## Commands

```bash
npm run install:all   # install root, client and server
npm run dev           # client on :5173, server on :4000 (needs server/.env)
npm test              # all tests (no database needed)
npm run typecheck     # both sides, strict TypeScript
npm run format        # Prettier; run before every commit
npm run smoke         # starts the real server and walks the API flow
```

`server/.env` holds `MONGODB_URI`. It is gitignored. If it is missing, ask the
user; never create it with a made-up value and never print its contents.

## Hard rules

- **Never** commit `.env` files, connection strings, passwords or tokens.
- **Never** touch `C:\Users\Admin\Live` or any database other than `rhythm_runner`.
- **Never** change `api/index.mjs` or `vercel.json` unless the milestone says so.
- Keep `npm test` and `npm run typecheck` green at every commit.
- Work one milestone at a time. Finish it, verify the "Done when", commit, then
  stop and report. Do not start the next milestone in the same turn.
- No new dependencies beyond those the build spec names. No game frameworks.
- Do not rewrite existing files wholesale; make the smallest change that works.

## Conventions

- TypeScript `strict`. Prettier formats everything (`.prettierrc`).
- Server source imports use the `.js` suffix (`'../database/mongo.js'`); the
  client does not.
- Express 5: `async` route handlers may `throw new HttpError(status, message)`;
  the error handler in `server/src/errors.ts` turns it into JSON.
- Every collection the app uses is listed in `COLLECTIONS` in
  `server/src/database/mongo.ts`, with its indexes in `ensureIndexes`.
- Game logic in `client/src/game/` is pure: no DOM, no React, no `Date.now()`.
  Only `render.ts` and `audio.ts` may touch browser APIs.
- Comments explain _why_ for a child or a beginner; short and plain English.
- Commit messages: one line, imperative, what changed and where. Body optional.
  End every commit with the Co-Authored-By line the session provides.

## Verifying

- Unit tests: `npm test`.
- Browser: `npm run dev`, then <http://localhost:5173>. Enter a nickname, play.
- Production: after `git push`, wait for Vercel, then check
  `https://rhythm-runner-eight.vercel.app/api/health` says `"database":"connected"`.
