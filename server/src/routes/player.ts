import { Router } from 'express';
import { getDb } from '../database/mongo.js';
import { clearPin, enterWithPin, normaliseNickname } from '../player/players.js';
import { isPin } from '../player/pin.js';
import { readAdminKey } from '../config.js';
import { SESSION_COOKIE, SESSION_DAYS, createSession, deleteSession } from '../player/sessions.js';
import { findSignedInPlayer, readCookie } from '../player/auth.js';
import { HttpError } from '../errors.js';

/**
 * The player-entry API.
 *
 *   POST /api/player/enter     { nickname, pin } -> claims or opens a name
 *   GET  /api/player/me                          -> who is this browser? (401 if nobody)
 *   POST /api/player/leave                       -> ends the session
 *   POST /api/player/reset-pin { nickname }      -> Amit clears a forgotten code
 *
 * The four-digit code is what stops one child saving a score as another. It is
 * never stored in the clear, never logged, and never sent back to anybody.
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

playerRouter.post('/enter', async (req, res) => {
  const nickname = normaliseNickname(req.body?.nickname);
  const pin = req.body?.pin;
  if (!nickname || !isPin(pin)) {
    res.status(400).json({
      error: 'A nickname of 2-20 characters and a four-digit code are needed.',
      code: 'bad_input',
    });
    return;
  }

  const db = requireDb();
  const result = await enterWithPin(db, nickname, pin);

  if (result.outcome === 'locked') {
    res.status(423).json({
      error: 'Too many tries on this name. Wait a little, or pick another name.',
      code: 'locked',
      retryAfterSeconds: result.retryAfterSeconds,
    });
    return;
  }

  if (result.outcome === 'wrong_pin') {
    res.status(401).json({
      error: 'That code does not match this name.',
      code: 'wrong_pin',
      attemptsLeft: result.attemptsLeft,
    });
    return;
  }

  const token = await createSession(db, result.player.id);
  res.cookie(SESSION_COOKIE, token, cookieOptions);
  res.json({ player: result.player, claimed: result.outcome === 'claimed' });
});

/**
 * Amit's way out when a child forgets their code. Hidden behind the admin key
 * and, like the analytics summary, a 404 to everybody else.
 */
playerRouter.post('/reset-pin', async (req, res) => {
  const adminKey = readAdminKey();
  const given = req.header('x-admin-key');
  if (!adminKey || given !== adminKey) {
    throw new HttpError(404, `No such API route: ${req.method} ${req.path}`);
  }

  const nickname = normaliseNickname(req.body?.nickname);
  if (!nickname) throw new HttpError(400, 'Which nickname?');

  const db = requireDb();
  await clearPin(db, nickname);
  res.json({ ok: true });
});

playerRouter.get('/me', async (req, res) => {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) throw new HttpError(401, 'Not signed in.');
  const db = requireDb();
  const player = await findSignedInPlayer(db, token);
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
