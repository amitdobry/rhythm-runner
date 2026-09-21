import { upcomingSegments, type SegmentPosition } from '../course';
import type { GameState } from '../engine';
import type { Segment, Weather } from '../config';
import {
  EARTH,
  LAMP_LIGHT,
  LAMP_POST,
  LANE_DASH,
  PAVEMENT,
  PAVEMENT_EDGE,
  RAIN_STREAK,
  ROAD_DOWNHILL,
  ROAD_EDGE,
  ROAD_FLAT,
  ROAD_UPHILL,
  ROAD_WATER,
  SKYLINE,
  SKYLINE_WINDOW,
  SKY_BOTTOM,
  SKY_TOP,
  WATER_RIPPLE,
  WIND_STREAK,
} from './palette';

/**
 * The world the runner moves through: sky, city, pavement, road and weather.
 * Every layer scrolls from state.distance, never from the clock, so the same
 * moment always looks the same.
 */

export const METERS_PER_PIXEL = 0.06; // 960 px of screen is about 58 metres of road

export const LOOK_AHEAD_SCREENS = 2.5; // how much road to build in front of the runner

export const RUNNER_X_FRACTION = 1 / 3;

export const HORIZON_FRACTION = 0.46;

export const ROAD_Y_FRACTION = 0.72; // where the road is under the runner's feet

export const ROAD_THICKNESS_FRACTION = 0.16;

export const ROAD_SLOPE = 0.16; // pixels of height per pixel of road on a hill

export const SKYLINE_PERIOD = 120;

export const SKYLINE_HEIGHTS = [0.16, 0.27, 0.11, 0.23, 0.2, 0.3, 0.14, 0.25];

export const LAMP_SPACING = 190;

export const DASH_LENGTH = 26;

export const DASH_PERIOD = 60;

/** One stretch of road, already turned into pixels. */
export interface RoadBand {
  segment: Segment;
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
}

export function drawSky(
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

export function drawSkyline(
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

export function drawPavement(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  roadOffsetPx: number
): void {
  const horizon = height * HORIZON_FRACTION;
  // The pavement reaches all the way down to the road, so no sky shows between them.
  const bandHeight = height * (ROAD_Y_FRACTION - HORIZON_FRACTION);
  const postBase = horizon + bandHeight * 0.55;

  ctx.fillStyle = PAVEMENT;
  ctx.fillRect(0, horizon, width, bandHeight);
  ctx.fillStyle = PAVEMENT_EDGE;
  ctx.fillRect(0, horizon + bandHeight - 5, width, 5);

  const offset = (roadOffsetPx * 0.6) % LAMP_SPACING;
  for (let x = -offset; x < width + LAMP_SPACING; x += LAMP_SPACING) {
    const postHeight = height * 0.2;
    ctx.fillStyle = LAMP_POST;
    ctx.fillRect(x, postBase - postHeight, 5, postHeight);
    ctx.fillStyle = LAMP_LIGHT;
    ctx.beginPath();
    ctx.arc(x + 2.5, postBase - postHeight, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Turns the segments around the runner into bands of pixels. The height of
 * each band is chained to the one before it, so hills join up smoothly.
 */
export function buildRoad(state: GameState, width: number, height: number): RoadBand[] {
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
export function slopeOf(segment: Segment): number {
  if (segment.terrain === 'uphill') return -ROAD_SLOPE;
  if (segment.terrain === 'downhill') return ROAD_SLOPE;
  return 0;
}

export function roadColour(segment: Segment): string {
  if (segment.terrain === 'water') return ROAD_WATER;
  if (segment.terrain === 'uphill') return ROAD_UPHILL;
  if (segment.terrain === 'downhill') return ROAD_DOWNHILL;
  return ROAD_FLAT;
}

export function roadYAt(bands: RoadBand[], x: number, fallback: number): number {
  for (const band of bands) {
    if (x >= band.xStart && x <= band.xEnd) {
      const across = (x - band.xStart) / Math.max(1, band.xEnd - band.xStart);
      return band.yStart + (band.yEnd - band.yStart) * across;
    }
  }
  return fallback;
}

export function drawRoad(
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

export function drawRipples(
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

export function drawLaneDashes(
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

export function drawWeather(
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
