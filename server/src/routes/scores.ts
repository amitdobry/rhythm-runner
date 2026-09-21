import { Router } from 'express';
import { getDb } from '../database/mongo.js';
import { HttpError } from '../errors.js';
import { findSignedInPlayer, readCookie, requirePlayer } from '../player/auth.js';
import { SESSION_COOKIE } from '../player/sessions.js';
import {
  isRange,
  personalBest,
  saveRun,
  standingFor,
  topScores,
  validateRun,
  weekWindow,
  type Range,
} from '../scores/scores.js';

/**
 * The score API.
 *
 *   POST /api/scores        save a finished run, get its ranks   (needs the cookie)
 *   GET  /api/scores/top    the leaderboard, this week or ever   (public)
 *   GET  /api/scores/me     my best run and how many I have made (needs the cookie)
 *
 * The leaderboard is public on purpose: a child should be able to see the
 * other names before deciding to type their own. There is one board: a phone
 * and a keyboard play the same game. The weekly view is the default, so the
 * top of it stays winnable by somebody who arrives in November.
 */
export const scoresRouter = Router();

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function requireDb() {
  const db = getDb();
  if (!db) throw new HttpError(503, 'The database is not connected. Check the server log.');
  return db;
}

/** A missing cookie is a 401 before anything else is looked at. */
function requireCookie(token: string | null): string {
  if (!token) throw new HttpError(401, 'Not signed in.');
  return token;
}

function readLimit(value: unknown): number {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(limit), MAX_LIMIT);
}

function readRange(value: unknown): Range {
  if (value === undefined) return 'week'; // the board a visitor should see first
  if (!isRange(value)) throw new HttpError(400, 'range must be week or all.');
  return value;
}

scoresRouter.post('/', async (req, res) => {
  requireCookie(readCookie(req, SESSION_COOKIE));
  const db = requireDb();
  const player = await requirePlayer(req, db);

  const summary = validateRun(req.body);
  if (!summary) throw new HttpError(400, 'That run does not look like a real run.');

  res.status(201).json(await saveRun(db, player, summary));
});

scoresRouter.get('/top', async (req, res) => {
  // One board for everyone. A ?platform= from an older page is simply ignored.
  const range = readRange(req.query.range);
  const db = requireDb();
  const { weekStart, weekEnd } = weekWindow();
  const weekKey = range === 'week' ? weekStart : null;

  const rows = await topScores(db, readLimit(req.query.limit), weekKey);

  // A signed-in visitor also gets their own standing, so somebody outside the
  // top ten can still see where they are.
  let me = null;
  const token = readCookie(req, SESSION_COOKIE);
  if (token) {
    const player = await findSignedInPlayer(db, token);
    if (player) me = await standingFor(db, player.id, weekKey);
  }

  res.json({ range, weekStart, weekEnd, rows, me });
});

scoresRouter.get('/me', async (req, res) => {
  requireCookie(readCookie(req, SESSION_COOKIE));
  const db = requireDb();
  const player = await requirePlayer(req, db);
  res.json(await personalBest(db, player.id));
});
