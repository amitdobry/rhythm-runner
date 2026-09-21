// Combo and accuracy: the reward for keeping the pace instead of hammering keys.

import type { GameConfig } from './config';

/** The multiplier for a combo, from config.comboMultipliers. */
export function comboMultiplier(combo: number, config: GameConfig): number {
  let multiplier = 1;
  for (const entry of config.comboMultipliers) {
    if (combo >= entry.fromCombo) multiplier = entry.multiplier;
  }
  return multiplier;
}

/** hits / (hits + misses + skipped), between 0 and 1. All zero -> 0. */
export function accuracy(counts: {
  perfect: number;
  good: number;
  miss: number;
  skipped: number;
}): number {
  const hits = counts.perfect + counts.good;
  const total = hits + counts.miss + counts.skipped;
  if (total === 0) return 0;
  return hits / total;
}
