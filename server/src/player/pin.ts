import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * A four-digit code that keeps a nickname yours.
 *
 * This is not a password and it does not protect anything valuable: it stops
 * one child in a classroom from saving a score as another child. So the rules
 * are the gentle ones - four digits, five tries, a short lock - and the code
 * is still never stored, never logged and never sent back.
 *
 * Four digits is only ten thousand possibilities, so the lock matters more
 * here than the hashing does. Both are cheap; we do both.
 */

export const PIN_PATTERN = /^\d{4}$/;
export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

const SALT_BYTES = 16;
const KEY_BYTES = 32;
const SCRYPT_COST = 16384; // N

export function isPin(value: unknown): value is string {
  return typeof value === 'string' && PIN_PATTERN.test(value);
}

/** Turns a code into something safe to store. A fresh salt unless one is given. */
export function hashPin(pin: string, salt?: string): { hash: string; salt: string } {
  const useSalt = salt ?? randomBytes(SALT_BYTES).toString('hex');
  const hash = scryptSync(pin, useSalt, KEY_BYTES, { N: SCRYPT_COST }).toString('hex');
  return { hash, salt: useSalt };
}

/** Compares without leaking, through timing, how much of the code was right. */
export function verifyPin(pin: string, hash: string, salt: string): boolean {
  if (!hash || !salt) return false;
  try {
    const attempt = scryptSync(pin, salt, KEY_BYTES, { N: SCRYPT_COST });
    const stored = Buffer.from(hash, 'hex');
    if (attempt.length !== stored.length) return false;
    return timingSafeEqual(attempt, stored);
  } catch {
    return false;
  }
}

/**
 * What a wrong guess costs. Five in a row and the name rests for a quarter of
 * an hour; the count then starts again from nothing.
 */
export function nextLock(
  attempts: number,
  now: Date
): { attempts: number; lockedUntil: Date | null } {
  const used = attempts + 1;
  if (used >= MAX_ATTEMPTS) {
    return { attempts: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60 * 1000) };
  }
  return { attempts: used, lockedUntil: null };
}
