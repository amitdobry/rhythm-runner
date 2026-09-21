# Deploy Runbook

Where Rhythm Runner runs, how a change gets there, and what to do when it breaks.

## Where

| Piece    | Where                                                                                              | Owner |
| -------- | -------------------------------------------------------------------------------------------------- | ----- |
| Code     | github.com/amitdobry/rhythm-runner, branch `main`                                                  | Amit  |
| Hosting  | Vercel project `rhythm-runner`, team "Circle's projects", Hobby plan                               | Amit  |
| URL      | <https://rhythm-runner-eight.vercel.app>                                                           |       |
| Database | MongoDB Atlas, org "Amit's Org", Project 0, Cluster0 (M0, AWS Frankfurt), database `rhythm_runner` | Amit  |

Rhythm Runner has its own Vercel project. It shares nothing with the LIVE
project or any other deployment.

## How a deploy happens

1. Push to `main`. Vercel builds automatically.
2. Build = `npm run install:all` then `npm run build` (server `tsc` to
   `server/dist`, then client `vite build` to `client/dist`). Settings come
   from `vercel.json`; the dashboard preset is ignored.
3. `client/dist` is served as static files; `api/index.mjs` becomes one
   serverless function that all `/api/*` requests are rewritten to.
4. A push to any other branch creates a preview deployment with its own URL.
   Previews use the same environment variables and therefore the same database.

Typical build time: about one minute.

## Environment variables (Vercel project settings)

| Name              | Value                                                       | Notes                                 |
| ----------------- | ----------------------------------------------------------- | ------------------------------------- |
| `MONGODB_URI`     | `mongodb+srv://USER:PASSWORD@cluster0.e75trf3.mongodb.net/` | Secret. Password URL-encoded.         |
| `MONGODB_DB_NAME` | `rhythm_runner`                                             |                                       |
| `PORT`            | any                                                         | Ignored on Vercel; used locally only. |

Changing a variable does **not** change the running deployment. Redeploy
afterwards: Deployments -> latest -> "..." -> Redeploy.

Never put these values in the repository, in a chat, or in a screenshot.

## Atlas settings that production depends on

- **Network Access**: `0.0.0.0/0` allowed. Vercel functions have no fixed IP.
- **Database Access**: currently the admin user `amitdobry2_db_user`
  (atlasAdmin). Open item: create `rhythm_runner_app` with `readWrite` on
  `rhythm_runner` only, put its string in `MONGODB_URI`, redeploy.

## Verify a deploy

```bash
curl -s https://rhythm-runner-eight.vercel.app/api/health
# expect "database":"connected"

curl -s -o /dev/null -w "%{http_code}\n" https://rhythm-runner-eight.vercel.app/enter
# expect 200 (SPA fallback)
```

Then in a browser: enter a nickname, reload (still in), log out (back at
`/enter`). From M3 on: play one run. From M4 on: see it on the leaderboard.

## When it breaks

| Symptom                                          | Likely cause                                       | Fix                                                         |
| ------------------------------------------------ | -------------------------------------------------- | ----------------------------------------------------------- |
| health says `disconnected`, `databaseError` null | `MONGODB_URI` empty or missing                     | Set it in Vercel, redeploy                                  |
| health says `error` with a timeout message       | Atlas Network Access blocks Vercel                 | Allow `0.0.0.0/0` in Atlas                                  |
| health says `error` with "bad auth"              | wrong user or password, or unencoded special chars | Fix the string in Vercel, redeploy                          |
| `/api/...` returns Vercel's own 404 page         | `vercel.json` rewrite broken                       | Restore the `/api/(.*)` rewrite                             |
| deep link like `/play` returns 404               | SPA fallback rewrite missing                       | Restore the `/(.*)` -> `/index.html` rewrite                |
| build fails on Vercel, passes locally            | lockfile drift or Node version                     | `npm run install:all` locally, commit lockfiles; Node >= 20 |
| entering works locally, 503 in production        | connection cached in a failed state                | Redeploy; the function retries on the next request anyway   |

Rollback: Vercel dashboard -> Deployments -> pick the last good one ->
"Promote to Production" (or "Instant Rollback" on the overview page).

## Local development

```bash
cp .env.example server/.env   # then paste MONGODB_URI
npm run install:all
npm run dev                   # http://localhost:5173
```

The same Atlas database is used locally and in production, so anything you do
in the app locally shows on the public leaderboard. The smoke script uses the
throwaway database `rhythm_runner_smoke` on the same cluster instead; drop it
in Atlas whenever you like.

## Limits worth knowing (Vercel Hobby)

100 GB bandwidth per month, 1 million function invocations, 10 s per
invocation, no WebSockets, non-commercial use. All far above what a workshop
needs, except the last one: if the workshop becomes a paid business, move the
project to a Pro team. Same code.
