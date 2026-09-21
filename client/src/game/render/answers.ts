import type { GameState } from '../engine';
import type { GameEvent } from '../engine';
import { T } from '../../text/he';
import { FLASH_BAD, FLASH_GOOD, FLASH_PERFECT, FONT, HUD_MUTED, VIGNETTE_COLOUR } from './palette';
import { seeded } from './shapes';

/**
 * Every step is answered on screen: the runner lunges or rocks back, a word or
 * a number floats up, stars burst from the target, the scene shakes on a miss
 * and the edges go red when the runner falls.
 *
 * All of it is drawn from state alone - the event, its age, the distance - so
 * two frames of the same moment look exactly the same.
 */

// "Every step answered": how long the game reacts to a press, and how big.
export const ANSWER_MS = 220; // lunge, popup, bar flash

export const STAR_MS = 350; // the burst lives a little longer

export const SHAKE_MS = 120;

export const SHAKE_PX = 2;

export const LUNGE_PERFECT = 14;

export const LUNGE_GOOD = 7;

export const LEAN_BACK = 8;

export const POPUP_RISE = 30;

export const POPUP_SIZE = 19;

export const STARS_PERFECT = 8;

export const STARS_GOOD = 3;

export const STAR_MIN = 4;

export const STAR_MAX = 7;

export const STAR_REACH = 54; // how far a star travels before it fades out

/** What the game is saying about the step that just happened. */
export interface Answer {
  kind: GameEvent;
  ageMs: number;
  through: number; // 0..1 across ANSWER_MS
  eased: number; // ease-out of through
}

export function answerNow(state: GameState): Answer | null {
  const event = state.lastEvent;
  if (!event) return null;
  const ageMs = state.timeMs - event.atMs;
  if (ageMs < 0 || ageMs > STAR_MS) return null;
  const through = Math.min(1, ageMs / ANSWER_MS);
  return { kind: event.kind, ageMs, through, eased: 1 - (1 - through) * (1 - through) };
}

export const MISS_KINDS: GameEvent[] = ['tooFast', 'tooSlow', 'wrongFoot'];

/** How far forward (or back) the runner is thrown, in unscaled pixels. */
export function lungeFor(answer: Answer | null): number {
  if (!answer) return 0;
  const amount =
    answer.kind === 'perfect'
      ? LUNGE_PERFECT
      : answer.kind === 'good'
        ? LUNGE_GOOD
        : MISS_KINDS.includes(answer.kind)
          ? -LEAN_BACK
          : 0;
  return amount * Math.sin(Math.PI * answer.through);
}

export function resultColour(kind: GameEvent): string | null {
  if (kind === 'perfect') return FLASH_PERFECT;
  if (kind === 'good') return FLASH_GOOD;
  if (kind === 'tooFast' || kind === 'tooSlow' || kind === 'wrongFoot') return FLASH_BAD;
  return null;
}

/** A burst of small stars from the target's rim: eight for a perfect step, three for a good one. */
export function drawStars(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  x: number,
  y: number,
  scale: number,
  answer: Answer | null,
  rimRadius: number
): void {
  if (!answer) return;
  const count = answer.kind === 'perfect' ? STARS_PERFECT : answer.kind === 'good' ? STARS_GOOD : 0;
  if (count === 0) return;

  const seed = state.lastEvent?.atMs ?? 0;
  const life = Math.min(1, answer.ageMs / STAR_MS);
  const eased = 1 - (1 - life) * (1 - life); // fast at first, then slowing
  const rim = rimRadius;

  ctx.save();
  for (let i = 0; i < count; i += 1) {
    // Upward bias, so the burst reads as celebration rather than an explosion.
    const angle = -Math.PI / 2 + (seeded(seed, i) - 0.5) * Math.PI * 1.2;
    const reach = rim + STAR_REACH * scale * eased;
    const size = (STAR_MIN + (STAR_MAX - STAR_MIN) * seeded(seed, i + 40)) * scale;
    ctx.globalAlpha = Math.max(0, 1 - life);
    ctx.fillStyle = i % 2 === 0 ? FLASH_GOOD : '#ffffff';
    drawStar(ctx, x + Math.cos(angle) * reach, y + Math.sin(angle) * reach, size);
  }
  ctx.restore();
}

export function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number
): void {
  ctx.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const r = point % 2 === 0 ? radius : radius * 0.45;
    const angle = (Math.PI / 5) * point - Math.PI / 2;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (point === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/** The word or number that floats up over the runner's head. */
export function drawPopup(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  x: number,
  groundY: number,
  scale: number,
  answer: Answer | null
): void {
  if (!answer || answer.through >= 1) return;
  const speed = state.config.speed;

  let text: string | null = null;
  let colour = FLASH_BAD;
  let numeric = false;

  if (answer.kind === 'perfect') {
    text = `+${speed.perfectBoost}`;
    colour = FLASH_PERFECT;
    numeric = true;
  } else if (answer.kind === 'good') {
    text = `+${speed.goodBoost}`;
    colour = FLASH_GOOD;
    numeric = true;
  } else if (answer.kind === 'tooFast') text = T.tooFast;
  else if (answer.kind === 'tooSlow') text = T.tooSlow;
  else if (answer.kind === 'wrongFoot') text = T.otherFoot;
  else if (answer.kind === 'skipped') {
    text = T.popupSkipped;
    colour = HUD_MUTED;
  } else if (answer.kind === 'stumble') text = T.popupStumble;

  if (!text) return;

  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - answer.through);
  ctx.fillStyle = colour;
  ctx.font = `bold ${POPUP_SIZE * scale}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.direction = numeric ? 'ltr' : 'rtl';
  ctx.fillText(text, x, groundY - 96 * scale - POPUP_RISE * scale * answer.eased);
  ctx.restore();
}

/** Red creeping in from the edges when the runner goes down. */
export function drawVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  answer: Answer | null
): void {
  if (!answer || answer.kind !== 'stumble' || answer.through >= 1) return;
  const edge = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.25,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72
  );
  edge.addColorStop(0, 'rgba(232, 80, 58, 0)');
  edge.addColorStop(1, VIGNETTE_COLOUR);

  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - answer.through);
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
