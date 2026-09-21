import { describe, it, expect } from 'vitest';
import { footForKey } from './useGameLoop';

/**
 * The keyboard mapping, and the bug it was written for: matching on the letter
 * a key produces means F and J stop working the moment the player switches to
 * a Hebrew layout - which, for this audience, is most of the time.
 */
function press(code: string, key: string): KeyboardEvent {
  return { code, key } as KeyboardEvent;
}

describe('footForKey', () => {
  it('reads the arrow keys', () => {
    expect(footForKey(press('ArrowLeft', 'ArrowLeft'))).toBe('left');
    expect(footForKey(press('ArrowRight', 'ArrowRight'))).toBe('right');
  });

  it('reads F and J on an English keyboard', () => {
    expect(footForKey(press('KeyF', 'f'))).toBe('left');
    expect(footForKey(press('KeyJ', 'j'))).toBe('right');
  });

  it('reads the same two keys on a Hebrew keyboard', () => {
    // The physical F key types כ in Hebrew, and J types ח.
    expect(footForKey(press('KeyF', 'כ'))).toBe('left');
    expect(footForKey(press('KeyJ', 'ח'))).toBe('right');
  });

  it('still understands the letter when a browser reports no code', () => {
    expect(footForKey(press('', 'F'))).toBe('left');
    expect(footForKey(press('', 'j'))).toBe('right');
  });

  it('ignores every other key', () => {
    expect(footForKey(press('KeyQ', 'q'))).toBeNull();
    expect(footForKey(press('Space', ' '))).toBeNull();
  });
});
