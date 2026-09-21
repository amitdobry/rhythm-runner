import { describe, it, expect } from 'vitest';
import { T, fill, formatNumber } from './he';

/**
 * The app is Hebrew. This test is what keeps it that way: if anyone drops an
 * English word into the string table, it fails here instead of on a phone in
 * front of a child.
 */

// The only Latin allowed, longest first so a phrase is removed before its parts.
const ALLOWED = ['Rhythm Runner', 'Claude Code', 'AI', 'PC', 'F', 'J'];

function withoutAllowedLatin(value: string): string {
  // {name}, {n}, {score}, {runs} are holes that `fill` closes before anyone
  // reads the string, so they are not English on the screen.
  let rest = value.replace(/\{\w+\}/g, '');
  for (const token of ALLOWED) rest = rest.split(token).join('');
  return rest;
}

describe('the Hebrew string table', () => {
  it('has no English outside the short allowlist', () => {
    for (const [key, value] of Object.entries(T)) {
      const leftovers = withoutAllowedLatin(value).match(/[A-Za-z]/g);
      expect(leftovers, `${key} still contains Latin letters: ${value}`).toBeNull();
    }
  });

  it('is frozen, so nothing can rewrite a string at runtime', () => {
    expect(Object.isFrozen(T)).toBe(true);
  });

  it('keeps the brand in Latin', () => {
    expect(T.brand).toBe('Rhythm Runner');
  });
});

describe('fill', () => {
  it('puts values into the placeholders', () => {
    expect(fill(T.hello, { name: 'קאי' })).toBe('שלום, קאי');
    expect(fill(T.rank, { n: 3 })).toBe('מקום 3 בטבלה');
  });

  it('leaves a placeholder alone when nothing was given for it', () => {
    expect(fill('שלום, {name}', {})).toBe('שלום, {name}');
  });
});

describe('formatNumber', () => {
  it('groups thousands', () => {
    expect(formatNumber(1240)).toBe((1240).toLocaleString('he-IL'));
    expect(formatNumber(7)).toBe('7');
  });
});
