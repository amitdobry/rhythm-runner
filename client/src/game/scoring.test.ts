import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from './config';
import { accuracy, comboMultiplier } from './scoring';

describe('comboMultiplier', () => {
  it('is one below ten', () => {
    expect(comboMultiplier(0, DEFAULT_CONFIG)).toBe(1);
    expect(comboMultiplier(9, DEFAULT_CONFIG)).toBe(1);
  });

  it('is two from ten to nineteen', () => {
    expect(comboMultiplier(10, DEFAULT_CONFIG)).toBe(2);
    expect(comboMultiplier(19, DEFAULT_CONFIG)).toBe(2);
  });

  it('is three from twenty up', () => {
    expect(comboMultiplier(20, DEFAULT_CONFIG)).toBe(3);
    expect(comboMultiplier(99, DEFAULT_CONFIG)).toBe(3);
  });
});

describe('accuracy', () => {
  it('counts good steps against everything that was asked for', () => {
    expect(accuracy({ perfect: 50, good: 20, miss: 20, skipped: 10 })).toBeCloseTo(0.7);
  });

  it('is zero before anything has happened', () => {
    expect(accuracy({ perfect: 0, good: 0, miss: 0, skipped: 0 })).toBe(0);
  });
});
