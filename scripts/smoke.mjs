// Smoke check: start the real server, prove the foundation works, stop it.
//
//   npm run smoke
//
// Needs server/.env (or MONGODB_URI in the environment). With a reachable database
// it walks the whole flow: enter -> me -> save two runs -> leaderboard -> my best
// -> leave -> me is 401.
//
// With no connection string at all it points the server at an unreachable
// address instead, so the "server up, database error, entering answers 503"
// branch is really exercised rather than the server refusing to boot.
//
// It NEVER writes to the production database: it uses the throwaway database
// rhythm_runner_smoke on the same cluster. Drop that database whenever you like.
// Never prints the connection string.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PORT = Number(process.env.SMOKE_PORT ?? 4100);
const BASE = `http://127.0.0.1:${PORT}`;
const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server');

// A throwaway name and code, in a throwaway database.
const NICKNAME = 'Smoke Test';
const PIN = '4821';
const WRONG_PIN = '1111';

// A throwaway database, never the one the public leaderboard reads.
const SMOKE_DB = process.env.SMOKE_DB_NAME ?? 'rhythm_runner_smoke';

// dotenv does not overwrite variables that are already set, so the fallback
// below is only added when there is genuinely no connection string anywhere.
const hasUri = Boolean(process.env.MONGODB_URI) || fs.existsSync(path.join(serverDir, '.env'));
const UNREACHABLE_URI = 'mongodb://127.0.0.1:1/';

console.log(
  `      database: ${SMOKE_DB}${hasUri ? '' : ' (no connection string; using an unreachable address)'}`
);

const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
  cwd: serverDir,
  env: {
    ...process.env,
    PORT: String(PORT),
    MONGODB_DB_NAME: SMOKE_DB,
    ...(hasUri ? {} : { MONGODB_URI: UNREACHABLE_URI }),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
child.stdout.on('data', (d) => (log += d));
child.stderr.on('data', (d) => (log += d));

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures.push(name);
};

async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) return null;
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return res.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

