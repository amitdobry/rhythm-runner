import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../src/app.js';
import { validateRun, type RunSummary } from '../src/scores/scores.js';

/**
 * The score routes with NO database connected, plus the validation on its own.
 * Proves that a missing cookie is refused before anything is read, that the
 * leaderboard needs no cookie, and that impossible runs never reach the database.
 */
let server: Server;
let base: string;

beforeAll(async () => {
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

/** A run that really could have happened: 300 m and 500 points in 60 seconds. */
const validRun: RunSummary = {
  score: 500,
  distance: 300,
  accuracy: 0.82,
  bestCombo: 24,
  runSeconds: 60,
  platform: 'pc',
  course: 'level-1',
};

async function postScore(body: unknown, cookie?: string) {
  return fetch(`${base}/api/scores`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('score routes without a database', () => {
  it('POST /api/scores without a cookie is 401', async () => {
    const res = await postScore(validRun);
    expect(res.status).toBe(401);
  });

  it('POST /api/scores with a cookie but no database is 503', async () => {
    const res = await postScore(validRun, 'rr_session=made-up-token');
    expect(res.status).toBe(503);
  });

  it('GET /api/scores/top needs no cookie: it answers 503, not 401', async () => {
    const res = await fetch(`${base}/api/scores/top`);
    expect(res.status).toBe(503);
  });

  it('GET /api/scores/top ignores a platform from an older page', async () => {
    // One board now. An old link with ?platform= must not be an error.
    const res = await fetch(`${base}/api/scores/top?platform=pc`);
    expect(res.status).toBe(503); // no database here, but never 400
  });

  it('GET /api/scores/top?range=all is public too', async () => {
    const res = await fetch(`${base}/api/scores/top?range=all`);
    expect(res.status).toBe(503); // not 401
  });

  it('GET /api/scores/top refuses a range the game does not have', async () => {
    const res = await fetch(`${base}/api/scores/top?range=x`);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/range/);
  });

  it('GET /api/scores/me without a cookie is 401', async () => {
    const res = await fetch(`${base}/api/scores/me`);
    expect(res.status).toBe(401);
  });
});

describe('validateRun', () => {
  it('accepts a run that could really have happened', () => {
    expect(validateRun(validRun)).toEqual(validRun);
  });

  it('refuses a run with a field missing', () => {
    const { bestCombo, ...withoutCombo } = validRun;
    expect(bestCombo).toBe(24);
    expect(validateRun(withoutCombo)).toBeNull();
  });

  it('refuses a negative score', () => {
    expect(validateRun({ ...validRun, score: -1 })).toBeNull();
  });

  it('refuses an accuracy above one', () => {
    expect(validateRun({ ...validRun, accuracy: 1.2 })).toBeNull();
  });

  it('refuses a distance nobody could run', () => {
    // 20 m/s x 60 s is the most that is possible.
    expect(validateRun({ ...validRun, distance: 1201, score: 0 })).toBeNull();
  });

  it('refuses a score too high for the distance', () => {
    // The best multiplier is x3, so 300 m can never be worth more than 900.
    expect(validateRun({ ...validRun, score: 901 })).toBeNull();
  });

  it('refuses a combo longer than the run has steps', () => {
    // 60 s at the quickest pace of 480 ms is 125 steps.
    expect(validateRun({ ...validRun, bestCombo: 126 })).toBeNull();
  });

  it('refuses a platform the game does not have', () => {
    expect(validateRun({ ...validRun, platform: 'tablet' })).toBeNull();
  });
});
