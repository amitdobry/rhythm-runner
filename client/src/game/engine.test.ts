import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, MOBILE_CONFIG } from './config';
import type { Foot, GameConfig, Segment } from './config';
import type { GameState } from './engine';
import { createGame, startRun, step, summarize, tick } from './engine';

// The real game loop ticks many small steps a second. The tests do the same,
// so decay and missed steps behave exactly as they will in the browser.
function advanceTo(state: GameState, timeMs: number): GameState {
  let next = state;
  while (next.timeMs < timeMs) {
    const before = next.timeMs;
    next = tick(next, Math.min(10, timeMs - next.timeMs));
    if (next.timeMs === before) break; // the run is over; time stopped
  }
  return next;
}

function stepAt(state: GameState, timeMs: number, foot: Foot): GameState {
  return step(advanceTo(state, timeMs), foot);
}

function withCourse(course: Segment[], overrides: Partial<GameConfig> = {}): GameConfig {
  return { ...DEFAULT_CONFIG, course, ...overrides };
}

describe('createGame', () => {
  it('waits, with the starting speed and energy', () => {
    const game = createGame();
    expect(game.phase).toBe('ready');
    expect(game.speed).toBe(DEFAULT_CONFIG.speed.start);
    expect(game.energy).toBe(DEFAULT_CONFIG.energy.start);
  });

  it('ignores a step before the run has started', () => {
    const game = createGame();
    expect(step(game, 'left')).toBe(game);
  });
});

describe('startRun', () => {
  it('starts at time zero with the first left step due', () => {
    const running = startRun(createGame());
    expect(running.phase).toBe('running');
    expect(running.timeMs).toBe(0);
    expect(running.nextDueMs).toBe(600);
    expect(running.expectedFoot).toBe('left');
  });
});

describe('step', () => {
  it('rewards a perfect step', () => {
    const before = advanceTo(startRun(createGame()), 600);
    const after = step(before, 'left');
    expect(after.speed).toBeCloseTo(before.speed + DEFAULT_CONFIG.speed.perfectBoost);
    expect(after.energy).toBe(DEFAULT_CONFIG.energy.max); // +3, but it was already full
    expect(after.combo).toBe(1);
    expect(after.counts.perfect).toBe(1);
    expect(after.nextDueMs).toBeCloseTo(1200);
    expect(after.expectedFoot).toBe('right');
    expect(after.lastOffsetMs).toBe(0);
  });

  it('still rewards a step that is a little late', () => {
    const perfect = stepAt(startRun(createGame()), 600, 'left');
    const before = advanceTo(perfect, 1300); // 100 ms after it was due
    const after = step(before, 'right');
    expect(after.lastEvent?.kind).toBe('good');
    expect(after.speed).toBeCloseTo(before.speed + DEFAULT_CONFIG.speed.goodBoost);
    expect(after.combo).toBe(2);
    expect(after.counts.good).toBe(1);
    expect(after.nextDueMs).toBeCloseTo(1900);
  });

  it('punishes a step that comes too early', () => {
    let state = stepAt(startRun(createGame()), 600, 'left');
    state = stepAt(state, 1300, 'right');
    state = stepAt(state, 1900, 'left');
    const before = advanceTo(state, 2100); // the step was not due until 2500
    const after = step(before, 'right');
    expect(after.lastEvent?.kind).toBe('tooFast');
    expect(after.speed).toBeCloseTo(before.speed - DEFAULT_CONFIG.speed.missPenalty);
    expect(after.energy).toBe(before.energy - DEFAULT_CONFIG.energy.missLoss);
    expect(after.combo).toBe(0);
    expect(after.counts.miss).toBe(1);
  });

  it('punishes the wrong foot', () => {
    const after = stepAt(startRun(createGame()), 600, 'right');
    expect(after.lastEvent?.kind).toBe('wrongFoot');
    expect(after.counts.miss).toBe(1);
    expect(after.combo).toBe(0);
  });

  it('accepts either foot when alternating is switched off', () => {
    const config: GameConfig = { ...DEFAULT_CONFIG, requireAlternatingFeet: false };
    const after = stepAt(startRun(createGame(config)), 600, 'right');
    expect(after.lastEvent?.kind).toBe('perfect');
    expect(after.counts.perfect).toBe(1);
  });

  it('costs the energy the ground and the weather ask for', () => {
    const water = withCourse([{ terrain: 'water', weather: 'clear', lengthMeters: 1000 }]);
    const onWater = stepAt(startRun(createGame(water)), 700, 'left');
    expect(onWater.lastEvent?.kind).toBe('good');
    expect(onWater.energy).toBe(DEFAULT_CONFIG.energy.start - 2);

    const rain = withCourse([{ terrain: 'flat', weather: 'rain', lengthMeters: 1000 }]);
    const inRain = stepAt(startRun(createGame(rain)), 700, 'left');
    expect(inRain.lastEvent?.kind).toBe('good');
    expect(inRain.energy).toBe(DEFAULT_CONFIG.energy.start - 1);
  });
});

