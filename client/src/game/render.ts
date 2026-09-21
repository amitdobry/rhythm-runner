// Draws one moment of the game on a canvas with plain shapes: rectangles,
// circles and lines. No pictures, no libraries.
//
// Everything that moves is moved by state.distance, never by the clock. Two
// screenshots of the same state look exactly the same.

import { currentTargetIntervalMs, type GameState } from './engine';
import { segmentAt, upcomingSegments, type SegmentPosition } from './course';
import { oppositeFoot } from './pace';
import type { Segment, Weather } from './config';

export interface RenderOptions {
  width: number;
  height: number;
}

// ---------------------------------------------------------------- colours

const SKY_TOP: Record<Weather, string> = {
  clear: '#5aa9e6',
  rain: '#5b6470',
  wind: '#8fa3b8',
};
const SKY_BOTTOM: Record<Weather, string> = {
  clear: '#cfe8ff',
  rain: '#9aa3ad',
  wind: '#d3ddE8',
};
const SKYLINE = '#7c8aa0';
const SKYLINE_WINDOW = '#9fb0c6';
const PAVEMENT = '#b9bec7';
const PAVEMENT_EDGE = '#9aa0aa';
const LAMP_POST = '#5d6470';
const LAMP_LIGHT = '#ffe9a8';

const ROAD_FLAT = '#4a4f59';
const ROAD_UPHILL = '#565b66';
const ROAD_DOWNHILL = '#414650';
const ROAD_WATER = '#2f7fb8';
const WATER_RIPPLE = '#7fc4ea';
const ROAD_EDGE = '#2b2f36';
const LANE_DASH = '#e8e2cf';
const EARTH = '#3a3026';

const RAIN_STREAK = '#dbe7f2';
const WIND_STREAK = '#ffffff';

const RUNNER_BODY = '#f2f4f8';
const RUNNER_TRIM = '#1d2230';
const RUNNER_LEG = '#1d2230';
const RUNNER_LEG_READY = '#ffd23f';
const RUNNER_STUMBLE = '#e8503a';

const FOOTPRINT = '#cfd6e0';
const FOOTPRINT_READY = '#ffd23f';
const RING = '#ffffff';
const FLASH_PERFECT = '#3ddc84';
const FLASH_GOOD = '#ffd23f';
const FLASH_BAD = '#e8503a';

const HUD_PANEL = 'rgba(15, 18, 26, 0.62)';
const HUD_TEXT = '#f2f4f8';
const HUD_MUTED = '#aab4c4';
const BAR_TRACK = 'rgba(255, 255, 255, 0.22)';
const BAR_SPEED = '#4ea8ff';
const BAR_ENERGY = '#3ddc84';
const BAR_ENERGY_LOW = '#e8503a';
const PACE_NEEDLE = '#ffd23f';
const PACE_CENTRE = '#f2f4f8';

const BANNER_TEXT = '#ffffff';
const BANNER_SHADOW = 'rgba(15, 18, 26, 0.55)';

// ---------------------------------------------------------------- sizes

