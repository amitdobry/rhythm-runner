// Draws one moment of the game on a canvas with plain shapes: rectangles,
// circles and lines. No pictures, no libraries.
//
// Everything that moves is moved by state.distance, never by the clock. Two
// screenshots of the same state look exactly the same.
//
// This file only says what is drawn and in what order. Each layer lives in its
// own file under render/, small enough to open one at a time:
//
//   palette.ts  every colour and the font
//   shapes.ts   the small drawing helpers
//   scene.ts    sky, city, pavement, road, weather
//   runner.ts   the character
//   target.ts   the footprints and the dartboard
//   answers.ts  what happens on screen when a foot lands
//   hud.ts      the numbers along the top, and the banner

import { segmentAt } from './course';
import type { GameState } from './engine';
import {
  MISS_KINDS,
  SHAKE_MS,
  SHAKE_PX,
  answerNow,
  drawPopup,
  drawVignette,
} from './render/answers';
import { drawBanner, drawHud } from './render/hud';
import { drawRunner } from './render/runner';
import {
  METERS_PER_PIXEL,
  ROAD_Y_FRACTION,
  RUNNER_X_FRACTION,
  buildRoad,
  drawPavement,
  drawRoad,
  drawSky,
  drawSkyline,
  drawWeather,
  roadYAt,
} from './render/scene';
import { drawFootprints } from './render/target';

export interface RenderOptions {
  width: number;
  height: number;
  /** The player's own shirt, from their nickname. */
  shirtColour: string;
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  options: RenderOptions
): void {
  const { width, height, shirtColour } = options;
  const scale = Math.max(0.62, Math.min(1, width / 960));
  const here = segmentAt(state.distance, state.config.course);
  const roadOffsetPx = state.distance / METERS_PER_PIXEL;

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  // Words are Hebrew; numbers are set back to ltr where they are drawn.
  ctx.direction = 'rtl';

  const answer = answerNow(state);

  // A miss shakes the whole scene. The HUD stays still so the numbers stay readable.
  ctx.save();
  if (answer && MISS_KINDS.includes(answer.kind) && answer.ageMs <= SHAKE_MS) {
    const fade = 1 - answer.ageMs / SHAKE_MS;
    ctx.translate(Math.sin(answer.ageMs / 14) * SHAKE_PX * scale * fade, 0);
  }

  drawSky(ctx, width, height, here.segment.weather);
  drawSkyline(ctx, width, height, roadOffsetPx);
  drawPavement(ctx, width, height, roadOffsetPx);

  const bands = buildRoad(state, width, height);
  drawRoad(ctx, bands, width, height, roadOffsetPx);
  drawWeather(ctx, width, height, here.segment.weather, roadOffsetPx);

  const runnerX = width * RUNNER_X_FRACTION;
  const groundY = roadYAt(bands, runnerX, height * ROAD_Y_FRACTION);
  drawRunner(ctx, state, runnerX, groundY, scale, answer, shirtColour);
  drawFootprints(ctx, state, runnerX, groundY, scale, answer);
  drawPopup(ctx, state, runnerX, groundY, scale, answer);
  ctx.restore();

  drawVignette(ctx, width, height, answer);
  drawBanner(ctx, state, width, height, scale);
  drawHud(ctx, state, width, scale, answer);

  ctx.restore();
}