describe('tick', () => {
  it('counts a step that never came and passes the beat to the other foot', () => {
    const at800 = advanceTo(startRun(createGame()), 800);
    expect(at800.counts.skipped).toBe(1);
    expect(at800.combo).toBe(0);
    expect(at800.expectedFoot).toBe('right');
    expect(at800.nextDueMs).toBeCloseTo(1200);

    const at1400 = advanceTo(at800, 1400);
    expect(at1400.counts.skipped).toBe(2);
    expect(at1400.expectedFoot).toBe('left');
    expect(at1400.nextDueMs).toBeCloseTo(1800);
  });

  it('drains speed faster in a headwind', () => {
    const wind = withCourse([{ terrain: 'flat', weather: 'wind', lengthMeters: 1000 }]);
    const windy = advanceTo(startRun(createGame(wind)), 1000);
    expect(DEFAULT_CONFIG.speed.start - windy.speed).toBeCloseTo(1.2);

    const calm = advanceTo(startRun(createGame()), 1000);
    expect(DEFAULT_CONFIG.speed.start - calm.speed).toBeCloseTo(
      DEFAULT_CONFIG.speed.decayPerSecond
    );
  });

  it('adds distance and score from speed', () => {
    const config: GameConfig = {
      ...DEFAULT_CONFIG,
      speed: { ...DEFAULT_CONFIG.speed, start: 10, decayPerSecond: 0 },
    };
    const state = advanceTo(startRun(createGame(config)), 1000);
    expect(state.distance).toBeCloseTo(10);
    expect(state.score).toBeCloseTo(10); // combo 0, so the multiplier is 1
  });

  it('stops the run after the last second', () => {
    const finished = advanceTo(startRun(createGame()), 60000);
    expect(finished.phase).toBe('finished');
    expect(finished.timeMs).toBe(60000);
    expect(tick(finished, 10)).toBe(finished);
    expect(step(finished, 'left')).toBe(finished);
  });
});

describe('the pace follows the road', () => {
  it('asks for slower steps uphill', () => {
    const uphill = withCourse([{ terrain: 'uphill', weather: 'clear', lengthMeters: 1000 }]);
    const after = stepAt(startRun(createGame(uphill)), 600, 'left');
    expect(after.nextDueMs).toBeCloseTo(600 + 780);
  });

  it('changes the pace as soon as the runner enters the water', () => {
    const config = withCourse(
      [
        { terrain: 'flat', weather: 'clear', lengthMeters: 10 },
        { terrain: 'water', weather: 'clear', lengthMeters: 100 },
      ],
      { speed: { ...DEFAULT_CONFIG.speed, start: 20, decayPerSecond: 0 } }
    );
    const crossed = advanceTo(startRun(createGame(config)), 600); // 12 metres: past the boundary
    expect(crossed.segmentIndex).toBe(1);
    expect(crossed.lastEvent?.kind).toBe('segment');

    const after = step(crossed, 'left');
    expect(after.nextDueMs).toBeCloseTo(600 + 900);
  });
});

describe('limits', () => {
  it('never lets the runner go faster than the maximum', () => {
    let state = startRun(createGame());
    for (let i = 0; i < 30; i += 1) {
      state = stepAt(state, state.nextDueMs, state.expectedFoot);
    }
    expect(state.speed).toBeLessThanOrEqual(DEFAULT_CONFIG.speed.max);
    expect(state.speed).toBeCloseTo(DEFAULT_CONFIG.speed.max);
  });
});

describe('stumbling', () => {
  // The same foot over and over: the first step is fine, every one after it is
  // the wrong foot, and ten misses empty the energy bar.
  function untilOutOfEnergy(): GameState {
    let state = stepAt(startRun(createGame()), 600, 'left');
    for (let dueMs = 1200; dueMs <= 6600; dueMs += 600) {
      state = stepAt(state, dueMs, 'left');
    }
    return state;
  }

  it('trips the runner when the energy runs out', () => {
    const state = untilOutOfEnergy();
    expect(state.energy).toBe(0);
    expect(state.stumbleUntilMs).toBe(7200);
    expect(state.speed).toBe(DEFAULT_CONFIG.speed.stumbleSpeed);
    expect(state.lastEvent?.kind).toBe('stumble');
  });

  it('ignores steps and counts nothing as skipped while the runner is down', () => {
    const down = advanceTo(untilOutOfEnergy(), 7000);
    expect(step(down, 'right')).toBe(down);
    expect(down.counts.skipped).toBe(0);
    expect(down.speed).toBe(DEFAULT_CONFIG.speed.stumbleSpeed);
  });

  it('gets the runner up with fresh energy and a fresh due time', () => {
    const up = advanceTo(untilOutOfEnergy(), 7200);
    expect(up.stumbleUntilMs).toBeNull();
    expect(up.energy).toBe(DEFAULT_CONFIG.energy.stumbleRecoverTo);
    expect(up.nextDueMs).toBeCloseTo(7800);
  });
});

describe('summarize', () => {
  it('rounds the numbers and names the course and the platform', () => {
    const state: GameState = {
      ...startRun(createGame()),
      score: 123.7,
      distance: 45.4,
      bestCombo: 7,
      counts: { perfect: 50, good: 20, miss: 20, skipped: 10 },
    };
    const summary = summarize(state);
    expect(summary.score).toBe(124);
    expect(summary.distance).toBe(45);
    expect(summary.bestCombo).toBe(7);
    expect(summary.accuracy).toBeCloseTo(0.7);
    expect(summary.counts.perfect).toBe(50);
    expect(summary.runSeconds).toBe(60);
    expect(summary.course).toBe('level-1');
    expect(summary.platform).toBe('pc');
  });

  it('remembers that a phone run was a phone run', () => {
    expect(summarize(createGame(MOBILE_CONFIG)).platform).toBe('mobile');
  });
});
