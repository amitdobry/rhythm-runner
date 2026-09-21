import type { GameState } from '../engine';
import type { Segment } from '../config';
import { T } from '../../text/he';
import {
  BANNER_SHADOW,
  BANNER_TEXT,
  BAR_ENERGY,
  BAR_ENERGY_LOW,
  BAR_SPEED,
  BAR_TRACK,
  FONT,
  HUD_MUTED,
  HUD_PANEL,
  HUD_TEXT,
} from './palette';
import { clamp01 } from './shapes';
import { resultColour, type Answer } from './answers';

/** The numbers along the top, and the banner that names a new stretch of road. */

export const BANNER_MS = 1500;

export function drawBanner(
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
  const textWidth = ctx.measureText(terrainLabel).width;
  ctx.fillText(terrainLabel, width / 2, height * 0.3);
  drawSegmentIcon(
    ctx,
    segment,
    width / 2 - textWidth / 2 - 22 * scale,
    height * 0.3 - 10 * scale,
    26 * scale,
    BANNER_TEXT
  );

  if (weatherLabel) {
    ctx.font = `${20 * scale}px ${FONT}`;
    ctx.fillText(weatherLabel, width / 2, height * 0.3 + 30 * scale);
  }
  ctx.restore();
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  width: number,
  scale: number,
  answer: Answer | null
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
  ctx.direction = 'ltr';
  ctx.fillText(`${secondsLeft}`, pad, pad + 20 * scale);
  ctx.direction = 'rtl';
  ctx.fillStyle = HUD_MUTED;
  ctx.font = `${11 * scale}px ${FONT}`;
  drawClockIcon(ctx, pad + 7 * scale, pad + 30 * scale, 13 * scale, HUD_MUTED);
  ctx.fillStyle = HUD_TEXT;

  // speed and energy bars
  const barX = pad + 58 * scale;
  const barWidth = 120 * scale;
  // The speed bar answers the step in its colour, for as long as the popup lasts.
  const barFlash = answer && answer.through < 1 ? resultColour(answer.kind) : null;
  drawBar(
    ctx,
    barX,
    pad + 4 * scale,
    barWidth,
    9 * scale,
    state.speed / config.speed.max,
    barFlash ?? BAR_SPEED
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
  drawBoltIcon(ctx, barX + barWidth + 14 * scale, pad + 8 * scale, 14 * scale, BAR_SPEED);
  drawHeartIcon(
    ctx,
    barX + barWidth + 14 * scale,
    pad + 24 * scale,
    13 * scale,
    energyLow ? BAR_ENERGY_LOW : BAR_ENERGY
  );

  // combo and score
  const comboX = barX + barWidth + 66 * scale;
  ctx.fillStyle = HUD_TEXT;
  ctx.font = `bold ${18 * scale}px ${FONT}`;
  ctx.direction = 'ltr';
  ctx.fillText(`${state.combo} ×${multiplierOf(state)}`, comboX, pad + 14 * scale);
  ctx.font = `${16 * scale}px ${FONT}`;
  ctx.fillText(`${Math.round(state.score)}`, comboX, pad + 34 * scale);
  ctx.direction = 'rtl';
  ctx.fillStyle = HUD_MUTED;
  ctx.font = `${11 * scale}px ${FONT}`;
  ctx.fillText(T.combo, comboX + 74 * scale, pad + 14 * scale);
  ctx.fillText(T.score, comboX + 74 * scale, pad + 34 * scale);
}

export function drawBar(
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

export function multiplierOf(state: GameState): number {
  let multiplier = 1;
  for (const entry of state.config.comboMultipliers) {
    if (state.combo >= entry.fromCombo) multiplier = entry.multiplier;
  }
  return multiplier;
}

/* ---------------------------------------------------------------- icons */

/**
 * Small pictures drawn with paths, never with a font or an image.
 *
 * A clock, a bolt and a heart say "time", "speed" and "energy" to a child who
 * is busy watching the road and has no attention left for reading.
 */

export function drawClockIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  colour: string
): void {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(1, size * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - size * 0.3);
  ctx.moveTo(x, y);
  ctx.lineTo(x + size * 0.22, y + size * 0.14);
  ctx.stroke();
  ctx.restore();
}

export function drawBoltIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  colour: string
): void {
  ctx.save();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(x + size * 0.12, y - size * 0.5);
  ctx.lineTo(x - size * 0.25, y + size * 0.08);
  ctx.lineTo(x - size * 0.02, y + size * 0.08);
  ctx.lineTo(x - size * 0.14, y + size * 0.5);
  ctx.lineTo(x + size * 0.26, y - size * 0.1);
  ctx.lineTo(x + size * 0.02, y - size * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawHeartIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  colour: string
): void {
  const r = size * 0.26;
  ctx.save();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x - r * 0.9, y - r * 0.5, r, 0, Math.PI * 2);
  ctx.arc(x + r * 0.9, y - r * 0.5, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - r * 1.85, y - r * 0.25);
  ctx.lineTo(x + r * 1.85, y - r * 0.25);
  ctx.lineTo(x, y + size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** The picture that goes with a stretch of road, drawn left of its name. */
export function drawSegmentIcon(
  ctx: CanvasRenderingContext2D,
  segment: Segment,
  x: number,
  y: number,
  size: number,
  colour: string
): void {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = Math.max(1.5, size * 0.11);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (segment.terrain === 'uphill' || segment.terrain === 'downhill') {
    const up = segment.terrain === 'uphill';
    ctx.beginPath();
    ctx.moveTo(x - size * 0.45, y + (up ? size * 0.35 : -size * 0.35));
    ctx.lineTo(x + size * 0.45, y + (up ? size * 0.35 : -size * 0.35));
    ctx.lineTo(x, y + (up ? -size * 0.4 : size * 0.4));
    ctx.closePath();
    ctx.fill();
  } else if (segment.terrain === 'water') {
    for (let row = 0; row < 2; row += 1) {
      const wy = y - size * 0.15 + row * size * 0.35;
      ctx.beginPath();
      ctx.moveTo(x - size * 0.45, wy);
      ctx.quadraticCurveTo(x - size * 0.22, wy - size * 0.25, x, wy);
      ctx.quadraticCurveTo(x + size * 0.22, wy + size * 0.25, x + size * 0.45, wy);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(x - size * 0.45, y);
    ctx.lineTo(x + size * 0.45, y);
    ctx.stroke();
  }

  // The weather sits just above the ground it falls on.
  if (segment.weather === 'rain') {
    ctx.beginPath();
    ctx.ellipse(x, y - size * 0.55, size * 0.34, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let drop = -1; drop <= 1; drop += 1) {
      ctx.beginPath();
      ctx.moveTo(x + drop * size * 0.22, y - size * 0.3);
      ctx.lineTo(x + drop * size * 0.22 - size * 0.06, y - size * 0.12);
      ctx.stroke();
    }
  } else if (segment.weather === 'wind') {
    for (let line = 0; line < 3; line += 1) {
      const wy = y - size * 0.62 + line * size * 0.22;
      ctx.beginPath();
      ctx.moveTo(x - size * 0.45, wy);
      ctx.quadraticCurveTo(x + size * 0.1, wy - size * 0.16, x + size * 0.45, wy);
      ctx.stroke();
    }
  }
  ctx.restore();
}
