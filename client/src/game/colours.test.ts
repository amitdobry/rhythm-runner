import { describe, it, expect } from 'vitest';
import { SHIRT_COLOURS, colourForNickname } from './colours';

describe('colourForNickname', () => {
  it('gives a visitor with no name the first shirt', () => {
    expect(colourForNickname(null)).toBe(SHIRT_COLOURS[0]);
    expect(colourForNickname(undefined)).toBe(SHIRT_COLOURS[0]);
    expect(colourForNickname('')).toBe(SHIRT_COLOURS[0]);
  });

  it('always gives the same name the same shirt', () => {
    // This is the whole point: a child must recognise themselves next visit.
    expect(colourForNickname('קאי')).toBe(colourForNickname('קאי'));
    expect(colourForNickname('Amit')).toBe(colourForNickname('Amit'));
  });

  it('can tell different names apart', () => {
    const names = ['קאי', 'עמית', 'איימי', 'beast', 'Maya', 'Noam', 'Dan'];
    const used = new Set(names.map(colourForNickname));
    expect(used.size).toBeGreaterThan(1);
  });

  it('only ever returns one of the six shirts', () => {
    const names = ['a', 'bb', 'ccc', 'קאי', 'Maya', '1234', 'a very long nickname'];
    for (const name of names) {
      expect(SHIRT_COLOURS).toContain(colourForNickname(name));
    }
  });
});