const METERS_PER_PIXEL = 0.06; // 960 px of screen is about 58 metres of road
const LOOK_AHEAD_SCREENS = 2.5; // how much road to build in front of the runner
const RUNNER_X_FRACTION = 1 / 3;
const HORIZON_FRACTION = 0.46;
const ROAD_Y_FRACTION = 0.72; // where the road is under the runner's feet
const ROAD_THICKNESS_FRACTION = 0.1;
const ROAD_SLOPE = 0.16; // pixels of height per pixel of road on a hill
const SKYLINE_PERIOD = 120;
const SKYLINE_HEIGHTS = [0.16, 0.27, 0.11, 0.23, 0.2, 0.3, 0.14, 0.25];
const LAMP_SPACING = 190;
const DASH_LENGTH = 26;
const DASH_PERIOD = 60;
const FLASH_MS = 150;
const BANNER_MS = 1500;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** One stretch of road, already turned into pixels. */
interface RoadBand {
  segment: Segment;
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  options: RenderOptions
): void {
  const { width, height } = options;
  const scale = Math.max(0.62, Math.min(1, width / 960));
  const here = segmentAt(state.distance, state.config.course);
  const roadOffsetPx = state.distance / METERS_PER_PIXEL;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  drawSky(ctx, width, height, here.segment.weather);
  drawSkyline(ctx, width, height, roadOffsetPx);
  drawPavement(ctx, width, height, roadOffsetPx);

  const bands = buildRoad(state, width, height);
  drawRoad(ctx, bands, width, height, roadOffsetPx);
  drawWeather(ctx, width, height, here.segment.weather, roadOffsetPx);

  const runnerX = width * RUNNER_X_FRACTION;
  const groundY = roadYAt(bands, runnerX, height * ROAD_Y_FRACTION);
  drawRunner(ctx, state, runnerX, groundY, scale);
  drawFootprints(ctx, state, runnerX, groundY, scale);

  drawBanner(ctx, state, width, height, scale);
  drawHud(ctx, state, width, scale);

  ctx.restore();
}

// ---------------------------------------------------------------- scenery

function drawSky(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  weather: Weather
): void {
  const sky = ctx.createLinearGradient(0, 0, 0, height * HORIZON_FRACTION);
  sky.addColorStop(0, SKY_TOP[weather]);
  sky.addColorStop(1, SKY_BOTTOM[weather]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
}

function drawSkyline(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  roadOffsetPx: number
): void {
  const horizon = height * HORIZON_FRACTION;
  const offset = (roadOffsetPx * 0.2) % SKYLINE_PERIOD;
  const count = Math.ceil(width / SKYLINE_PERIOD) + 2;
  const first = Math.floor((roadOffsetPx * 0.2) / SKYLINE_PERIOD);

  for (let i = 0; i < count; i += 1) {
    const x = i * SKYLINE_PERIOD - offset;
    const pick = SKYLINE_HEIGHTS[(first + i) % SKYLINE_HEIGHTS.length];
    const buildingHeight = height * pick;
    const buildingWidth = SKYLINE_PERIOD * 0.72;

    ctx.fillStyle = SKYLINE;
    ctx.fillRect(x, horizon - buildingHeight, buildingWidth, buildingHeight);

    // A few windows, always in the same place on the same building.
    ctx.fillStyle = SKYLINE_WINDOW;
    for (let row = 1; row * 22 < buildingHeight - 10; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        ctx.fillRect(x + 10 + column * 24, horizon - buildingHeight + row * 22, 10, 12);
      }
    }
  }
}

