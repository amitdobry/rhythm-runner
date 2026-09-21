import type { GameState } from '../engine';
import {
  RUNNER_BODY,
  RUNNER_LEG,
  RUNNER_LEG_READY,
  RUNNER_STUMBLE,
  RUNNER_TRIM,
  STREAK_COLOUR,
} from './palette';
import { roundedRect, seeded } from './shapes';
import { lungeFor, type Answer } from './answers';

/** The runner: the only thing on screen that is a who rather than a what. */

export const STREAK_COUNT = 6;

/** Lines trailing off behind a runner who just nailed it. */
export function drawSpeedStreaks(
  ctx: CanvasRenderingContext2D,
  bodyHeight: number,
  scale: number,
  answer: Answer
): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - answer.through);
  ctx.strokeStyle = STREAK_COLOUR;
  ctx.lineWidth = 2 * scale;
  for (let i = 0; i < STREAK_COUNT; i += 1) {
    const y = -bodyHeight * (0.12 + 0.13 * i);
    const length = (16 + 16 * seeded(1, i)) * scale;
    const back = -(18 + 26 * answer.eased) * scale;
    ctx.beginPath();
    ctx.moveTo(back, y);
    ctx.lineTo(back - length, y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawRunner(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  x: number,
  groundY: number,
  scale: number,
  answer: Answer | null
): void {
  const stumbling = state.stumbleUntilMs !== null;
  const bodyHeight = 68 * scale;
  const bodyWidth = 25 * scale;
  const headRadius = 11 * scale;

  // A good step throws the runner forward and springs back; a bad one rocks
  // them backwards. This is the fastest way to feel that the press landed.
  const lunge = lungeFor(answer) * scale;

  ctx.save();
  ctx.translate(x + lunge, groundY);

  if (answer && answer.kind === 'perfect') drawSpeedStreaks(ctx, bodyHeight, scale, answer);
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
