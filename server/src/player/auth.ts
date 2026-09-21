import type { Request } from 'express';
import type { Db } from 'mongodb';
import { HttpError } from '../errors.js';
import { findPlayerById, type Player } from './players.js';
import { SESSION_COOKIE, findSessionPlayerId } from './sessions.js';

/**
 * "Who is asking?" - shared by the player routes and the score routes.
 * The browser sends a random token in a cookie; the server looks up the
 * session it belongs to and then the player.
 */

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/** The player behind a session token, or null when the session is gone. */
export async function findSignedInPlayer(db: Db, token: string): Promise<Player | null> {
  const playerId = await findSessionPlayerId(db, token);
  return playerId ? findPlayerById(db, playerId) : null;
}

/** The player behind this request, or a 401 that says so. */
export async function requirePlayer(req: Request, db: Db): Promise<Player> {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) throw new HttpError(401, 'Not signed in.');
  const player = await findSignedInPlayer(db, token);
  if (!player) throw new HttpError(401, 'Not signed in.');
  return player;
}
