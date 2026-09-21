# Phase 1 - Build Spec

This is the step-by-step specification for building Phase 1. It is written for
the Claude Code session that implements it. `docs/PHASE-1.md` says what and
why, `docs/GAME-DESIGN.md` explains the game in plain words; this file says
exactly how. When they disagree, this file wins.

Work one milestone at a time. At the end of each milestone: run
`npm run format`, `npm run typecheck`, `npm test`, verify the "Done when",
commit, push, report. Then stop.

M1 (hosting) is done. Start at M2.

---

## The game in one paragraph (so the code makes sense)

The runner has two feet. The player steps left, right, left, right. The course
is made of segments, each with a terrain (flat, uphill, downhill, water) and a
weather (clear, rain, wind). Every combination sets a **target pace**: the
time that should pass between one step and the next. The player must keep as
close to that pace as possible; when the terrain or weather changes, the pace
changes and the player must adapt. Steps at the right pace add speed and
combo; steps too fast, too slow, or with the wrong foot cost speed and energy.
Distance is speed added up over 60 seconds. A pulsing footprint (and an
optional click) shows when the next step is due, so a child can play it.

---

## Ground rules for every milestone

- Pure game logic lives in `client/src/game/` and imports nothing from React or
  the DOM. It never reads the clock; time is passed in as a number.
- Every tunable number lives in `client/src/game/config.ts`, with a one-line
  comment saying what it does in plain words.
- Functions take the state and return a **new** state. Do not mutate the input.
- Names are for children who read English as a second language: `speed`,
  `energy`, `combo`, `step`, `tick`, `pace`. No abbreviations.
- New dependencies allowed in Phase 1: `vitest` (client dev). Nothing else.

---

## M2. The engine, with tests

### Files to create

```text
client/src/game/config.ts
client/src/game/course.ts
client/src/game/pace.ts
client/src/game/scoring.ts
client/src/game/engine.ts
client/src/game/course.test.ts
client/src/game/pace.test.ts
client/src/game/scoring.test.ts
client/src/game/engine.test.ts
```

### Package changes

- `client/package.json`: add devDependency `vitest` (`^3.0.0`, same major as
  the server) and script `"test": "vitest run"`.
- Root `package.json`: `"test": "npm --prefix server run test && npm --prefix client run test"`.
- No vitest config file is needed; vitest reads `client/vite.config.ts`. Tests
  run in Node. Do not add jsdom.

### `config.ts`

```ts
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

export function configForPlatform(platform: Platform): GameConfig; // PC_CONFIG or MOBILE_CONFIG
```

PC and mobile are scored on separate leaderboards (M4) because the windows
differ. Everything else about the game is identical on both.

### `course.ts`

```ts
export interface SegmentPosition {
  index: number; // index into config.course
  segment: Segment;
  startMeters: number; // where this segment starts, in course-loop metres
  metersIntoSegment: number; // 0 for segments not reached yet
  aheadMeters: number; // metres from the runner to this segment's start; negative for the one under foot
}

export function courseLengthMeters(course: Segment[]): number; // sum of lengths
export function segmentAt(distanceMeters: number, course: Segment[]): SegmentPosition;
// distance wraps: segmentAt(courseLength + 5) === the first segment, 5 m in.
export function upcomingSegments(
  distanceMeters: number,
  course: Segment[],
  lookAheadMeters: number
): SegmentPosition[];
// the current segment and every segment that starts within lookAhead metres (for the renderer)
```

### `pace.ts`

```ts
export function targetIntervalMs(segment: Segment, config: GameConfig): number;
// baseStepIntervalMs * terrain.paceFactor * weather.paceFactor, e.g. uphill+rain = 600*1.3*1.15 = 897

export type Judgement = 'perfect' | 'good' | 'miss';

/** |offset| <= perfect -> 'perfect'; <= good -> 'good'; else 'miss'. */
export function judgeOffset(offsetMs: number, config: GameConfig): Judgement;

export function oppositeFoot(foot: Foot): Foot;
```

### `scoring.ts`

```ts
/** The multiplier for a combo, from config.comboMultipliers. */
export function comboMultiplier(combo: number, config: GameConfig): number;

/** hits / (hits + misses + skipped), between 0 and 1. All zero -> 0. */
export function accuracy(counts: {
  perfect: number;
  good: number;
  miss: number;
  skipped: number;
}): number;
```

