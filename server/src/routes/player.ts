import { Router, Request } from 'express';
import { getDb } from '../database/mongo.js';
import { findOrCreatePlayer, findPlayerById, normaliseNickname } from '../player/players.js';
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  createSession,
  deleteSession,
  findSessionPlayerId,
} from '../player/sessions.js';
import { HttpError } from '../errors.js';

/**
 * The player-entry API.
 *
 *   POST /api/player/enter  { nickname }  -> starts a session, returns the player
 *   GET  /api/player/me                   -> who is this browser? (401 if nobody)
 *   POST /api/player/leave                -> ends the session
 */
export const playerRouter = Router();

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
};

function requireDb() {
  const db = getDb();
  if (!db) throw new HttpError(503, 'The database is not connected. Check the server log.');
  return db;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

playerRouter.post('/enter', async (req, res) => {
  const nickname = normaliseNickname(req.body?.nickname);
  if (!nickname) {
    throw new HttpError(
      400,
      'Nickname must be 2-20 letters, digits, spaces, dashes or underscores.'
    );
  }
  const db = requireDb();
  const player = await findOrCreatePlayer(db, nickname);
  const token = await createSession(db, player.id);
  res.cookie(SESSION_COOKIE, token, cookieOptions);
  res.json({ player });
});

playerRouter.get('/me', async (req, res) => {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) throw new HttpError(401, 'Not signed in.');
  const db = requireDb();
  const playerId = await findSessionPlayerId(db, token);
  const player = playerId ? await findPlayerById(db, playerId) : null;
  if (!player) {
    res.clearCookie(SESSION_COOKIE);
    throw new HttpError(401, 'Not signed in.');
  }
  res.json({ player });
});

playerRouter.post('/leave', async (req, res) => {
  const token = readCookie(req, SESSION_COOKIE);
  const db = getDb();
  if (token && db) await deleteSession(db, token);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});
