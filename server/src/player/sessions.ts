import { randomBytes } from 'node:crypto';
import { Db } from 'mongodb';
import { COLLECTIONS } from '../database/mongo.js';

/**
 * A session is the server's memory that "this browser is player X".
 * The browser holds only a random token, in a cookie JavaScript cannot read.
 */
export const SESSION_COOKIE = 'rr_session';
// A year. A child who played in a corridor in September should still be
// themselves in June, without typing anything again.
export const SESSION_DAYS = 365;

interface SessionDoc {
  token: string;
  playerId: string;
  createdAt: Date;
  expiresAt: Date;
}

export async function createSession(db: Db, playerId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.collection<SessionDoc>(COLLECTIONS.sessions).insertOne({
    token,
    playerId,
    createdAt: now,
    expiresAt,
  });
  return token;
}

/** Returns the player id for a live session, or null. */
export async function findSessionPlayerId(db: Db, token: string): Promise<string | null> {
  const session = await db
    .collection<SessionDoc>(COLLECTIONS.sessions)
    .findOne({ token, expiresAt: { $gt: new Date() } });
  return session?.playerId ?? null;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.collection<SessionDoc>(COLLECTIONS.sessions).deleteOne({ token });
}