### `engine.ts`

```ts
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
  segmentChangedAtMs: number | null; // when the current segment began; the banner reads this, not lastEvent
  stumbleUntilMs: number | null; // null = not stumbling
  lastEvent: { kind: GameEvent; atMs: number } | null; // for the renderer to flash
}

export function createGame(config?: GameConfig): GameState; // phase 'ready', speed/energy from config
export function startRun(state: GameState): GameState; // a fresh createGame(config) with phase 'running'; the first step is due one base interval in, left foot
export function tick(state: GameState, deltaMs: number): GameState; // time passes
export function step(state: GameState, foot: Foot): GameState; // the player pressed a foot
export function currentTargetIntervalMs(state: GameState): number; // pace of the segment at state.distance
export function summarize(state: GameState): RunSummary;

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
```

**`tick(state, deltaMs)` rules, in this order:**

1. If `phase !== 'running'`, return `state` unchanged.
2. `time = min(state.timeMs + deltaMs, runSeconds * 1000)` and
   `elapsed = time - state.timeMs`. Rules 4 and 5 use `elapsed`, never the raw
   `deltaMs`, so the final clamped tick does not overshoot.
3. Stumble: if `stumbleUntilMs !== null` and `time >= stumbleUntilMs`, set
   `energy = stumbleRecoverTo`, `stumbleUntilMs = null`, and
   `nextDueMs = time + currentTargetIntervalMs` (a fresh start after getting up).
4. Speed: while stumbling `speed = stumbleSpeed`; otherwise
   `speed = max(0, speed - decayPerSecond * weather.decayFactor * deltaMs / 1000)`
   where `weather` is the weather of the segment at `state.distance`.
5. Distance and score: `distance += speed * deltaMs / 1000`;
   `score += speed * deltaMs / 1000 * comboMultiplier(combo)`.
6. Segment change: if `segmentAt(distance).index !== segmentIndex`, set
   `segmentIndex`, `segmentChangedAtMs = time` and
   `lastEvent = { kind: 'segment', atMs: time }`. The pace
   for steps changes from this moment; `nextDueMs` is **not** moved (the step
   already in flight keeps its due time).
7. Skipped steps (not while stumbling): while `time > nextDueMs + goodWindowMs`:
   `combo = 0`, `counts.skipped += 1`, `lastEvent = { kind: 'skipped', atMs: time }`,
   `expectedFoot = oppositeFoot(expectedFoot)`,
   `nextDueMs += currentTargetIntervalMs`.
8. If `time >= runSeconds * 1000`: `phase = 'finished'`.
9. `timeMs = time`.

**`step(state, foot)` rules, in this order:**

1. If `phase !== 'running'` or stumbling (`stumbleUntilMs !== null`), return
   `state` unchanged.
2. `offset = timeMs - nextDueMs` (negative = early). `result = judgeOffset(offset)`.
   `eventKind = result`; if `result === 'miss'`, `eventKind = offset < 0 ? 'tooFast' : 'tooSlow'`.
3. If `result !== 'miss'` and `config.requireAlternatingFeet` and
   `foot !== expectedFoot`: `result = 'miss'`, `eventKind = 'wrongFoot'`.
   A wrong foot costs the same as any miss; only the message differs.
4. Every step costs ground and weather energy:
   `energy -= terrain.energyPerStep + weather.energyPerStep` of the current segment.
5. Apply the result:
   - `perfect`: `speed += perfectBoost`, `energy += perfectGain`, `combo += 1`, `counts.perfect += 1`.
   - `good`: `speed += goodBoost`, `combo += 1`, `counts.good += 1`.
   - `miss`: `speed -= missPenalty`, `energy -= missLoss`, `combo = 0`, `counts.miss += 1`.
6. Clamp `speed` to `[0, speed.max]` and `energy` to `[0, energy.max]`.
   `bestCombo = max(bestCombo, combo)`. `lastOffsetMs = offset`.
   `lastEvent = { kind: eventKind, atMs: timeMs }`.
7. Schedule the next step: `nextDueMs = timeMs + currentTargetIntervalMs`
   (the pace of the segment at the current distance);
   `expectedFoot = oppositeFoot(foot)` (alternate from the foot actually used).
