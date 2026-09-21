import { describe, it, expect } from 'vitest';
import { normaliseNickname } from '../src/player/players.js';

describe('normaliseNickname', () => {
  it('accepts plain names in any language and tidies spaces', () => {
    expect(normaliseNickname('  Dana   Runner ')).toBe('Dana Runner');
    expect(normaliseNickname('נועה')).toBe('נועה');
    expect(normaliseNickname('kid_1-fast')).toBe('kid_1-fast');
  });

  it('rejects too short, too long, symbols and non-strings', () => {
    expect(normaliseNickname('x')).toBeNull();
    expect(normaliseNickname('a'.repeat(21))).toBeNull();
    expect(normaliseNickname('<script>')).toBeNull();
    expect(normaliseNickname(42)).toBeNull();
    expect(normaliseNickname(undefined)).toBeNull();
  });
});
