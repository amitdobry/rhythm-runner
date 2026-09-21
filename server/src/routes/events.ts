import { Router } from 'express';
import { readAdminKey } from '../config.js';
import { getDb } from '../database/mongo.js';
import { HttpError } from '../errors.js';
import { summarize, recordEvent, validateEvent } from '../events/events.js';

/**
 * The anonymous funnel.
 *
 *   POST /api/events           one thing happened in a browser   (public)
 *   GET  /api/events/summary   the funnel                        (needs the admin key)
 *
 * Recording an event must never get in the way of playing, so a valid event
 * answers 204 even when the database is down: the count is worth less than the
 * game. The summary hides itself with a 404 rather than a 401, so a stranger
 * cannot tell that it is there.
 */
export const eventsRouter = Router();

const DEFAULT_DAYS = 7;
const MAX_DAYS = 90;

function readDays(value: unknown): number {
  const days = Number(value);
  if (!Number.isFinite(days) || days < 1) return DEFAULT_DAYS;
  return Math.min(Math.floor(days), MAX_DAYS);
}

eventsRouter.post('/', async (req, res) => {
  const event = validateEvent(req.body);
  if (!event) throw new HttpError(400, 'That is not an event this app sends.');

  const db = getDb();
  if (db) {
    try {
      await recordEvent(db, event);
    } catch (err) {
      console.error('[events] could not record an event:', err);
    }
  }
  res.status(204).end();
});

eventsRouter.get('/summary', async (req, res) => {
  const adminKey = readAdminKey();
  const given = req.header('x-admin-key');
  if (!adminKey || given !== adminKey) {
    throw new HttpError(404, `No such API route: ${req.method} ${req.path}`);
  }

  const db = getDb();
  if (!db) throw new HttpError(503, 'The database is not connected. Check the server log.');

  res.json(await summarize(db, readDays(req.query.days)));
});