8. Stumble check: if `energy <= 0`: `energy = 0`,
   `stumbleUntilMs = timeMs + stumbleSteps * currentTargetIntervalMs`,
   `speed = stumbleSpeed`, `lastEvent = { kind: 'stumble', atMs: timeMs }`.

Why judge against the player's own last step rather than a fixed metronome:
the rhythm belongs to the player, the **pace** belongs to the terrain. A player
who finds the pace by feel and one who follows the guide score the same.

### Tests (write these, all must pass)

`course.test.ts`

- `courseLengthMeters(LEVEL_1)` is 410.
- `segmentAt(0)` is index 0 with 0 m in; `segmentAt(59.9)` index 0; `segmentAt(60)` index 1.
- `segmentAt(415)` wraps to index 0, 5 m in.
- `upcomingSegments(50, LEVEL_1, 60)` returns segments 0, 1 and 2 (2 starts at 100).

`pace.test.ts`

- flat clear -> 600; uphill clear -> 780; downhill clear -> 480; water clear -> 900;
  uphill rain -> 897 (use `toBeCloseTo`).
- judgeOffset: 0 and 60 -> perfect; 61 and 120 -> good; 121 -> miss; -60 -> perfect
  and -121 -> miss (symmetric). With `MOBILE_CONFIG`: 70 -> perfect, 150 -> good.
- oppositeFoot flips.

`scoring.test.ts`

- comboMultiplier: 0 -> 1, 9 -> 1, 10 -> 2, 19 -> 2, 20 -> 3, 99 -> 3.
- accuracy({50, 20, 20, 10}) is 0.7; all zeros -> 0.

`engine.test.ts` (use a helper `advanceTo(state, timeMs)` that ticks in 10 ms
steps so decay and skipped steps behave like the real loop; and a helper
`stepAt(state, timeMs, foot)` = advanceTo then step)

- createGame is `ready` with start speed and energy; a step while ready is ignored.
- startRun is `running` at time 0 with `nextDueMs` 600 and `expectedFoot` left.
- perfect: left at 600 ms -> speed +2, energy +3 (capped at max), combo 1,
  counts.perfect 1, `nextDueMs` 1200, `expectedFoot` right, `lastOffsetMs` 0.
- good: then right at 1300 ms (100 late) -> speed +1, combo 2, `nextDueMs` 1900.
- too fast: left at 1900 + 0, then right at 2100 (400 early for a 2500 due) ->
  miss, `lastEvent.kind` `tooFast`, speed -3, energy -10, combo 0.
- wrong foot: right at 600 -> miss, `wrongFoot`; with
  `requireAlternatingFeet: false` the same press is perfect.
- skipped: no step until 800 ms (600 + 120 + a bit) -> counts.skipped 1, combo 0,
  `expectedFoot` right, `nextDueMs` 1200. Until 1400 -> skipped 2, left, 1800.
- pace follows terrain: with a custom course `[{uphill, clear, 1000 m}]`, a
  perfect step schedules `nextDueMs` 780 later. With `[{flat, clear, 10}, {water, clear, 100}]`
  and speed set so the runner passes 10 m, the first step after the boundary
  schedules 900 later and `lastEvent.kind` was `segment` at the crossing.
- step energy cost: on water, a good step costs 2 energy; in rain on flat it costs 1.
- wind decay: with `flat wind` and no steps, speed after one second has dropped
  by about 1.2 (0.8 x 1.5) instead of 0.8.
- stumble: misses until energy is 0 -> stumbling, speed equals stumbleSpeed, a
  step during the stumble is ignored, no skipped steps are counted while
  stumbling, after the stumble ends energy is stumbleRecoverTo and `nextDueMs`
  is one interval after the recovery.
- speed never exceeds max after many perfects; decay lowers speed over one
  second of flat clear ticks by about decayPerSecond.
- with speed 10 held for one second (custom config, decay 0), distance is 10
  and score is 10 x multiplier.
- run ends: after advancing to 60 000 ms phase is `finished`, timeMs is exactly
  60 000, further ticks and steps change nothing.
- summarize returns rounded integers, `accuracy` from counts, `course` 'level-1',
  `platform` from config.

### Done when

`npm test` runs server (9) and client tests and all pass; `npm run typecheck`
is clean; no file outside `client/src/game/`, the two `package.json` files and
the lockfile changed.

