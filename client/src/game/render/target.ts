import { currentTargetIntervalMs, type GameEvent, type GameState } from '../engine';
import { oppositeFoot } from '../pace';
import { T } from '../../text/he';
import {
  FLASH_BAD,
  FLASH_GOOD,
  FLASH_PERFECT,
  FONT,
  FOOTPRINT,
  FOOTPRINT_DUE,
  RING,
} from './palette';
import { drawStars, resultColour, type Answer } from './answers';

/**
 * The two footprints and the dartboard under the one that is due: the rings
 * ARE the timing windows, and the white ring flying inwards reaches the middle
 * exactly when the step is due.
 */

export const FLASH_MS = 150;

export const FOOT_GAP = 46; // x scale: far enough apart that one target does not reach the other foot

// The radius the flying ring reaches at the due moment, and the middle of the
// green band. Everything else on the target is a ratio of it.
export const TARGET_BASE = 22;

export const STEP_EVENTS: GameEvent[] = ['perfect', 'good', 'tooFast', 'tooSlow', 'wrongFoot'];

/**
 * The two footprints, the dartboard under the one that is due, and the flash
 * after an event.
 */
export function drawFootprints(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  x: number,
  groundY: number,
  scale: number,
  answer: Answer | null
): void {
  const gap = FOOT_GAP * scale;
  const radius = 13 * scale;
  const y = groundY + 10 * scale;

  const flash = flashColour(state);
  const steppedFoot = oppositeFoot(state.expectedFoot);

  // The target goes down first, so the footprint sits on top of it.
  const dueX = state.expectedFoot === 'left' ? x - gap : x + gap;
  drawPaceTarget(ctx, state, dueX, y, scale);

  for (const foot of ['left', 'right'] as const) {
    const footX = foot === 'left' ? x - gap : x + gap;
    const isNext = foot === state.expectedFoot;

    ctx.fillStyle = flash && foot === steppedFoot ? flash : isNext ? FOOTPRINT_DUE : FOOTPRINT;
    ctx.beginPath();
    ctx.ellipse(footX, y, radius * 0.66, radius, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // The burst comes from the target the player was aiming at, which sat under
  // the foot that just stepped.
  const steppedX = steppedFoot === 'left' ? x - gap : x + gap;
  drawStars(ctx, state, steppedX, y, scale, answer, TARGET_BASE * scale);

  if (state.lastEvent?.kind === 'wrongFoot' && flash) {
    ctx.fillStyle = FLASH_BAD;
    ctx.font = `bold ${16 * scale}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(T.otherFoot, x, y + 46 * scale);
  }
}

/**
 * The pace target: a dartboard whose rings ARE the timing windows, and a
 * white ring flying inwards that reaches the middle exactly when the step is
 * due. Step when the ring is on green. Because the zones are drawn from the
 * windows and the current interval, they widen by themselves on a phone and
 * the ring visibly changes speed when the road changes.
 */
export function drawPaceTarget(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  x: number,
  y: number,
  scale: number
): void {
  const interval = currentTargetIntervalMs(state);
  const base = TARGET_BASE * scale;
  const perfectRatio = state.config.perfectWindowMs / interval;
  const goodRatio = state.config.goodWindowMs / interval;

  const outerRed = base * (1 + goodRatio) + 6 * scale;
  const event = state.lastEvent;
  const fresh =
    event !== null && state.timeMs >= event.atMs && state.timeMs - event.atMs <= FLASH_MS;

  if (fresh && event.kind === 'skipped') {
    // A missed step turns the whole target red for a moment.
    disc(ctx, x, y, outerRed, FLASH_BAD);
  } else {
    disc(ctx, x, y, outerRed, FLASH_BAD);
    disc(ctx, x, y, base * (1 + goodRatio), FLASH_GOOD);
    disc(ctx, x, y, base * (1 + perfectRatio), FLASH_PERFECT);
    disc(ctx, x, y, base * (1 - perfectRatio), FLASH_GOOD);
    disc(ctx, x, y, base * (1 - goodRatio), FLASH_BAD);
  }

  // Where the ring is now. After a step it freezes for a moment in the
  // result colour, at the radius it had when the foot landed.
  const stepped = fresh && STEP_EVENTS.includes(event.kind);
  const ringRadius = stepped
    ? base * (1 - (state.lastOffsetMs ?? 0) / interval)
    : base * (1 + (state.nextDueMs - state.timeMs) / interval);

  ctx.strokeStyle = stepped ? (resultColour(event.kind) ?? RING) : RING;
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, Math.min(ringRadius, outerRed + 18 * scale)), 0, Math.PI * 2);
  ctx.stroke();
}

export function disc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  colour: string
): void {
  if (radius <= 0) return;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function flashColour(state: GameState): string | null {
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
