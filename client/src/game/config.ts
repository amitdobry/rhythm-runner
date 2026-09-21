// Every number a child may want to change lives here.
// Change one, reload the page, see what the game feels like.

/** Where the game is played. Touch is slower and less precise than a key press. */
export type Platform = 'pc' | 'mobile';

/** The runner has two feet. Steps must alternate. */
export type Foot = 'left' | 'right';

export type Terrain = 'flat' | 'uphill' | 'downhill' | 'water';
export type Weather = 'clear' | 'rain' | 'wind';

export interface TerrainRule {
  paceFactor: number; // multiplies the base step interval: > 1 = slower steps
  energyPerStep: number; // energy every step costs on this ground
  label: string; // shown when the segment starts, e.g. "Uphill! Slow, strong steps"
}

export interface WeatherRule {
  paceFactor: number; // multiplies the step interval too
  decayFactor: number; // multiplies speed decay: headwind = 1.5
  energyPerStep: number; // rain is slippery: careful steps cost a little
  label: string;
}

export interface Segment {
  terrain: Terrain;
  weather: Weather;
  lengthMeters: number;
}

export interface GameConfig {
  platform: Platform;
  runSeconds: number; // how long one run lasts
  baseStepIntervalMs: number; // the pace on flat ground in clear weather (600 = 100 steps per minute)
  perfectWindowMs: number; // a step this close to the due moment is Perfect
  goodWindowMs: number; // a step this close is Good (must be > perfect)
  requireAlternatingFeet: boolean; // true: pressing the wrong foot is a Miss
  paceGuideClick: boolean; // true: play a click when the next step is due
  terrain: Record<Terrain, TerrainRule>;
  weather: Record<Weather, WeatherRule>;
  course: Segment[]; // level 1, in order; repeats if the runner reaches the end
  speed: {
    start: number; // metres per second at the start of a run
    max: number; // the runner can never go faster than this
    perfectBoost: number; // added on a Perfect step
    goodBoost: number; // added on a Good step
    missPenalty: number; // taken away on a Miss
    decayPerSecond: number; // lost every second when nothing happens
    stumbleSpeed: number; // speed while stumbling
  };
  energy: {
    start: number;
    max: number;
    perfectGain: number; // gained on a Perfect step
    missLoss: number; // lost on a Miss
    stumbleRecoverTo: number; // energy after a stumble ends
    stumbleSteps: number; // how many step intervals a stumble lasts
  };
  // Sorted by fromCombo ascending. The multiplier of the last entry whose
  // fromCombo <= combo applies.
  comboMultipliers: { fromCombo: number; multiplier: number }[];
}

export const TERRAIN: Record<Terrain, TerrainRule> = {
  flat: { paceFactor: 1.0, energyPerStep: 0, label: 'Flat road. Steady!' },
  uphill: { paceFactor: 1.3, energyPerStep: 1, label: 'Uphill! Slow, strong steps' },
  downhill: { paceFactor: 0.8, energyPerStep: 0, label: 'Downhill! Quick feet' },
  water: { paceFactor: 1.5, energyPerStep: 2, label: 'Water! Big slow steps' },
};

export const WEATHER: Record<Weather, WeatherRule> = {
  clear: { paceFactor: 1.0, decayFactor: 1.0, energyPerStep: 0, label: '' },
  rain: { paceFactor: 1.15, decayFactor: 1.0, energyPerStep: 1, label: 'Rain. Careful steps' },
  wind: { paceFactor: 1.1, decayFactor: 1.5, energyPerStep: 0, label: 'Headwind. Keep pushing' },
};

/** Level 1. About 410 metres; a good run loops it once. */
export const LEVEL_1: Segment[] = [
  { terrain: 'flat', weather: 'clear', lengthMeters: 60 },
  { terrain: 'uphill', weather: 'clear', lengthMeters: 40 },
  { terrain: 'downhill', weather: 'clear', lengthMeters: 40 },
  { terrain: 'flat', weather: 'rain', lengthMeters: 50 },
  { terrain: 'water', weather: 'clear', lengthMeters: 30 },
  { terrain: 'flat', weather: 'wind', lengthMeters: 50 },
  { terrain: 'uphill', weather: 'rain', lengthMeters: 40 },
  { terrain: 'downhill', weather: 'wind', lengthMeters: 40 },
  { terrain: 'flat', weather: 'clear', lengthMeters: 60 },
];

/** Keyboard and mouse. Tight windows. */
export const PC_CONFIG: GameConfig = {
  platform: 'pc',
  runSeconds: 60,
  baseStepIntervalMs: 600,
  perfectWindowMs: 60,
  goodWindowMs: 120,
  requireAlternatingFeet: true,
  paceGuideClick: true,
  terrain: TERRAIN,
  weather: WEATHER,
  course: LEVEL_1,
  speed: {
    start: 4,
    max: 20,
    perfectBoost: 2,
    goodBoost: 1,
    missPenalty: 3,
    decayPerSecond: 0.8,
    stumbleSpeed: 1,
  },
  energy: {
    start: 100,
    max: 100,
    perfectGain: 3,
    missLoss: 10,
    stumbleRecoverTo: 30,
    stumbleSteps: 1,
  },
  comboMultipliers: [
    { fromCombo: 0, multiplier: 1 },
    { fromCombo: 10, multiplier: 2 },
    { fromCombo: 20, multiplier: 3 },
  ],
};

/** Thumbs on a phone: touch arrives later and less precisely, so the windows are wider. */
export const MOBILE_CONFIG: GameConfig = {
  ...PC_CONFIG,
  platform: 'mobile',
  perfectWindowMs: 80,
  goodWindowMs: 160,
};

export const DEFAULT_CONFIG = PC_CONFIG; // tests use this

/** PC and phone play the same game; only the timing windows differ. */
export function configForPlatform(platform: Platform): GameConfig {
  return platform === 'mobile' ? MOBILE_CONFIG : PC_CONFIG;
}
