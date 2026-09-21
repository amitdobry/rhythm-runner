import type { GameState } from '../engine';
import { BANNER_SHADOW, FONT, HUD_TEXT, RUNNER_SKIN, TAPE, TAPE_POLE } from './palette';

/**
 * The last five seconds.
 *
 * A run that simply stops is a run that never had an ending. So from 55
 * seconds the crowd arrives, a tape comes in from the right, and the numbers
 * count down - and the tape reaches the runner exactly as the clock runs out.
 *
 * The tape moves in TIME, not in distance: a tired runner going slowly must
 * still break it on the final second, or the ending would only work for the
 * fast.
 */

const FINISH_SECONDS = 5;
const DIGIT_POP_MS = 200;
const DIGIT_FROM = 1.4;
const SPLIT_MS = 400;
const SPECTATORS = 8;
const WAVE_MS = 250;

export function drawFinish(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  width: number,
  height: number,
  scale: number,
  runnerX: number,
  groundY: number
): void {
  if (state.phase === 'ready') return;

  const endMs = state.config.runSeconds * 1000;
  const startMs = endMs - FINISH_SECONDS * 1000;
  if (state.timeMs < startMs) return;

  // 0 when the tape appears at the right edge, 1 when it reaches the runner.
  const through = Math.min(1, (state.timeMs - startMs) / (FINISH_SECONDS * 1000));

  drawSpectators(ctx, state, width, height, scale, through);
  drawTape(ctx, state, width, scale, runnerX, groundY, through);
  drawCountdown(ctx, state, width, height, scale, endMs);
}

/** The whole seconds left, each one popping as it arrives. */
function drawCountdown(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  width: number,
  height: number,
  scale: number,
  endMs: number
): void {
  const leftMs = endMs - state.timeMs;
  if (leftMs <= 0) return;
  const digit = Math.ceil(leftMs / 1000);
  if (digit > FINISH_SECONDS) return;

  // How long this digit has been on screen, so it can spring into place.
  const intoDigit = 1000 - (leftMs % 1000 || 1000);
  const pop = Math.min(1, intoDigit / DIGIT_POP_MS);
  const size = 86 * scale * (DIGIT_FROM - (DIGIT_FROM - 1) * pop);

  ctx.save();
  ctx.direction = 'ltr';
  ctx.textAlign = 'center';
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.fillStyle = HUD_TEXT;
  ctx.shadowColor = BANNER_SHADOW;
  ctx.shadowBlur = 14;
  ctx.globalAlpha = 0.9;
  ctx.fillText(`${digit}`, width / 2, height * 0.34);
  ctx.restore();
}

/**
 * Two poles and a ribbon, arriving from the right. At the final moment the
 * ribbon parts and the halves blow away.
 */
function drawTape(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  width: number,
  scale: number,
  runnerX: number,
  groundY: number,
  through: number
): void {
  const x = width + 40 * scale - (width + 40 * scale - runnerX) * through;
  const poleHeight = 78 * scale;
  const ribbonY = groundY - poleHeight * 0.62;

  ctx.save();
  ctx.strokeStyle = TAPE_POLE;
  ctx.lineWidth = 5 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, groundY);
  ctx.lineTo(x, groundY - poleHeight);
  ctx.stroke();

  const broken = state.phase === 'finished';
  if (!broken) {
    ctx.strokeStyle = TAPE;
    ctx.lineWidth = 5 * scale;
    ctx.beginPath();
    ctx.moveTo(x - 60 * scale, ribbonY);
    ctx.lineTo(x + 60 * scale, ribbonY);
    ctx.stroke();
  } else {
    // The two halves flutter apart for a moment after it is broken.
    const sinceEnd = Math.max(0, state.timeMs - state.config.runSeconds * 1000);
    const away = Math.min(1, sinceEnd / SPLIT_MS);
    ctx.strokeStyle = TAPE;
    ctx.lineWidth = 5 * scale;
    ctx.globalAlpha = 1 - away;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(x + side * 40 * scale * away, ribbonY - 20 * scale * away);
      ctx.rotate(side * away * 0.6);
      ctx.beginPath();
      ctx.moveTo(-30 * scale, 0);
      ctx.lineTo(30 * scale, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

/** A row of little people on the pavement, waving as the runner comes in. */
function drawSpectators(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  width: number,
  height: number,
  scale: number,
  through: number
): void {
  const base = height * 0.64;
  const spacing = width / (SPECTATORS + 1);
  // They arrive with the tape rather than appearing all at once.
  const arrived = Math.min(1, through * 1.4);

  ctx.save();
  ctx.globalAlpha = arrived;
  ctx.strokeStyle = RUNNER_SKIN;
  ctx.fillStyle = RUNNER_SKIN;
  ctx.lineWidth = 3 * scale;
  ctx.lineCap = 'round';

  for (let i = 0; i < SPECTATORS; i += 1) {
    const x = spacing * (i + 1);
    // Every other one has their arms up, and they swap twice a second.
    const beat = Math.floor(state.timeMs / WAVE_MS) + i;
    const up = beat % 2 === 0;

    ctx.beginPath();
    ctx.arc(x, base - 20 * scale, 4 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, base - 16 * scale);
    ctx.lineTo(x, base - 4 * scale);
    ctx.moveTo(x, base - 4 * scale);
    ctx.lineTo(x - 4 * scale, base + 4 * scale);
    ctx.moveTo(x, base - 4 * scale);
    ctx.lineTo(x + 4 * scale, base + 4 * scale);
    // arms
    ctx.moveTo(x, base - 13 * scale);
    ctx.lineTo(x - 6 * scale, base - (up ? 22 : 8) * scale);
    ctx.moveTo(x, base - 13 * scale);
    ctx.lineTo(x + 6 * scale, base - (up ? 22 : 8) * scale);
    ctx.stroke();
  }
  ctx.restore();
}
