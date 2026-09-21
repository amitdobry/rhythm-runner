import { segmentAt, upcomingSegments, type SegmentPosition } from '../course';
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
  BUSH,
  CLOUD,
  CLOUD_RAIN,
  FISH,
  HILL_FAR,
  HILL_NEAR,
  LEAF,
  SPLASH,
  SUN,
  SUN_PALE,
  TREE_LEAVES,
  TREE_TRUNK,
} from './palette';
import { seeded } from './shapes';

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
  look: WeatherLook
): void {
  const sky = ctx.createLinearGradient(0, 0, 0, height * HORIZON_FRACTION);
  sky.addColorStop(0, look.skyTop);
  sky.addColorStop(1, look.skyBottom);
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
  look: WeatherLook,
  roadOffsetPx: number
): void {
  if (look.rain < 0.02 && look.wind < 0.02) return;

  ctx.save();
  if (look.rain >= look.wind) {
    ctx.strokeStyle = RAIN_STREAK;
    ctx.globalAlpha = 0.5 * look.rain;
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
    ctx.globalAlpha = 0.35 * look.wind;
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

/* ---------------------------------------------------------------- weather */

/**
 * How the sky looks right now.
 *
 * Weather does not snap: when the road crosses into rain the sky darkens over
 * a second, so the change is something you watch arrive rather than a jump
 * between two frames.
 */
export interface WeatherLook {
  skyTop: string;
  skyBottom: string;
  rain: number; // 0 to 1
  wind: number; // 0 to 1
  cloudDark: number; // 0 to 1
}

const BLEND_MS = 1000;

export function weatherLook(state: GameState): WeatherLook {
  const course = state.config.course;
  const current = course[state.segmentIndex] ?? course[0];
  const previous = course[(state.segmentIndex - 1 + course.length) % course.length];

  const changedAt = state.segmentChangedAtMs;
  const through =
    changedAt === null ? 1 : Math.max(0, Math.min(1, (state.timeMs - changedAt) / BLEND_MS));

  const is = (weather: Weather, kind: 'rain' | 'wind') => (weather === kind ? 1 : 0);

  return {
    skyTop: blendColour(SKY_TOP[previous.weather], SKY_TOP[current.weather], through),
    skyBottom: blendColour(SKY_BOTTOM[previous.weather], SKY_BOTTOM[current.weather], through),
    rain: lerp(is(previous.weather, 'rain'), is(current.weather, 'rain'), through),
    wind: lerp(is(previous.weather, 'wind'), is(current.weather, 'wind'), through),
    cloudDark: lerp(is(previous.weather, 'rain'), is(current.weather, 'rain'), through),
  };
}

function lerp(from: number, to: number, through: number): number {
  return from + (to - from) * through;
}

/** Mixes two #rrggbb colours. Anything else is passed straight through. */
function blendColour(from: string, to: string, through: number): string {
  if (from.length !== 7 || to.length !== 7) return through < 0.5 ? from : to;
  const part = (at: number) => {
    const a = parseInt(from.slice(at, at + 2), 16);
    const b = parseInt(to.slice(at, at + 2), 16);
    return Math.round(lerp(a, b, through))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${part(1)}${part(3)}${part(5)}`;
}

/* ---------------------------------------------------------------- sky life */

/** The sun, or the pale disc you can just make out behind the cloud. */
export function drawSun(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  look: WeatherLook
): void {
  const hidden = Math.max(look.rain, look.wind);
  ctx.save();
  ctx.globalAlpha = 1 - hidden * 0.5;
  ctx.fillStyle = hidden > 0.5 ? SUN_PALE : SUN;
  ctx.beginPath();
  ctx.arc(width * 0.22, height * 0.14, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const CLOUD_PERIOD = 260;

export function drawClouds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  roadOffsetPx: number,
  look: WeatherLook
): void {
  // Rain brings more cloud and darkens it; wind stretches them and hurries them on.
  const count = Math.ceil(width / CLOUD_PERIOD) + 2 + Math.round(look.cloudDark * 2);
  const speed = 0.1 + look.wind * 0.12;
  const stretch = 1 + look.wind * 0.8;
  const offset = (roadOffsetPx * speed) % CLOUD_PERIOD;

  ctx.save();
  ctx.fillStyle = blendColour(CLOUD, CLOUD_RAIN, look.cloudDark);
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < count + 1; i += 1) {
    const x = i * CLOUD_PERIOD - offset;
    const y = height * (0.07 + 0.06 * seeded(7, i));
    const r = 16 + 8 * seeded(9, i);
    ctx.beginPath();
    ctx.ellipse(x, y, r * stretch, r * 0.7, 0, 0, Math.PI * 2);
    ctx.ellipse(x + r * stretch * 0.7, y + 3, r * 0.8 * stretch, r * 0.55, 0, 0, Math.PI * 2);
    ctx.ellipse(x - r * stretch * 0.7, y + 4, r * 0.7 * stretch, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Two rows of soft bumps, far behind the city. */
export function drawHills(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  roadOffsetPx: number
): void {
  const horizon = height * HORIZON_FRACTION;
  const rows = [
    { colour: HILL_FAR, speed: 0.15, period: 240, rise: 0.12 },
    { colour: HILL_NEAR, speed: 0.25, period: 180, rise: 0.08 },
  ];

  for (const row of rows) {
    const offset = (roadOffsetPx * row.speed) % row.period;
    const first = Math.floor((roadOffsetPx * row.speed) / row.period);
    ctx.fillStyle = row.colour;
    ctx.beginPath();
    ctx.moveTo(-row.period, horizon);
    for (let i = -1; i * row.period - offset < width + row.period; i += 1) {
      const x = i * row.period - offset;
      const top = horizon - height * row.rise * (0.7 + 0.6 * seeded(3, first + i));
      ctx.quadraticCurveTo(x + row.period / 2, top, x + row.period, horizon);
    }
    ctx.lineTo(width + row.period, horizon);
    ctx.closePath();
    ctx.fill();
  }
}

/* ---------------------------------------------------------------- props */

const PROP_SPACING = 150;

/** Trees and bushes along the pavement, always in the same places. */
export function drawProps(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  roadOffsetPx: number
): void {
  const horizon = height * HORIZON_FRACTION;
  const bandHeight = height * (ROAD_Y_FRACTION - HORIZON_FRACTION);
  const base = horizon + bandHeight * 0.8;
  const offset = (roadOffsetPx * 0.6) % PROP_SPACING;
  const first = Math.floor((roadOffsetPx * 0.6) / PROP_SPACING);

  for (let i = -1; i * PROP_SPACING - offset < width + PROP_SPACING; i += 1) {
    const x = i * PROP_SPACING - offset;
    const pick = seeded(11, first + i);

    if (pick < 0.45) {
      const treeHeight = 34 + 10 * seeded(13, first + i);
      ctx.fillStyle = TREE_TRUNK;
      ctx.fillRect(x - 3, base - treeHeight, 6, treeHeight);
      ctx.fillStyle = TREE_LEAVES;
      ctx.beginPath();
      ctx.arc(x - 6, base - treeHeight - 4, 13, 0, Math.PI * 2);
      ctx.arc(x + 7, base - treeHeight - 1, 11, 0, Math.PI * 2);
      ctx.fill();
    } else if (pick < 0.7) {
      ctx.fillStyle = BUSH;
      ctx.beginPath();
      ctx.ellipse(x, base - 6, 16, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/* ------------------------------------------------------- water and weather life */

/** A fish that breaks the surface every few metres of water. */
export function drawFish(
  ctx: CanvasRenderingContext2D,
  bands: RoadBand[],
  height: number,
  roadOffsetPx: number
): void {
  const thickness = height * ROAD_THICKNESS_FRACTION;
  const period = 190;

  for (const band of bands) {
    if (band.segment.terrain !== 'water') continue;
    const offset = (roadOffsetPx * 0.9) % period;

    for (let x = band.xStart - offset; x < band.xEnd; x += period) {
      if (x < band.xStart) continue;
      const across = (x - band.xStart) / Math.max(1, band.xEnd - band.xStart);
      const y = band.yStart + (band.yEnd - band.yStart) * across + thickness * 0.35;

      ctx.fillStyle = FISH;
      ctx.beginPath();
      ctx.ellipse(x, y, 7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 7, y);
      ctx.lineTo(x - 13, y - 4);
      ctx.lineTo(x - 13, y + 4);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** Leaves hurrying past, faster than the road, when the wind is up. */
export function drawLeaves(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  roadOffsetPx: number,
  look: WeatherLook
): void {
  if (look.wind < 0.05) return;

  ctx.save();
  ctx.globalAlpha = look.wind;
  ctx.fillStyle = LEAF;
  for (let i = 0; i < 4; i += 1) {
    const period = 320 + i * 70;
    const x = width - (((roadOffsetPx * 2.2 + i * 180) % (width + period)) - period);
    const y = height * (0.2 + 0.12 * i) + Math.sin(roadOffsetPx / 40 + i) * 12;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(roadOffsetPx / 30 + i) * 0.9);
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

const FOOT_SPLASH_MS = 260;

/**
 * What the ground does when a foot lands on it: a splash in water, a spreading
 * ring in the rain, nothing on a dry road.
 */
export function drawFootSplash(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  x: number,
  groundY: number,
  scale: number
): void {
  const event = state.lastEvent;
  if (!event) return;
  const age = state.timeMs - event.atMs;
  if (age < 0 || age > FOOT_SPLASH_MS) return;
  if (event.kind === 'segment' || event.kind === 'skipped') return;

  const here = segmentAt(state.distance, state.config.course).segment;
  const inWater = here.terrain === 'water';
  const inRain = here.weather === 'rain';
  if (!inWater && !inRain) return;

  const through = age / FOOT_SPLASH_MS;
  ctx.save();
  ctx.globalAlpha = 1 - through;
  ctx.strokeStyle = SPLASH;
  ctx.lineWidth = 2 * scale;

  if (inWater) {
    for (const angle of [-0.9, -0.3, 0.4]) {
      const reach = (10 + 14 * through) * scale;
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(
        x + Math.cos(angle - Math.PI / 2) * reach,
        groundY + Math.sin(angle - Math.PI / 2) * reach
      );
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.ellipse(
      x,
      groundY + 4 * scale,
      (6 + 18 * through) * scale,
      (2 + 6 * through) * scale,
      0,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }
  ctx.restore();
}
