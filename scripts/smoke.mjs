// Smoke check: start the real server, prove the foundation works, stop it.
//
//   npm run smoke
//
// Needs server/.env (or MONGODB_URI in the environment). With a reachable database
// it walks the whole flow: enter -> me -> save a run -> leaderboard -> my best
// -> leave -> me is 401.
// Without one it still proves the server starts and fails clearly (503).
// Never prints the connection string.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PORT = Number(process.env.SMOKE_PORT ?? 4100);
const BASE = `http://127.0.0.1:${PORT}`;
const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server');

const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
  cwd: serverDir,
  env: { ...process.env, PORT: String(PORT) },
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
      body: JSON.stringify({ nickname: 'Smoke Test' }),
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
        'POST /api/player/enter creates a session',
        enter.status === 200 && cookie.startsWith('rr_session='),
        `got ${enter.status}`
      );

      const me1 = await fetch(`${BASE}/api/player/me`, { headers: { cookie } });
      const body = me1.ok ? await me1.json() : {};
      check(
        'GET /api/player/me with the cookie returns the player',
        me1.status === 200 && body.player?.nickname === 'Smoke Test',
        `got ${me1.status}`
      );

      // A finished run: save it, find it on the board, read it back as my best.
      const run = {
        score: 1,
        distance: 1,
        accuracy: 0,
        bestCombo: 0,
        runSeconds: 60,
        platform: 'pc',
        course: 'level-1',
      };
      const posted = await fetch(`${BASE}/api/scores`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify(run),
      });
      const savedBody = posted.status === 201 ? await posted.json() : {};
      check(
        'POST /api/scores saves the run and answers with a rank',
        posted.status === 201 && typeof savedBody.rank === 'number',
        `got ${posted.status}`
      );

      const top = await fetch(`${BASE}/api/scores/top?platform=pc&limit=50`);
      const topBody = top.ok ? await top.json() : { rows: [] };
      check(
        'GET /api/scores/top (no cookie needed) lists the nickname',
        top.status === 200 && topBody.rows.some((row) => row.nickname === 'Smoke Test'),
        `got ${top.status}`
      );

      const mine = await fetch(`${BASE}/api/scores/me`, { headers: { cookie } });
      const mineBody = mine.ok ? await mine.json() : {};
      check(
        'GET /api/scores/me shows my best PC run',
        mine.status === 200 && mineBody.best?.pc?.nickname === 'Smoke Test' && mineBody.runs >= 1,
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