---

## M2 outcome (reviewed 2026-09-21)

Done in commit `f8892b7`: 42 client tests, 9 server tests, typecheck clean.
Interpretations made by the implementer and accepted, now part of the spec:

- `startRun` returns a fresh `createGame(config)` in phase `running`, so
  "Run again" needs no extra reset.
- `createGame` sets `nextDueMs` to `baseStepIntervalMs` before the run starts.
- `upcomingSegments` reports `metersIntoSegment: 0` for segments not reached.
- The "too fast" test steps at 2100 ms; the parenthetical above was corrected.

Three gaps found in the review, to be fixed as **M3 step 0** (below) before
any rendering work.

## M3. It is a game

### Step 0 - three small engine fixes from the M2 review

Each with a test in the matching `*.test.ts`. Behaviour otherwise unchanged;
all 42 existing tests must still pass.

1. `tick`: compute `elapsed = time - state.timeMs` after clamping and use it
   for decay and movement instead of `deltaMs` (tick rule 2). Test: at
   59 995 ms a tick of 100 ms moves the runner `speed * 0.005` metres, not
   `speed * 0.1`.
2. `GameState.segmentChangedAtMs`: new field, `null` in `createGame`, set to
   `time` in tick rule 6 alongside `lastEvent`. Test: after crossing a boundary
   and then stepping, `lastEvent.kind` is the step result but
   `segmentChangedAtMs` still holds the crossing time.
3. `SegmentPosition.aheadMeters`: new field. For the current segment it is
   `-metersIntoSegment`; for each following segment it is the running sum of
   lengths from the runner to that segment's start, **continuing past the loop
   end** (so after wrapping it keeps growing instead of resetting with
   `startMeters`). Test: at 400 m on LEVEL_1 with look-ahead 100, the returned
   segments are index 8 (`aheadMeters` -50), index 0 (10) and index 1 (70).

### Two ways to play

|             | PC                                                                                             | Mobile                                                              |
| ----------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Detected by | default                                                                                        | `matchMedia('(pointer: coarse)')` or `navigator.maxTouchPoints > 0` |
| Config      | `PC_CONFIG`                                                                                    | `MOBILE_CONFIG` (wider windows)                                     |
| Layout      | landscape canvas, 16:9, up to 960 px wide                                                      | portrait: canvas on top (about 60% of the height), two pads below   |
| Left foot   | `ArrowLeft` or `F`; mouse click on the left half                                               | big left pad                                                        |
| Right foot  | `ArrowRight` or `J`; mouse click on the right half                                             | big right pad                                                       |
| Override    | `?platform=mobile` / `?platform=pc` on `/play`, remembered in `localStorage` key `rr_platform` | same                                                                |

The pads are real `<button>` elements under the canvas, not drawn on it: they
need to be large (at least 45% of the width, 25% of the height each), react to
`pointerdown` (not `click`, which arrives 300 ms late on some phones), and
flash on press. Both pads and the canvas set `touch-action: none`.

### Files

```text
client/src/game/platform.ts    detectPlatform(), readOverride(), rememberPlatform()
client/src/game/audio.ts       Web Audio click
client/src/game/render.ts      draws a GameState on a canvas
client/src/game/useGameLoop.ts React hook: owns the loop and input
client/src/pages/PlayPage.tsx  the screen, both layouts
client/src/App.tsx             add route /play (protected like /)
client/src/pages/HomePage.tsx  add a "Play" button linking to /play
client/src/styles.css          canvas layout, pads, HUD, overlay
```

### `audio.ts`

```ts
export interface Metronome {
  unlock(): void; // call on the first user gesture; creates the AudioContext
  click(kind: 'due' | 'perfect' | 'good' | 'miss'): void; // short tones, different pitches
  dispose(): void;
}
export function createMetronome(): Metronome;
```

Use an `OscillatorNode` with a 40 ms gain envelope, no audio files. If
`AudioContext` is missing, return a no-op metronome. Never throw.

### `render.ts`

```ts
export interface RenderOptions {
  width: number;
  height: number;
}
export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  options: RenderOptions
): void;
```

Draws, back to front, with plain shapes and colours (no images). All scroll
offsets derive from `state.distance`, never from wall-clock time.

