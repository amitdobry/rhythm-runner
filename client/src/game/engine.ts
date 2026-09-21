// The whole game, with no screen and no clock of its own.
// tick() lets time pass, step() is the player pressing a foot.
// Both take a state and give back a new one; they never change the old one.

import { DEFAULT_CONFIG } from './config';
import type { Foot, GameConfig, Platform } from './config';
import { segmentAt } from './course';
import { judgeOffset, oppositeFoot, targetIntervalMs } from './pace';
import { accuracy, comboMultiplier } from './scoring';

export type Phase = 'ready' | 'running' | 'finished';

export type GameEvent =
  'perfect' | 'good' | 'tooFast' | 'tooSlow' | 'wrongFoot' | 'skipped' | 'stumble' | 'segment';

export interface GameState {
  config: GameConfig;
  phase: Phase;
  timeMs: number; // milliseconds since the run started
  speed: number; // metres per second
  energy: number;
  combo: number;
  bestCombo: number;
  distance: number; // metres
  score: number;
  counts: { perfect: number; good: number; miss: number; skipped: number };
  nextDueMs: number; // when the next step should land
  expectedFoot: Foot; // which foot should land next; 'left' at the start
  lastOffsetMs: number | null; // signed error of the last step, for the pace meter (negative = early)
  segmentIndex: number; // current segment, so a change can be announced
  stumbleUntilMs: number | null; // null = not stumbling
  lastEvent: { kind: GameEvent; atMs: number } | null; // for the renderer to flash
}

export interface RunSummary {
  score: number; // rounded to integer
  distance: number; // rounded to integer metres
  bestCombo: number;
  accuracy: number; // 0..1
  counts: GameState['counts'];
  runSeconds: number;
  platform: Platform;
  course: string; // 'level-1'
}

/** A game that has not started yet. */
export function createGame(config: GameConfig = DEFAULT_CONFIG): GameState {
  return {
    config,
    phase: 'ready',
    timeMs: 0,
    speed: config.speed.start,
    energy: config.energy.start,
    combo: 0,
    bestCombo: 0,
    distance: 0,
    score: 0,
    counts: { perfect: 0, good: 0, miss: 0, skipped: 0 },
    nextDueMs: config.baseStepIntervalMs,
    expectedFoot: 'left',
    lastOffsetMs: null,
    segmentIndex: 0,
    stumbleUntilMs: null,
    lastEvent: null,
  };
}

/** Start running. The first step is due one base interval from now, left foot. */
export function startRun(state: GameState): GameState {
  return {
    ...createGame(state.config),
    phase: 'running',
    timeMs: 0,
    nextDueMs: state.config.baseStepIntervalMs,
    expectedFoot: 'left',
  };
}

/** The pace asked for by the ground the runner is on right now. */
export function currentTargetIntervalMs(state: GameState): number {
  return intervalAtDistance(state.distance, state.config);
}

/** Time passes: the runner slows down, moves forward, and may miss a step. */
export function tick(state: GameState, deltaMs: number): GameState {
  if (state.phase !== 'running') return state;

  const config = state.config;
  const endMs = config.runSeconds * 1000;
  const time = Math.min(state.timeMs + deltaMs, endMs);

  let speed = state.speed;
  let energy = state.energy;
  let combo = state.combo;
  let distance = state.distance;
  let score = state.score;
  const counts = { ...state.counts };
  let nextDueMs = state.nextDueMs;
  let expectedFoot = state.expectedFoot;
  let segmentIndex = state.segmentIndex;
  let stumbleUntilMs = state.stumbleUntilMs;
  let lastEvent = state.lastEvent;

  // Getting up after a stumble: fresh energy and a fresh due time.
  if (stumbleUntilMs !== null && time >= stumbleUntilMs) {
    energy = config.energy.stumbleRecoverTo;
    stumbleUntilMs = null;
    nextDueMs = time + intervalAtDistance(distance, config);
  }

  // Speed drains away on its own. A headwind drains it faster.
  if (stumbleUntilMs !== null) {
    speed = config.speed.stumbleSpeed;
  } else {
    const weather = config.weather[segmentAt(state.distance, config.course).segment.weather];
    const lost = (config.speed.decayPerSecond * weather.decayFactor * deltaMs) / 1000;
    speed = Math.max(0, speed - lost);
  }

  // Distance is speed added up; score grows faster with a long combo.
  const movedMeters = (speed * deltaMs) / 1000;
  distance += movedMeters;
  score += movedMeters * comboMultiplier(combo, config);

  // Crossing into a new stretch of road is announced.
  const here = segmentAt(distance, config.course);
  if (here.index !== segmentIndex) {
    segmentIndex = here.index;
    lastEvent = { kind: 'segment', atMs: time };
  }

  // A step that never came. The beat passes to the other foot.
  if (stumbleUntilMs === null) {
    while (time > nextDueMs + config.goodWindowMs) {
      combo = 0;
      counts.skipped += 1;
      lastEvent = { kind: 'skipped', atMs: time };
      expectedFoot = oppositeFoot(expectedFoot);
      nextDueMs += intervalAtDistance(distance, config);
    }
  }

  const phase: Phase = time >= endMs ? 'finished' : state.phase;

  return {
    ...state,
    phase,
    timeMs: time,
    speed,
    energy,
    combo,
    distance,
    score,
    counts,
    nextDueMs,
    expectedFoot,
    segmentIndex,
    stumbleUntilMs,
    lastEvent,
  };
}

