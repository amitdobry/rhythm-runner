# API Reference

Every route the browser can call. All responses are JSON. Errors have the shape
`{ "error": "message" }`. Routes marked **session** need the `rr_session`
cookie and answer `401 { "error": "Not signed in." }` without it. Routes that
need the database answer `503` when it is not connected.

Base URL: same origin as the page (`/api/...`). Production:
`https://rhythm-runner-eight.vercel.app/api`.

## Health

### `GET /api/health`

```json
{
  "status": "ok",
  "database": "connected",
  "databaseError": null,
  "time": "2026-09-21T10:23:14.359Z"
}
```

`database` is `connected`, `disconnected` (never tried, or no `MONGODB_URI`) or
`error` (tried and failed; `databaseError` says why).

## Player

### `POST /api/player/enter`

Body: `{ "nickname": "Maya" }`. Nickname rules: 2-20 characters, letters in any
language, digits, spaces, dashes, underscores; runs of spaces collapse to one.

- `200 { "player": { "id": "...", "nickname": "Maya" } }` and sets the cookie
  (7 days, httpOnly, SameSite Lax, Secure in production).
- `400` bad nickname. `503` no database.

Anyone who knows a nickname can enter as it. This is a classroom identity, not
an account. See `PHASE-0.md`.

### `GET /api/player/me` - session

`200 { "player": { "id", "nickname" } }`. `401` if the cookie is missing,
expired or unknown (the cookie is cleared).

### `POST /api/player/leave`

`200 { "ok": true }`. Deletes the session and clears the cookie. Never fails.

## Scores

Shared shapes:

```ts
type Platform = 'pc' | 'mobile';

interface RunSummary {
  score: number; // integer >= 0
  distance: number; // integer metres >= 0
  accuracy: number; // 0..1
  bestCombo: number; // integer >= 0
  runSeconds: number; // 10..300
  platform: Platform; // which input profile was played
  course: string; // 'level-1'
}

interface ScoreRow {
  nickname: string;
  score: number;
  distance: number;
  accuracy: number;
  bestCombo: number;
  platform: Platform;
  course: string;
  createdAt: string; // ISO 8601
}
```

### `POST /api/scores` - session

Body: `RunSummary`. The server checks every field and rejects impossible runs:
distance above `20 x runSeconds`, score above `3 x distance`, `bestCombo`
above the most steps that fit in the run at the fastest pace, unknown
`platform`, missing `course`.

- `201 { "saved": ScoreRow, "rank": 3 }` where `rank` is the player's position
  on the leaderboard of the same platform after this save (1 = best; other
  players with a higher best score, plus one).
- `400` invalid body. `503` no database.

### `GET /api/scores/top?platform=pc&limit=10` - public (no session needed)

`platform` required (`pc` or `mobile`); `limit` default 10, max 50.
`200 { "rows": ScoreRow[] }`, best score per player, highest first. PC and
mobile are separate boards because the timing windows differ.

### `GET /api/scores/me` - session

`200 { "best": { "pc": ScoreRow | null, "mobile": ScoreRow | null }, "runs": 12 }`.

## Anything else under `/api`

`404 { "error": "No such API route: GET /api/whatever" }`.
