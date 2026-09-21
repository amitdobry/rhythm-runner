import { describe, it, expect } from 'vitest';
import {
  hashPin,
  isPin,
  nextLock,
  verifyPin,
  MAX_ATTEMPTS,
  LOCK_MINUTES,
} from '../src/player/pin.js';

describe('isPin', () => {
  it('accepts exactly four digits, leading zeros included', () => {
    expect(isPin('0000')).toBe(true);
    expect(isPin('1234')).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isPin('123')).toBe(false);
    expect(isPin('12345')).toBe(false);
    expect(isPin('12a4')).toBe(false);
    expect(isPin(1234)).toBe(false);
    expect(isPin(undefined)).toBe(false);
  });
});

describe('hashPin and verifyPin', () => {
  it('recognises the code it was given', () => {
    const { hash, salt } = hashPin('4821');
    expect(verifyPin('4821', hash, salt)).toBe(true);
  });

  it('refuses a different code', () => {
    const { hash, salt } = hashPin('4821');
    expect(verifyPin('4822', hash, salt)).toBe(false);
  });

  it('refuses when there is no stored code at all', () => {
    // A player whose PIN was reset by Amit: the next enter claims the name.
    expect(verifyPin('4821', '', '')).toBe(false);
  });

  it('hashes the same code differently every time', () => {
    // Two children who both pick 1234 must not look identical in the database.
    const first = hashPin('1234');
    const second = hashPin('1234');
    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);
  });
});

describe('nextLock', () => {
  const now = new Date('2026-09-22T10:00:00.000Z');

  it('counts a wrong guess without locking', () => {
    const after = nextLock(0, now);
    expect(after.attempts).toBe(1);
    expect(after.lockedUntil).toBeNull();
  });

  it('locks the name on the last allowed attempt and starts the count again', () => {
    const after = nextLock(MAX_ATTEMPTS - 1, now);
    expect(after.attempts).toBe(0);
    expect(after.lockedUntil).toEqual(new Date(now.getTime() + LOCK_MINUTES * 60 * 1000));
  });
});
