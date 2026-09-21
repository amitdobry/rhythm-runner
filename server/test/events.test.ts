import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../src/app.js';

/**
 * The funnel routes with NO database connected.
 *
 * Two rules are worth proving: a valid event answers 204 even when nothing can
 * be written (counting must never break the game), and the summary pretends
 * not to exist unless the caller has the admin key.
 */
const ADMIN_KEY = 'test-admin-key-do-not-use-anywhere';

let server: Server;
let base: string;

beforeAll(async () => {
  process.env.ADMIN_KEY = ADMIN_KEY;
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  delete process.env.ADMIN_KEY;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const validEvent = {
  sid: 'abc123def456ghi789',
  name: 'run_completed',
  platform: 'mobile',
  ref: 'LEAF5',
  data: { score: 830, distance: 707, skipped: 4 },
};

async function postEvent(body: unknown) {
  return fetch(`${base}/api/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/events', () => {
  it('accepts a valid event with 204, even with no database', async () => {
    const res = await postEvent(validEvent);
    expect(res.status).toBe(204);
  });

  it('refuses an event name the app never sends', async () => {
    const res = await postEvent({ ...validEvent, name: 'bought_a_horse' });
    expect(res.status).toBe(400);
  });

  it('refuses a session id that is not plain letters and digits', async () => {
    const res = await postEvent({ ...validEvent, sid: 'abc-123-def-456' });
    expect(res.status).toBe(400);
  });

  it('refuses data with more keys than we ever send', async () => {
    const data = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9 };
    const res = await postEvent({ ...validEvent, data });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/events/summary', () => {
  it('hides itself with a 404 when no key is given', async () => {
    const res = await fetch(`${base}/api/events/summary`);
    expect(res.status).toBe(404);
  });

  it('hides itself with a 404 when the key is wrong', async () => {
    const res = await fetch(`${base}/api/events/summary`, {
      headers: { 'x-admin-key': 'not-the-key' },
    });
    expect(res.status).toBe(404);
  });

  it('answers 503 with the right key and no database', async () => {
    const res = await fetch(`${base}/api/events/summary?days=1`, {
      headers: { 'x-admin-key': ADMIN_KEY },
    });
    expect(res.status).toBe(503);
  });
});