function drawPavement(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  roadOffsetPx: number
): void {
  const horizon = height * HORIZON_FRACTION;
  const bandHeight = height * 0.1;

  ctx.fillStyle = PAVEMENT;
  ctx.fillRect(0, horizon, width, bandHeight);
  ctx.fillStyle = PAVEMENT_EDGE;
  ctx.fillRect(0, horizon + bandHeight - 4, width, 4);

  const offset = (roadOffsetPx * 0.6) % LAMP_SPACING;
  for (let x = -offset; x < width + LAMP_SPACING; x += LAMP_SPACING) {
    const postHeight = height * 0.16;
    ctx.fillStyle = LAMP_POST;
    ctx.fillRect(x, horizon - postHeight, 5, postHeight + bandHeight - 6);
    ctx.fillStyle = LAMP_LIGHT;
    ctx.beginPath();
    ctx.arc(x + 2.5, horizon - postHeight, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------- the road

/**
 * Turns the segments around the runner into bands of pixels. The height of
 * each band is chained to the one before it, so hills join up smoothly.
 */
function buildRoad(state: GameState, width: number, height: number): RoadBand[] {
  const course = state.config.course;
  const lookAheadMeters = width * LOOK_AHEAD_SCREENS * METERS_PER_PIXEL;
  const ahead = upcomingSegments(state.distance, course, lookAheadMeters);

  // The segment behind the runner, so there is no hole on the left.
  const here = ahead[0];
  const behindIndex = (here.index - 1 + course.length) % course.length;
  const behind: SegmentPosition = {
    index: behindIndex,
    segment: course[behindIndex],
    startMeters: 0,
    metersIntoSegment: 0,
    aheadMeters: here.aheadMeters - course[behindIndex].lengthMeters,
  };
  const positions = [behind, ...ahead];

  const runnerX = width * RUNNER_X_FRACTION;
  const roadY = height * ROAD_Y_FRACTION;

  const bands: RoadBand[] = [];
  for (let i = 0; i < positions.length; i += 1) {
    const position = positions[i];
    const xStart = runnerX + position.aheadMeters / METERS_PER_PIXEL;
    const next = positions[i + 1];
    const xEnd = next
      ? runnerX + next.aheadMeters / METERS_PER_PIXEL
      : xStart + position.segment.lengthMeters / METERS_PER_PIXEL;
    bands.push({ segment: position.segment, xStart, xEnd, yStart: 0, yEnd: 0 });
  }

  // Height: start from the band the runner stands on and walk both ways.
  const hereBand = 1; // index of the current segment in bands
  const slopeHere = slopeOf(bands[hereBand].segment);
  bands[hereBand].yStart = roadY - slopeHere * (runnerX - bands[hereBand].xStart);
  bands[hereBand].yEnd =
    bands[hereBand].yStart + slopeHere * (bands[hereBand].xEnd - bands[hereBand].xStart);

  for (let i = hereBand + 1; i < bands.length; i += 1) {
    bands[i].yStart = bands[i - 1].yEnd;
    bands[i].yEnd = bands[i].yStart + slopeOf(bands[i].segment) * (bands[i].xEnd - bands[i].xStart);
  }
  for (let i = hereBand - 1; i >= 0; i -= 1) {
    bands[i].yEnd = bands[i + 1].yStart;
    bands[i].yStart = bands[i].yEnd - slopeOf(bands[i].segment) * (bands[i].xEnd - bands[i].xStart);
  }

  return bands;
}

/** Downhill falls to the right (y grows), uphill rises (y shrinks). */
function slopeOf(segment: Segment): number {
  if (segment.terrain === 'uphill') return -ROAD_SLOPE;
  if (segment.terrain === 'downhill') return ROAD_SLOPE;
  return 0;
}

function roadColour(segment: Segment): string {
  if (segment.terrain === 'water') return ROAD_WATER;
  if (segment.terrain === 'uphill') return ROAD_UPHILL;
  if (segment.terrain === 'downhill') return ROAD_DOWNHILL;
  return ROAD_FLAT;
}

function roadYAt(bands: RoadBand[], x: number, fallback: number): number {
  for (const band of bands) {
    if (x >= band.xStart && x <= band.xEnd) {
      const across = (x - band.xStart) / Math.max(1, band.xEnd - band.xStart);
      return band.yStart + (band.yEnd - band.yStart) * across;
    }
  }
  return fallback;
}

function drawRoad(
  ctx: CanvasRenderingContext2D,
  bands: RoadBand[],
  width: number,
  height: number,
  roadOffsetPx: number
): void {
  const thickness = height * ROAD_THICKNESS_FRACTION;

  for (const band of bands) {
    if (band.xEnd < 0 || band.xStart > width) continue;

    // Earth under the road, down to the bottom of the screen.
    ctx.fillStyle = EARTH;
    ctx.beginPath();
    ctx.moveTo(band.xStart, band.yStart);
    ctx.lineTo(band.xEnd, band.yEnd);
    ctx.lineTo(band.xEnd, height);
    ctx.lineTo(band.xStart, height);
    ctx.closePath();
    ctx.fill();

    // The road surface itself.
    ctx.fillStyle = roadColour(band.segment);
    ctx.beginPath();
    ctx.moveTo(band.xStart, band.yStart);
    ctx.lineTo(band.xEnd, band.yEnd);
    ctx.lineTo(band.xEnd, band.yEnd + thickness);
    ctx.lineTo(band.xStart, band.yStart + thickness);
    ctx.closePath();
    ctx.fill();

    if (band.segment.terrain === 'water') drawRipples(ctx, band, thickness, roadOffsetPx);

    // The edge where one stretch of road becomes the next: read the road ahead.
    ctx.strokeStyle = ROAD_EDGE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(band.xStart, band.yStart - 2);
    ctx.lineTo(band.xStart, band.yStart + thickness + 2);
    ctx.stroke();
  }

  drawLaneDashes(ctx, bands, width, height, roadOffsetPx);
}

function drawRipples(
  ctx: CanvasRenderingContext2D,
  band: RoadBand,
  thickness: number,
  roadOffsetPx: number
): void {
  ctx.strokeStyle = WATER_RIPPLE;
  ctx.lineWidth = 2;
  const spacing = 34;
  const offset = roadOffsetPx % spacing;
  for (let x = band.xStart - offset; x < band.xEnd; x += spacing) {
    if (x < band.xStart) continue;
    const across = (x - band.xStart) / Math.max(1, band.xEnd - band.xStart);
    const y = band.yStart + (band.yEnd - band.yStart) * across;
    ctx.beginPath();
    ctx.moveTo(x, y + thickness * 0.45);
    ctx.quadraticCurveTo(x + 9, y + thickness * 0.3, x + 18, y + thickness * 0.45);
    ctx.stroke();
  }
}

function drawLaneDashes(
  ctx: CanvasRenderingContext2D,
  bands: RoadBand[],
  width: number,
  height: number,
  roadOffsetPx: number
): void {
  const thickness = height * ROAD_THICKNESS_FRACTION;
  const offset = roadOffsetPx % DASH_PERIOD;

  ctx.fillStyle = LANE_DASH;
  for (let x = -offset; x < width; x += DASH_PERIOD) {
    const y = roadYAt(bands, x, height * ROAD_Y_FRACTION);
    ctx.fillRect(x, y + thickness * 0.55, DASH_LENGTH, 4);
  }
}

// ---------------------------------------------------------------- weather

function drawWeather(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  weather: Weather,
  roadOffsetPx: number
): void {
  if (weather === 'clear') return;

  ctx.save();
  if (weather === 'rain') {
    ctx.strokeStyle = RAIN_STREAK;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    const spacing = 46;
    const offset = (roadOffsetPx * 1.4) % spacing;
    for (let x = -offset; x < width + spacing; x += spacing) {
      for (let row = 0; row < 5; row += 1) {
        const y = ((roadOffsetPx * 3 + row * 137) % height) - 20;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 9, y + 22);
        ctx.stroke();
      }
    }
  } else {
    ctx.strokeStyle = WIND_STREAK;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    const spacing = 120;
    const offset = (roadOffsetPx * 2) % spacing;
    for (let row = 0; row < 6; row += 1) {
      const y = height * (0.1 + row * 0.12);
      for (let x = -offset; x < width + spacing; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 52, y);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- runner

function drawRunner(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  x: number,
  groundY: number,
  scale: number
): void {
  const stumbling = state.stumbleUntilMs !== null;
  const bodyHeight = 58 * scale;
  const bodyWidth = 22 * scale;
  const headRadius = 10 * scale;

  ctx.save();
  ctx.translate(x, groundY);
  if (stumbling) ctx.rotate((20 * Math.PI) / 180);

  // legs: the foot that must land next is forward and lit up
  const forward = state.expectedFoot;
  ctx.lineWidth = 5 * scale;
  ctx.lineCap = 'round';

  ctx.strokeStyle = stumbling ? RUNNER_STUMBLE : RUNNER_LEG;
  ctx.beginPath();
  ctx.moveTo(0, -bodyHeight * 0.45);
  ctx.lineTo(forward === 'left' ? -14 * scale : 14 * scale, 0);
  ctx.stroke();

  ctx.strokeStyle = stumbling ? RUNNER_STUMBLE : RUNNER_LEG_READY;
  ctx.beginPath();
  ctx.moveTo(0, -bodyHeight * 0.45);
  ctx.lineTo(forward === 'left' ? 16 * scale : -16 * scale, -2 * scale);
  ctx.stroke();

  // body and head
  ctx.fillStyle = stumbling ? RUNNER_STUMBLE : RUNNER_BODY;
  roundedRect(ctx, -bodyWidth / 2, -bodyHeight, bodyWidth, bodyHeight * 0.62, 9 * scale);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, -bodyHeight - headRadius * 0.4, headRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = RUNNER_TRIM;
  ctx.lineWidth = 2 * scale;
  roundedRect(ctx, -bodyWidth / 2, -bodyHeight, bodyWidth, bodyHeight * 0.62, 9 * scale);
  ctx.stroke();

  ctx.restore();
}

/** The two footprints, the shrinking pace ring, and the flash after an event. */
function drawFootprints(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  x: number,
  groundY: number,
  scale: number
): void {
  const gap = 30 * scale;
  const radius = 13 * scale;
  const y = groundY + 10 * scale;

  const flash = flashColour(state);
  const steppedFoot = oppositeFoot(state.expectedFoot);

  for (const foot of ['left', 'right'] as const) {
    const footX = foot === 'left' ? x - gap : x + gap;
    const isNext = foot === state.expectedFoot;

    ctx.fillStyle = flash && foot === steppedFoot ? flash : isNext ? FOOTPRINT_READY : FOOTPRINT;
    ctx.beginPath();
    ctx.ellipse(footX, y, radius * 0.66, radius, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isNext) drawPaceRing(ctx, state, footX, y, radius, scale);
  }

  if (state.lastEvent?.kind === 'wrongFoot' && flash) {
    ctx.fillStyle = FLASH_BAD;
    ctx.font = `bold ${16 * scale}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('other foot!', x, y + 34 * scale);
  }
}

function drawPaceRing(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  x: number,
  y: number,
  radius: number,
  scale: number
): void {
  const interval = currentTargetIntervalMs(state);
  const remaining = state.nextDueMs - state.timeMs;
  const progress = clamp01(1 - remaining / interval);
  const ringRadius = radius * (1.5 - 0.5 * progress);

  ctx.strokeStyle = RING;
  ctx.lineWidth = 2.5 * scale;
  ctx.beginPath();
  ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
  ctx.stroke();
}

function flashColour(state: GameState): string | null {
  const event = state.lastEvent;
  if (!event) return null;
  if (state.timeMs - event.atMs > FLASH_MS || state.timeMs < event.atMs) return null;
  if (event.kind === 'perfect') return FLASH_PERFECT;
  if (event.kind === 'good') return FLASH_GOOD;
  if (
    event.kind === 'tooFast' ||
    event.kind === 'tooSlow' ||
    event.kind === 'skipped' ||
    event.kind === 'wrongFoot'
  ) {
    return FLASH_BAD;
  }
  return null;
}

// ---------------------------------------------------------------- banner

function drawBanner(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  width: number,
  height: number,
  scale: number
): void {
  const changedAt = state.segmentChangedAtMs;
  if (changedAt === null || state.timeMs - changedAt > BANNER_MS) return;

  const segment = state.config.course[state.segmentIndex];
  if (!segment) return;
  const terrainLabel = state.config.terrain[segment.terrain].label;
  const weatherLabel = state.config.weather[segment.weather].label;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = BANNER_SHADOW;
  ctx.shadowBlur = 10;
  ctx.fillStyle = BANNER_TEXT;

  ctx.font = `bold ${30 * scale}px ${FONT}`;
  ctx.fillText(terrainLabel, width / 2, height * 0.3);

  if (weatherLabel) {
    ctx.font = `${20 * scale}px ${FONT}`;
    ctx.fillText(weatherLabel, width / 2, height * 0.3 + 30 * scale);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- HUD

function drawHud(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  width: number,
  scale: number
): void {
  const config = state.config;
  const panelHeight = 62 * scale;
  const pad = 12 * scale;

  ctx.fillStyle = HUD_PANEL;
  ctx.fillRect(0, 0, width, panelHeight);

  const secondsLeft = Math.max(0, Math.ceil((config.runSeconds * 1000 - state.timeMs) / 1000));

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = HUD_TEXT;
  ctx.font = `bold ${24 * scale}px ${FONT}`;
  ctx.fillText(`${secondsLeft}s`, pad, pad + 20 * scale);

  // speed and energy bars
  const barX = pad + 58 * scale;
  const barWidth = 120 * scale;
  drawBar(
    ctx,
    barX,
    pad + 4 * scale,
    barWidth,
    9 * scale,
    state.speed / config.speed.max,
    BAR_SPEED
  );
  const energyLow = state.energy < 30;
  drawBar(
    ctx,
    barX,
    pad + 20 * scale,
    barWidth,
    9 * scale,
    state.energy / config.energy.max,
    energyLow ? BAR_ENERGY_LOW : BAR_ENERGY
  );

  ctx.fillStyle = HUD_MUTED;
  ctx.font = `${11 * scale}px ${FONT}`;
  ctx.fillText('speed', barX + barWidth + 8 * scale, pad + 12 * scale);
  ctx.fillText('energy', barX + barWidth + 8 * scale, pad + 28 * scale);

  // combo and score
  const comboX = barX + barWidth + 66 * scale;
  ctx.fillStyle = HUD_TEXT;
  ctx.font = `bold ${18 * scale}px ${FONT}`;
  ctx.fillText(`${state.combo} x${multiplierOf(state)}`, comboX, pad + 14 * scale);
  ctx.font = `${16 * scale}px ${FONT}`;
  ctx.fillText(`${Math.round(state.score)}`, comboX, pad + 34 * scale);
  ctx.fillStyle = HUD_MUTED;
  ctx.font = `${11 * scale}px ${FONT}`;
  ctx.fillText('combo', comboX + 74 * scale, pad + 14 * scale);
  ctx.fillText('score', comboX + 74 * scale, pad + 34 * scale);

  drawPaceMeter(ctx, state, width, scale, panelHeight);
}

function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fraction: number,
  colour: string
): void {
  ctx.fillStyle = BAR_TRACK;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, width * clamp01(fraction), height);
}

/** Says whether the last step was early or late, so the player can correct. */
function drawPaceMeter(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  width: number,
  scale: number,
  panelHeight: number
): void {
  const meterWidth = Math.min(200 * scale, width * 0.28);
  const x = width - meterWidth - 12 * scale;
  const y = panelHeight * 0.52;
  const limit = state.config.goodWindowMs * 2;

  ctx.fillStyle = BAR_TRACK;
  ctx.fillRect(x, y - 4 * scale, meterWidth, 8 * scale);

  ctx.fillStyle = PACE_CENTRE;
  ctx.fillRect(x + meterWidth / 2 - 1, y - 9 * scale, 2, 18 * scale);

  if (state.lastOffsetMs !== null) {
    const clamped = Math.max(-limit, Math.min(limit, state.lastOffsetMs));
    const needleX = x + meterWidth / 2 + (clamped / limit) * (meterWidth / 2);
    ctx.fillStyle = PACE_NEEDLE;
    ctx.fillRect(needleX - 2 * scale, y - 11 * scale, 4 * scale, 22 * scale);
  }

  ctx.fillStyle = HUD_MUTED;
  ctx.font = `${10 * scale}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('too fast', x, y + 20 * scale);
  ctx.textAlign = 'right';
  ctx.fillText('too slow', x + meterWidth, y + 20 * scale);
  ctx.textAlign = 'left';
}

function multiplierOf(state: GameState): number {
  let multiplier = 1;
  for (const entry of state.config.comboMultipliers) {
    if (state.combo >= entry.fromCombo) multiplier = entry.multiplier;
  }
  return multiplier;
}

// ---------------------------------------------------------------- helpers

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