try {
  const health = await waitForHealth();
  if (!health) {
    console.log(log.trim());
    check('server starts', false, 'no answer from /api/health');
  } else {
    check('server starts and /api/health answers ok', health.status === 'ok');
    console.log(
      `      database: ${health.database}${health.databaseError ? ` - ${health.databaseError}` : ''}`
    );

    const me0 = await fetch(`${BASE}/api/player/me`);
    check('GET /api/player/me without a session is 401', me0.status === 401, `got ${me0.status}`);

    const enter = await fetch(`${BASE}/api/player/enter`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nickname: NICKNAME, pin: PIN }),
    });

    if (health.database !== 'connected') {
      check(
        'enter without a database fails clearly with 503',
        enter.status === 503,
        `got ${enter.status}`
      );
    } else {
      const cookie = enter.headers.get('set-cookie')?.split(';')[0] ?? '';
      check(
        'POST /api/player/enter claims the name and creates a session',
        enter.status === 200 && cookie.startsWith('rr_session='),
        `got ${enter.status}`
      );

      const me1 = await fetch(`${BASE}/api/player/me`, { headers: { cookie } });
      const body = me1.ok ? await me1.json() : {};
      check(
        'GET /api/player/me with the cookie returns the player',
        me1.status === 200 && body.player?.nickname === NICKNAME,
        `got ${me1.status}`
      );

      // The name is claimed now, so it must refuse the wrong code and accept
      // the right one.
      const enterAgain = (pin) =>
        fetch(`${BASE}/api/player/enter`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ nickname: NICKNAME, pin }),
        });

      const wrong = await enterAgain(WRONG_PIN);
      const wrongBody = wrong.status === 401 ? await wrong.json() : {};
      check(
        'a claimed name refuses the wrong code',
        wrong.status === 401 && wrongBody.code === 'wrong_pin',
        `got ${wrong.status}`
      );

      const right = await enterAgain(PIN);
      const rightBody = right.status === 200 ? await right.json() : {};
      check(
        'the right code opens the name without claiming it again',
        right.status === 200 && rightBody.claimed === false,
        `got ${right.status}`
      );

      // Two finished runs. The second is worse than the first: the rank must
      // still be 1, because rank is where the PLAYER stands on the board and
      // Smoke Test is the only player in the throwaway database.
      const postRun = async (run) => {
        const res = await fetch(`${BASE}/api/scores`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify(run),
        });
        return { status: res.status, body: res.status === 201 ? await res.json() : {} };
      };

      const good = await postRun({
        score: 500,
        distance: 300,
        accuracy: 0.8,
        bestCombo: 24,
        runSeconds: 60,
        platform: 'pc',
        course: 'level-1',
      });
      check(
        'POST /api/scores saves the run and answers with both ranks',
        good.status === 201 &&
          typeof good.body.rankWeek === 'number' &&
          typeof good.body.rankAll === 'number',
        `got ${good.status}`
      );
      check(
        'the only player on the board is ranked 1 this week and ever',
        good.body.rankWeek === 1 && good.body.rankAll === 1,
        `week ${good.body.rankWeek}, all ${good.body.rankAll}`
      );
      check('the first run of a name is a personal best', good.body.personalBest === true);

      const worse = await postRun({
        score: 100,
        distance: 100,
        accuracy: 0.4,
        bestCombo: 5,
        runSeconds: 60,
        platform: 'pc',
        course: 'level-1',
      });
      check(
        'a run below your own best does not push you down the board',
        worse.status === 201 && worse.body.rankWeek === 1 && worse.body.rankAll === 1,
        `week ${worse.body.rankWeek}, all ${worse.body.rankAll}`
      );
      check('a worse run is not a personal best', worse.body.personalBest === false);

      const top = await fetch(`${BASE}/api/scores/top?range=week&limit=50`, {
        headers: { cookie },
      });
      const topBody = top.ok ? await top.json() : { rows: [] };
      check(
        "GET /api/scores/top?range=week lists the nickname and this week's dates",
        top.status === 200 &&
          topBody.rows.some((row) => row.nickname === NICKNAME) &&
          Boolean(topBody.weekStart) &&
          Boolean(topBody.weekEnd),
        `got ${top.status}`
      );
      check(
        'the weekly board knows where I stand',
        topBody.me?.rank === 1,
        `rank ${topBody.me?.rank}`
      );

      const mine = await fetch(`${BASE}/api/scores/me`, { headers: { cookie } });
      const mineBody = mine.ok ? await mine.json() : {};
      check(
        'GET /api/scores/me shows my best run this week and ever, not my last one',
        mine.status === 200 &&
          mineBody.best?.all?.score === 500 &&
          mineBody.best?.week?.score === 500 &&
          mineBody.runs >= 2,
        `got ${mine.status}`
      );

      const leave = await fetch(`${BASE}/api/player/leave`, {
        method: 'POST',
        headers: { cookie },
      });
      check('POST /api/player/leave answers ok', leave.status === 200, `got ${leave.status}`);

      const me2 = await fetch(`${BASE}/api/player/me`, { headers: { cookie } });
      check(
        'after leaving, the old cookie is rejected with 401',
        me2.status === 401,
        `got ${me2.status}`
      );

      const mine2 = await fetch(`${BASE}/api/scores/me`, { headers: { cookie } });
      check(
        'after leaving, GET /api/scores/me is 401 too',
        mine2.status === 401,
        `got ${mine2.status}`
      );
    }
  }
} finally {
  // Stop the server and wait until it has really gone, so nothing is cut off mid-flight.
  const stopped = new Promise((resolve) => child.once('exit', resolve));
  child.kill();
  await stopped;
}

console.log(
  failures.length === 0 ? '\nSmoke check passed.' : `\nSmoke check FAILED: ${failures.join(', ')}`
);
process.exitCode = failures.length === 0 ? 0 : 1;