1. Sky gradient, tinted by the current weather (grey for rain, pale for wind);
   a skyline of rectangles scrolling at 0.2 x the road.
2. Pavement band with lamp posts scrolling at 0.6 x the road.
3. The road, built from `upcomingSegments(distance, course, lookAhead)` where
   `lookAhead` is about 2.5 screen widths in metres (`metersPerPixel` is a
   constant). Each segment is drawn as its own band: flat = level, uphill =
   rising towards the right, downhill = falling, water = blue band with
   ripples. Segment edges are visible so the player can read the road ahead.
   Lane dashes scroll at 1.0 x.
4. Weather on top of the scene: rain = diagonal streaks, wind = horizontal
   streaks moving left. Clear = nothing.
5. Runner at x = width / 3, a rounded body and two legs. The leg of
   `expectedFoot` is forward and highlighted. Stumbling: tilted 20 degrees,
   red tint.
6. Two footprints on the road under the runner, left and right. The footprint
   of `expectedFoot` carries the **pace ring**: its radius shrinks from 1.5x to
   1x as `timeMs` approaches `nextDueMs`, then snaps back. On an event the
   footprint flashes for 150 ms after `lastEvent.atMs`: green `perfect`,
   yellow `good`, red `tooFast` / `tooSlow` / `skipped`, red with the label
   "other foot!" on `wrongFoot`.
7. Segment banner: for 1.5 s after `segmentChangedAtMs` (not `lastEvent`, which
   a step can overwrite), the terrain label and,
   if not empty, the weather label, large, centred.
8. HUD along the top: time left (seconds); speed bar; energy bar (turns red
   under 30); combo with multiplier ("x2"); score; and a **pace meter**: a
   horizontal bar with a centre mark and a needle at `lastOffsetMs` clamped to
   +-goodWindow x 2, labelled "too fast" on the left and "too slow" on the right.

Every colour is a constant at the top of the file.

### `useGameLoop.ts`

```ts
export function useGameLoop(
  canvasRef: RefObject<HTMLCanvasElement>,
  config: GameConfig
): {
  state: GameState;
  start(): void; // 3-2-1 countdown then startRun
  restart(): void;
  pressFoot(foot: Foot): void; // the pads and the canvas call this
  countdown: number | null; // 3, 2, 1 or null
};
```

- `requestAnimationFrame` loop. Simulation uses a fixed step of 10 ms:
  accumulate real elapsed time, call `tick(state, 10)` repeatedly, cap
  accumulated time at 250 ms so a hidden tab does not fast-forward the run.
- Render once per frame with the current state.
- Input, PC: `keydown` for `ArrowLeft`/`F` (left) and `ArrowRight`/`J` (right),
  ignoring key repeats; `pointerdown` on the canvas, left half = left foot,
  right half = right foot. Mobile: the two pads call `pressFoot`. Every input
  path ends in `step(state, foot)`. The first input also calls
  `metronome.unlock()`.
- Input timing: keep a `pendingFeet: Foot[]` queue filled by the handlers and
  drained at the start of the next simulation step, so a press is judged
  against the state at the moment it happened, not a frame later.
- Guide click: if `config.paceGuideClick`, call `click('due')` once when
  `timeMs` first passes `nextDueMs`. On a step event call `click(result)`.
- Canvas size: PC fills the viewport width up to 960 px at 16:9. Mobile fills
  the width and about 60% of the viewport height. `devicePixelRatio` aware.
  Resize on window resize.
- On unmount: cancel the frame, remove listeners, dispose the metronome.

### `PlayPage.tsx`

- Reads the platform: `readOverride()` from the URL or `localStorage`, else
  `detectPlatform()`. Picks `configForPlatform`. A small "PC / Mobile" toggle
  in the pre-start overlay switches and remembers.
- Header: back link to `/`, nickname. Hidden during a run on mobile.
- PC layout: canvas, 16:9. Pre-start overlay: "Left foot: ← or F. Right foot:
  → or J. Match the pace of the road. Ready?" with a Start button.
- Mobile layout: canvas on top, two pads below labelled with a left and a right
  footprint. Pre-start overlay: "Tap left, tap right, at the pace of the road.
  Ready?" The whole page fits the viewport with no scrolling (`100dvh`).
