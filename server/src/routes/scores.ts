import { Router } from 'express';
import { getDb } from '../database/mongo.js';
import { HttpError } from '../errors.js';
import { readCookie, requirePlayer } from '../player/auth.js';
import { SESSION_COOKIE } from '../player/sessions.js';
import { personalBest, saveRun, topScores, validateRun } from '../scores/scores.js';

/**
 * The score API.
 *
 *   POST /api/scores        save a finished run, get its rank   (needs the cookie)
 *   GET  /api/scores/top    the leaderboard                     (public)
 *   GET  /api/scores/me     my best run and how many I have made (needs the cookie)
 *
 * The leaderboard is public on purpose: a child should be able to see the
 * other names before deciding to type their own. There is one board: a phone
 * and a keyboard play the same game.
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

scoresRouter.post('/', async (req, res) => {
  requireCookie(readCookie(req, SESSION_COOKIE));
  const db = requireDb();
  const player = await requirePlayer(req, db);

  const summary = validateRun(req.body);
  if (!summary) throw new HttpError(400, 'That run does not look like a real run.');

  const { saved, rank } = await saveRun(db, player, summary);
  res.status(201).json({ saved, rank });
});

scoresRouter.get('/top', async (req, res) => {
  // One board for everyone. A ?platform= from an older page is simply ignored.
  const db = requireDb();
  res.json({ rows: await topScores(db, readLimit(req.query.limit)) });
});

scoresRouter.get('/me', async (req, res) => {
  requireCookie(readCookie(req, SESSION_COOKIE));
  const db = requireDb();
  const player = await requirePlayer(req, db);
  res.json(await personalBest(db, player.id));
});
