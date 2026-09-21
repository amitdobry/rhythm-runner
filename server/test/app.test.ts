import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../src/app.js';

/**
 * Smoke test for the HTTP layer with NO database connected.
 * Proves the server starts, health answers, and every player route fails clearly.
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

async function postJson(path: string, body: unknown) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/health', () => {
  it('answers ok and reports the database as disconnected', async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('disconnected');
  });
});

describe('player routes without a database', () => {
  it('GET /api/player/me is 401 with no cookie', async () => {
    const res = await fetch(`${base}/api/player/me`);
    expect(res.status).toBe(401);
  });

  it('POST /api/player/enter rejects a bad nickname with 400', async () => {
    const res = await postJson('/api/player/enter', { nickname: 'x', pin: '1234' });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('bad_input');
  });

  it('POST /api/player/enter without a code is 400', async () => {
    const res = await postJson('/api/player/enter', { nickname: 'Runner 1' });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('bad_input');
  });

  it('POST /api/player/enter rejects a code that is not four digits', async () => {
    const res = await postJson('/api/player/enter', { nickname: 'Runner 1', pin: '12a4' });
    expect(res.status).toBe(400);
  });

  it('POST /api/player/enter with a name and a code answers 503 (database not connected)', async () => {
    const res = await postJson('/api/player/enter', { nickname: 'Runner 1', pin: '1234' });
    expect(res.status).toBe(503);
  });

  it('POST /api/player/reset-pin hides itself with a 404 without the admin key', async () => {
    const res = await postJson('/api/player/reset-pin', { nickname: 'Runner 1' });
    expect(res.status).toBe(404);
  });

  it('unknown API routes answer 404 as JSON', async () => {
    const res = await fetch(`${base}/api/nothing-here`);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/No such API route/);
  });
});