- During countdown: big 3, 2, 1. After finish: results overlay with distance,
  score, best combo, accuracy (percent), platform, and buttons "Run again" and
  "Home". Score submission is M4; in M3 the overlay only displays.

### Tuning check

Play three runs on each platform. A first-time adult should finish with energy
above 0 and a combo above 10 at least once, on both, and should notice the
pace change on the first hill. If not, adjust `PC_CONFIG`, `MOBILE_CONFIG`,
`TERRAIN` or `WEATHER` only. Expect mobile to need the wider windows; if it
still feels late, widen `MOBILE_CONFIG` before touching anything else.

### Done when

A full 60-second run plays in desktop Chrome with the keys and on a phone
(Chrome or Safari, both thumbs on the pads, sound after the first tap). Hills,
water, rain and wind are visibly different and change the pace. Wrong foot,
too fast and too slow are clearly signalled on both platforms. `npm test` and
typecheck green.

---

## M3 outcome (reviewed 2026-09-21)

Done in commits `5b6e8f4`, `e31a93e`, `6173dd9`, `b19b94a`: 45 client tests,
9 server tests, typecheck clean, pure files still pure, nothing under
`server/` or the Vercel files touched. Verified on production by Amit on a PC
and on a phone: a full run plays, it is fun, terrain and weather change the
pace. No tuning values were changed.

Decisions the implementer made where the spec was silent, all accepted and now
part of the spec:

- The footprint that flashes on an event is the foot that just stepped (or was
  skipped), i.e. `oppositeFoot(expectedFoot)`; the pace ring stays on
  `expectedFoot`.
- `restart()` is `start()`.
- The renderer prepends the previous segment behind the runner using the
  `aheadMeters` rule extended backwards. This stays in `render.ts`;
  `course.ts` is only about the road ahead.
- `useGameLoop` publishes the full `GameState` to React every frame. Accepted
  for now; reducing it to phase changes is an M5 polish item.
- Render proportions (`ROAD_THICKNESS_FRACTION` 0.16, runner body 68 px,
  pavement touching the road) are the new baseline.

## M4. Scores that stick

Two decisions added after M3, on top of the original spec:

1. **The leaderboard is public.** `GET /api/scores/top` needs no session. The
   demo's job is to sell the course, and a child should see other children's
   names before typing their own. `POST /api/scores` and `GET /api/scores/me`
   still require the session cookie.
2. **The enter screen shows the top 5** of the detected platform under the
   nickname form, titled "Today's runners" if any row is from today, otherwise
   "High scores". Same `ScoreRow` shape, read-only, no tabs. The home page
   keeps the full panel described below.

### Server files

```text
server/src/scores/scores.ts        validation, save, leaderboard, personal best
server/src/routes/scores.ts        HTTP layer
server/src/player/auth.ts          readCookie + requirePlayer, shared by both routers
server/src/database/mongo.ts       add COLLECTIONS.scores and its indexes
server/src/app.ts                  app.use('/api/scores', scoresRouter)
server/test/scores.test.ts         tests without a database
scripts/smoke.mjs                  extend the flow
```

### Collection `scores`

```ts
interface ScoreDoc {
  _id: ObjectId;
  playerId: ObjectId;
  nickname: string; // copied at save time so the leaderboard needs no join
  score: number; // integer >= 0
  distance: number; // integer metres >= 0
  accuracy: number; // 0..1
  bestCombo: number; // integer >= 0
  runSeconds: number;
  platform: 'pc' | 'mobile';
  course: string; // 'level-1'
  createdAt: Date;
}
```

Indexes in `ensureIndexes`: `{ platform: 1, course: 1, score: -1 }` and
`{ playerId: 1, platform: 1, score: -1 }`.

### Validation (`validateRun(body): RunSummary | null`)

All fields present and finite numbers; integers where stated; `accuracy` in
[0, 1]; `runSeconds` in [10, 300]; `platform` exactly `'pc'` or `'mobile'`;
`course` a string of 1-40 characters. Upper bounds: the theoretical maximum
distance is `MAX_SPEED * runSeconds`, the maximum score is `distance * MAX_MULTIPLIER`,
and `bestCombo <= runSeconds * 1000 / MIN_STEP_INTERVAL_MS`. Define
`MAX_SPEED = 20`, `MAX_MULTIPLIER = 3`, `MIN_STEP_INTERVAL_MS = 480` in
`scores.ts` with a comment pointing at `client/src/game/config.ts`. Reject
anything above with 400.

