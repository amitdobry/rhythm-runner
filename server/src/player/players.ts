import { Db, ObjectId } from 'mongodb';
import { COLLECTIONS } from '../database/mongo.js';

/**
 * A player is just a nickname. No password, no email, no real name.
 * This is a workshop identity: it tells the game who is playing, nothing more.
 */
export interface Player {
  id: string;
  nickname: string;
}

interface PlayerDoc {
  _id: ObjectId;
  nickname: string;
  createdAt: Date;
}

/** 2-20 letters (any language), digits, spaces, dashes or underscores. */
const NICKNAME_PATTERN = /^[\p{L}\p{N} _-]{2,20}$/u;

export function normaliseNickname(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const nickname = input.trim().replace(/\s+/g, ' ');
  return NICKNAME_PATTERN.test(nickname) ? nickname : null;
}

export async function findOrCreatePlayer(db: Db, nickname: string): Promise<Player> {
  const players = db.collection<PlayerDoc>(COLLECTIONS.players);
  const existing = await players.findOne({ nickname });
  if (existing) return toPlayer(existing);

  const doc: PlayerDoc = { _id: new ObjectId(), nickname, createdAt: new Date() };
  await players.insertOne(doc);
  return toPlayer(doc);
}

export async function findPlayerById(db: Db, id: string): Promise<Player | null> {
  if (!ObjectId.isValid(id)) return null;
  const doc = await db
    .collection<PlayerDoc>(COLLECTIONS.players)
    .findOne({ _id: new ObjectId(id) });
  return doc ? toPlayer(doc) : null;
}

function toPlayer(doc: PlayerDoc): Player {
  return { id: doc._id.toHexString(), nickname: doc.nickname };
}
