// The pace is how long the runner may take between one step and the next.
// The ground and the weather decide it; the player has to match it.

import type { Foot, GameConfig, Segment } from './config';

/** Flat and clear is the base pace; hills, water and weather stretch it. */
export function targetIntervalMs(segment: Segment, config: GameConfig): number {
  const terrain = config.terrain[segment.terrain];
  const weather = config.weather[segment.weather];
  return config.baseStepIntervalMs * terrain.paceFactor * weather.paceFactor;
}

export type Judgement = 'perfect' | 'good' | 'miss';

/** How good a step was. offsetMs is negative when the step came too early. */
export function judgeOffset(offsetMs: number, config: GameConfig): Judgement {
  const distance = Math.abs(offsetMs);
  if (distance <= config.perfectWindowMs) return 'perfect';
  if (distance <= config.goodWindowMs) return 'good';
  return 'miss';
}

/** Left, right, left, right: after one foot comes the other. */
export function oppositeFoot(foot: Foot): Foot {
  return foot === 'left' ? 'right' : 'left';
}