### Routes (POST and `me` require the session cookie, 401 otherwise; `top` is public; all answer 503 without a database)

```text
POST /api/scores                        body: RunSummary -> 201 { saved: ScoreRow, rank: number }
GET  /api/scores/top?platform=pc&limit  platform required; limit default 10, max 50
                                        -> 200 { rows: ScoreRow[] }  one best row per player
GET  /api/scores/me                     -> 200 { best: { pc: ScoreRow | null, mobile: ScoreRow | null }, runs: number }
```

```ts
interface ScoreRow {
  nickname: string;
  score: number;
  distance: number;
  accuracy: number;
  bestCombo: number;
  platform: 'pc' | 'mobile';
  course: string;
  createdAt: string; // ISO
}
```

PC and mobile are separate leaderboards; the timing windows differ, so the
scores are not comparable. Leaderboard query: `$match { platform, course: 'level-1' }`,
`$sort { score: -1 }`, `$group` by `playerId` taking `$first`,
`$sort { score: -1 }`, `$limit`. `rank` after saving is
`1 + count of players on the same platform and course whose best score is higher`.

Move the `readCookie` helper and a `requirePlayer(req, db)` function out of
`routes/player.ts` into `server/src/player/auth.ts` so both routers use them.
Behaviour of the player routes must not change (existing tests stay green).

### Tests (`server/test/scores.test.ts`, no database)

- POST without cookie -> 401.
- GET top without cookie and without a database -> 503 (public route, no 401).
- GET top without `platform` -> 400.
- POST with a cookie but no database -> 503.
- `validateRun` unit tests: valid summary passes; missing field, negative
  score, accuracy 1.2, impossible distance, impossible score, impossible
  bestCombo, platform `'tablet'` each return null.

### Client

- `services/api.ts`: `submitScore(summary)`, `fetchTopScores(platform, limit?)`,
  `fetchMyBest()`. `fetchTopScores` works before entering.
- `EnterPage`: under the form, the top 5 for `readOverride() ?? detectPlatform()`,
  loaded once on mount; hidden while loading or on error, never blocks entering.
- `PlayPage`: on `finished`, submit once; results overlay shows "Rank #n on
  PC" / "on mobile" or a quiet "Score not saved" if the request fails. Never
  block "Run again".
- `HomePage`: the Play card stays as it is. **Directly below it**, in the empty
  space under "Server: ok · Database: connected", a new panel titled
  "High scores": two tabs, PC and Mobile, defaulting to the detected platform;
  a table of rank, name, score, distance for the top 10; the current player's
  row highlighted if present; under the table one line with the player's own
  best on that platform and run count ("Your best: 1 240 · 7 runs"). Empty
  state: "No runs yet. Be the first." Fits a phone screen without horizontal
  scroll; names are cut with an ellipsis at 14 characters.

### Smoke script

Extend `scripts/smoke.mjs`: enter -> POST a valid run -> top contains the
nickname -> me shows the best -> leave -> me 401.

### Done when

Two different nicknames appear on the production leaderboard after playing in
two browsers. `npm test`, typecheck and `npm run smoke` all pass.

---

## M5. Ship and hand over

0. `useGameLoop`: publish to React only when `phase` or `countdown` changes
   (expose `phase` and a `finished: GameState | null`); the canvas reads the
   ref. `PlayPage` must not re-render 60 times a second.
1. Mobile polish: safe-area insets around the pads (`env(safe-area-inset-*)`),
   no body scroll or pull-to-refresh on `/play`, pads still reachable with one
   hand on a large phone, a one-line "hold your phone upright" hint in
   landscape.
2. README: "How to play", "Tuning the game" (point at `config.ts`: windows,
   terrain, weather, the level-1 course), update the folder map with
   `client/src/game/`.
3. `docs/PHASE-1.md`: fill the "Done" notes under M2 to M5 with what was
   actually verified and the date.
4. `docs/GAME-DESIGN.md` and `docs/API.md`: update if any number or route
   changed during the build.
5. Final production check: health connected, play a run on PC and on a phone,
   see both on their leaderboards.

### Done when

All of the above committed and pushed; production verified; the working tree
is clean.
