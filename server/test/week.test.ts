import { describe, it, expect } from 'vitest';
import { weekEndFor, weekKeyFor } from '../src/scores/week.js';

/**
 * The week belongs to Israel, not to UTC. These four cases are the ones that
 * would break if the server used its own clock, which runs in UTC.
 *
 * September 2026: the 19th is a Saturday, the 20th a Sunday. Israel is UTC+3
 * in September (daylight saving).
 */
describe('weekKeyFor', () => {
  it('puts Saturday night and the Sunday after it in different weeks', () => {
    const saturdayLate = new Date('2026-09-19T20:59:00Z'); // 23:59 in Israel
    const sundayEarly = new Date('2026-09-19T21:01:00Z'); // 00:01 on Sunday in Israel
    expect(weekKeyFor(saturdayLate)).toBe('2026-09-13');
    expect(weekKeyFor(sundayEarly)).toBe('2026-09-20');
    expect(weekKeyFor(saturdayLate)).not.toBe(weekKeyFor(sundayEarly));
  });

  it('maps a Sunday to itself', () => {
    expect(weekKeyFor(new Date('2026-09-20T09:00:00Z'))).toBe('2026-09-20');
  });

  it('follows Israel when UTC still says Saturday', () => {
    // 21:30 UTC on Saturday is already 00:30 on Sunday in Israel.
    expect(weekKeyFor(new Date('2026-09-19T21:30:00Z'))).toBe('2026-09-20');
  });

  it('keeps a midweek run in the Sunday that started its week', () => {
    expect(weekKeyFor(new Date('2026-09-23T12:00:00Z'))).toBe('2026-09-20');
  });
});

describe('weekEndFor', () => {
  it('gives the Sunday a week later', () => {
    expect(weekEndFor('2026-09-20')).toBe('2026-09-27');
    expect(weekEndFor('2026-09-13')).toBe('2026-09-20');
  });
});
