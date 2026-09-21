import { Db, ObjectId } from 'mongodb';
import { COLLECTIONS } from '../database/mongo.js';
import { MAX_ATTEMPTS, hashPin, nextLock, verifyPin } from './pin.js';

/**
 * A player is a nickname and a four-digit code. No password, no email, no real
 * name. The code is not security: it is what stops one child in a classroom
 * from saving a score under another child's name.
 */
export interface Player {
  id: string;
  nickname: string;
}

interface PlayerDoc {
  _id: ObjectId;
  nickname: string;
  pinHash: string;
  pinSalt: string;
  pinAttempts: number;
  pinLockedUntil: Date | null;
  createdAt: Date;
}

/** 2-20 letters (any language), digits, spaces, dashes or underscores. */
const NICKNAME_PATTERN = /^[\p{L}\p{N} _-]{2,20}$/u;

export function normaliseNickname(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const nickname = input.trim().replace(/\s+/g, ' ');
  return NICKNAME_PATTERN.test(nickname) ? nickname : null;
}

/** What happened when somebody tried to enter under a name. */
export type EnterResult =
  | { outcome: 'claimed'; player: Player }
  | { outcome: 'entered'; player: Player }
  | { outcome: 'wrong_pin'; attemptsLeft: number }
  | { outcome: 'locked'; retryAfterSeconds: number };

/**
 * The one place that decides whether a nickname opens.
 *
 * An unknown name is claimed by whoever asks first, with the code they bring.
 * A known name opens only for the right code, and rests for a while after too
 * many wrong guesses. A name whose code Amit has cleared is claimed again.
 */
export async function enterWithPin(
  db: Db,
  nickname: string,
  pin: string,
  now = new Date()
): Promise<EnterResult> {
  const players = db.collection<PlayerDoc>(COLLECTIONS.players);
  const existing = await players.findOne({ nickname });

  if (!existing) {
    const { hash, salt } = hashPin(pin);
    const doc: PlayerDoc = {
      _id: new ObjectId(),
      nickname,
      pinHash: hash,
      pinSalt: salt,
      pinAttempts: 0,
      pinLockedUntil: null,
      createdAt: now,
    };
    await players.insertOne(doc);
    return { outcome: 'claimed', player: toPlayer(doc) };
  }

  if (existing.pinLockedUntil && existing.pinLockedUntil > now) {
    const seconds = Math.ceil((existing.pinLockedUntil.getTime() - now.getTime()) / 1000);
    return { outcome: 'locked', retryAfterSeconds: seconds };
  }

  // A cleared code means the name is free again, for whoever asks next.
  if (!existing.pinHash) {
    const { hash, salt } = hashPin(pin);
    await players.updateOne(
      { _id: existing._id },
      { $set: { pinHash: hash, pinSalt: salt, pinAttempts: 0, pinLockedUntil: null } }
    );
    return { outcome: 'claimed', player: toPlayer(existing) };
  }

  if (verifyPin(pin, existing.pinHash, existing.pinSalt)) {
    await players.updateOne(
      { _id: existing._id },
      { $set: { pinAttempts: 0, pinLockedUntil: null } }
    );
    return { outcome: 'entered', player: toPlayer(existing) };
  }

  const after = nextLock(existing.pinAttempts ?? 0, now);
  await players.updateOne(
    { _id: existing._id },
    { $set: { pinAttempts: after.attempts, pinLockedUntil: after.lockedUntil } }
  );

  if (after.lockedUntil) {
    const seconds = Math.ceil((after.lockedUntil.getTime() - now.getTime()) / 1000);
    return { outcome: 'locked', retryAfterSeconds: seconds };
  }
  return { outcome: 'wrong_pin', attemptsLeft: MAX_ATTEMPTS - after.attempts };
}

/** Amit's way out when a child forgets their code: the name is claimable again. */
export async function clearPin(db: Db, nickname: string): Promise<boolean> {
  const result = await db
    .collection<PlayerDoc>(COLLECTIONS.players)
    .updateOne(
      { nickname },
      { $set: { pinHash: '', pinSalt: '', pinAttempts: 0, pinLockedUntil: null } }
    );
  return result.matchedCount > 0;
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
