import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, MOBILE_CONFIG } from './config';
import type { Segment } from './config';
import { judgeOffset, oppositeFoot, targetIntervalMs } from './pace';

function segment(terrain: Segment['terrain'], weather: Segment['weather']): Segment {
  return { terrain, weather, lengthMeters: 100 };
}

describe('targetIntervalMs', () => {
  it('is the base pace on flat ground in clear weather', () => {
    expect(targetIntervalMs(segment('flat', 'clear'), DEFAULT_CONFIG)).toBeCloseTo(600);
  });

  it('is slower uphill and quicker downhill', () => {
    expect(targetIntervalMs(segment('uphill', 'clear'), DEFAULT_CONFIG)).toBeCloseTo(780);
    expect(targetIntervalMs(segment('downhill', 'clear'), DEFAULT_CONFIG)).toBeCloseTo(480);
  });

  it('is slowest in water', () => {
    expect(targetIntervalMs(segment('water', 'clear'), DEFAULT_CONFIG)).toBeCloseTo(900);
  });

  it('multiplies ground and weather together', () => {
    expect(targetIntervalMs(segment('uphill', 'rain'), DEFAULT_CONFIG)).toBeCloseTo(897);
  });
});

describe('judgeOffset', () => {
  // Read the windows from the config: the rule is what is being tested here,
  // not the numbers, and the numbers are tuned as the game gets easier.
  const perfect = DEFAULT_CONFIG.perfectWindowMs;
  const good = DEFAULT_CONFIG.goodWindowMs;

  it('calls a step inside the perfect window perfect', () => {
    expect(judgeOffset(0, DEFAULT_CONFIG)).toBe('perfect');
    expect(judgeOffset(perfect, DEFAULT_CONFIG)).toBe('perfect');
  });

  it('calls a step inside the good window good', () => {
    expect(judgeOffset(perfect + 1, DEFAULT_CONFIG)).toBe('good');
    expect(judgeOffset(good, DEFAULT_CONFIG)).toBe('good');
  });

  it('calls anything further away a miss', () => {
    expect(judgeOffset(good + 1, DEFAULT_CONFIG)).toBe('miss');
  });

  it('treats early and late the same', () => {
    expect(judgeOffset(-perfect, DEFAULT_CONFIG)).toBe('perfect');
    expect(judgeOffset(-(good + 1), DEFAULT_CONFIG)).toBe('miss');
  });

  it('gives a phone wider windows than a keyboard', () => {
    expect(MOBILE_CONFIG.perfectWindowMs).toBeGreaterThan(perfect);
    expect(MOBILE_CONFIG.goodWindowMs).toBeGreaterThan(good);
    // A step a keyboard would call a miss can still be good with a thumb.
    expect(judgeOffset(good + 1, MOBILE_CONFIG)).toBe('good');
    expect(judgeOffset(perfect + 1, MOBILE_CONFIG)).toBe('perfect');
  });
});

describe('oppositeFoot', () => {
  it('flips from one foot to the other', () => {
    expect(oppositeFoot('left')).toBe('right');
    expect(oppositeFoot('right')).toBe('left');
  });
});