/** The player put a foot down. */
export function step(state: GameState, foot: Foot): GameState {
  if (state.phase !== 'running' || state.stumbleUntilMs !== null) return state;

  const config = state.config;
  const offset = state.timeMs - state.nextDueMs; // negative = early
  let result = judgeOffset(offset, config);
  let eventKind: GameEvent = result === 'miss' ? (offset < 0 ? 'tooFast' : 'tooSlow') : result;

  // The wrong foot costs the same as any miss; only the message differs.
  if (result !== 'miss' && config.requireAlternatingFeet && foot !== state.expectedFoot) {
    result = 'miss';
    eventKind = 'wrongFoot';
  }

  // Every step costs what the ground and the weather ask for.
  const segment = segmentAt(state.distance, config.course).segment;
  const stepCost =
    config.terrain[segment.terrain].energyPerStep + config.weather[segment.weather].energyPerStep;

  let speed = state.speed;
  let energy = state.energy - stepCost;
  let combo = state.combo;
  const counts = { ...state.counts };

  if (result === 'perfect') {
    speed += config.speed.perfectBoost;
    energy += config.energy.perfectGain;
    combo += 1;
    counts.perfect += 1;
  } else if (result === 'good') {
    speed += config.speed.goodBoost;
    combo += 1;
    counts.good += 1;
  } else {
    speed -= config.speed.missPenalty;
    energy -= config.energy.missLoss;
    combo = 0;
    counts.miss += 1;
  }

  speed = clamp(speed, 0, config.speed.max);
  energy = clamp(energy, 0, config.energy.max);
  const bestCombo = Math.max(state.bestCombo, combo);
  let lastEvent: GameState['lastEvent'] = { kind: eventKind, atMs: state.timeMs };

  // The next step is due one pace interval after this one, on the other foot.
  const interval = currentTargetIntervalMs(state);
  const nextDueMs = state.timeMs + interval;
  const expectedFoot = oppositeFoot(foot);

  // Out of energy: the runner trips and loses a moment.
  let stumbleUntilMs: number | null = state.stumbleUntilMs;
  if (energy <= 0) {
    energy = 0;
    stumbleUntilMs = state.timeMs + config.energy.stumbleSteps * interval;
    speed = config.speed.stumbleSpeed;
    lastEvent = { kind: 'stumble', atMs: state.timeMs };
  }

  return {
    ...state,
    speed,
    energy,
    combo,
    bestCombo,
    counts,
    nextDueMs,
    expectedFoot,
    lastOffsetMs: offset,
    stumbleUntilMs,
    lastEvent,
  };
}

/** What the player sees at the end, and what the server stores. */
export function summarize(state: GameState): RunSummary {
  return {
    score: Math.round(state.score),
    distance: Math.round(state.distance),
    bestCombo: state.bestCombo,
    accuracy: accuracy(state.counts),
    counts: { ...state.counts },
    runSeconds: state.config.runSeconds,
    platform: state.config.platform,
    course: 'level-1',
  };
}

function intervalAtDistance(distanceMeters: number, config: GameConfig): number {
  return targetIntervalMs(segmentAt(distanceMeters, config.course).segment, config);
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
