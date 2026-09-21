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

Body: `{ "nickname": "Maya", "pin": "4821" }`. Nickname rules: 2-20 characters,
letters in any language, digits, spaces, dashes, underscores; runs of spaces
collapse to one. The PIN is exactly four digits. One route does both jobs: it
claims a free name and opens a claimed one, and the answer says which happened.

| Case                              | Answer                                               |
| --------------------------------- | ---------------------------------------------------- |
| bad nickname, or PIN not 4 digits | `400 { error, code: "bad_input" }`                   |
| name unknown                      | `200 { player, claimed: true }` and sets the cookie  |
| name known, PIN right             | `200 { player, claimed: false }` and sets the cookie |
| name known, PIN wrong             | `401 { error, code: "wrong_pin", attemptsLeft }`     |
| name known, locked                | `423 { error, code: "locked", retryAfterSeconds }`   |
| no database                       | `503`                                                |

The cookie lasts a year (httpOnly, SameSite Lax, Secure in production). Five
wrong tries rest the name for fifteen minutes; the count then starts again.
The PIN is hashed with scrypt and a per-player salt, and is never logged,
stored in the clear, or sent back.

The PIN is not security. It is what stops one child in a classroom saving a
score under another child's name. See `PHASE-0.md`.

### `POST /api/player/reset-pin` - admin key

Body: `{ "nickname": "Maya" }`, header `x-admin-key`. Clears the PIN and the
lock, so the next `enter` for that name claims it again with whatever PIN it
brings. `200 { "ok": true }`. `404` when the key is missing, wrong, or
`ADMIN_KEY` is not set - the same hiding as the events summary.

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

- `201 { "saved": ScoreRow, "rankWeek": 2, "rankAll": 7, "personalBest": true, "previousBest": 1480 }`.
  Both ranks are the player's position after this save (1 = best; other players
  with a higher best score, plus one) - one on this week's board, one on the
  all-time board. One board per range: phone and keyboard are ranked together.
  `personalBest` is true when the run beat the player's best before this save;
  `previousBest` is that old best, or `null` on the very first save.
- `400` invalid body. `503` no database.

### `GET /api/scores/top?range=week&limit=10` - public (no session needed)

One board for everyone. `range` is `week` (default) or `all`; anything else is
`400`. `limit` default 10, max 50. A `platform` query from an older page is
ignored, never an error.

```json
{
  "range": "week",
  "weekStart": "2026-09-20",
  "weekEnd": "2026-09-27",
  "rows": [],
  "me": { "rank": 14, "row": {} }
}
```

`rows` is the best score per player, highest first, across both kinds of
device. `weekStart` is the Sunday that starts the current week **in Israel**
and `weekEnd` the next one; both are sent whatever the range. `me` is filled
only when the request carries a valid session cookie **and** that player has a
score in this range; `rank` is their position in it, 1 = best. Otherwise
`me` is `null`. `ScoreRow.platform` says what a run was played on; nothing
ranks by it.

### `GET /api/scores/me` - session

`200 { "best": { "week": ScoreRow | null, "all": ScoreRow | null }, "runs": 12 }`

- the player's best run this week and ever, and how many they have finished.

## Events

Anonymous funnel analytics. No cookies, no personal data, never the nickname.

### `POST /api/events` - public

Body: `{ sid, name, platform, ref, data? }`. `sid` is a random per-browser
id (8-40 chars, `[a-z0-9]`); `name` one of the whitelisted event names;
`platform` `pc`, `mobile` or `unknown`; `ref` `''` or the leaflet marker
(`LEAF5`, or `B3` for the older `?b=3` prints), exactly as the landing page
defines it; `data` an optional small
object of numbers, booleans or short strings (at most 8 keys, 512 bytes).

- `204` when valid, even if the database is down (analytics never fails the client).
- `400` when invalid.

### `GET /api/events/summary?days=7` - admin key

Header `x-admin-key` must equal the `ADMIN_KEY` environment variable.

- `200 { days, byName: { [name]: { events, sessions } }, byRef: { [ref]: { opened, played, completed, workshopClicked } } }`
- `404` when the key is missing, wrong, or `ADMIN_KEY` is not set. `503` without a database.

## Anything else under `/api`

`404 { "error": "No such API route: GET /api/whatever" }`.
