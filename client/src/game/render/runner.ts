import { currentTargetIntervalMs, type GameState } from '../engine';
import {
  FOOT_READY,
  RUNNER_FACE,
  RUNNER_SHADOW,
  RUNNER_SHOE,
  RUNNER_SHORTS,
  RUNNER_SKIN,
  RUNNER_STUMBLE,
  STREAK_COLOUR,
  SWEAT,
} from './palette';
import { roundedRect, seeded } from './shapes';
import { lungeFor, type Answer } from './answers';

/**
 * The runner: the only thing on screen that is a who rather than a what.
 *
 * Built from circles, rounded rectangles and lines, in units of the runner
 * scale so the same drawing fits a phone and a desktop. The stride is driven
 * by how far the runner has travelled, never by the clock, so the legs always
 * match the road - and slow down with it.
 */

// Every measurement below is multiplied by the runner scale.
const HEAD_RADIUS = 9;
const SHIRT_WIDTH = 14;
const SHIRT_HEIGHT = 20;
const HIP_Y = -22; // where the legs start, measured up from the road
const SHOULDER_Y = -38;
const NECK_Y = -42;
const HEAD_Y = -52;
const LEG_SWING = 11;
const ARM_SWING = 9;
const SHOE_WIDTH = 9;
const SHOE_HEIGHT = 4;

const SQUASH_MS = 120;
const STRETCH_TALLER = 0.08; // a perfect step
const SQUASH_SHORTER = 0.08; // any miss
const NARROWER = 0.06;

export const STREAK_COUNT = 6;

/** Lines trailing off behind a runner who just nailed it. */
export function drawSpeedStreaks(
  ctx: CanvasRenderingContext2D,
  bodyHeight: number,
  scale: number,
  answer: Answer,
  count = STREAK_COUNT
): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - answer.through);
  ctx.strokeStyle = STREAK_COLOUR;
  ctx.lineWidth = 2 * scale;
  for (let i = 0; i < count; i += 1) {
    const y = -bodyHeight * (0.12 + 0.13 * (i % STREAK_COUNT));
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
  answer: Answer | null,
  shirtColour: string
): void {
  const stumbling = state.stumbleUntilMs !== null;
  const u = scale; // one unit
  const lunge = lungeFor(answer) * scale;

  drawShadow(ctx, x + lunge, groundY, state.speed, u);

  ctx.save();
  ctx.translate(x + lunge, groundY);
  if (stumbling) ctx.rotate((20 * Math.PI) / 180);

  // A step throws the whole body out of shape for a moment, then it settles.
  const shape = squashAndStretch(answer);
  ctx.scale(shape.wide, shape.tall);

  if (answer && answer.kind === 'perfect') drawSpeedStreaks(ctx, 60 * u, scale, answer);

  const phase = stridePhase(state);
  const forward = state.expectedFoot;

  // Back arm and back leg first, so the front ones overlap them.
  drawArm(ctx, u, -Math.sin(phase), shirtColour, true);
  drawLeg(ctx, u, -Math.sin(phase), stumbling, forward === 'right');

  drawBody(ctx, u, shirtColour, stumbling);

  drawArm(ctx, u, Math.sin(phase), shirtColour, false);
  drawLeg(ctx, u, Math.sin(phase), stumbling, forward === 'left');

  drawHead(ctx, state, u, stumbling);

  ctx.restore();
}

/** Flatter and longer the faster the runner goes. */
function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  speed: number,
  u: number
): void {
  const stretch = Math.min(1, speed / 20);
  ctx.save();
  ctx.fillStyle = RUNNER_SHADOW;
  ctx.beginPath();
  ctx.ellipse(
    x,
    groundY + 3 * u,
    (13 + 9 * stretch) * u,
    (4 - 1.5 * stretch) * u,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();
}

/**
 * How far through a stride the runner is. One stride per step interval, so at
 * a slow water pace the legs move slowly and on a downhill they hurry.
 */
function stridePhase(state: GameState): number {
  const interval = currentTargetIntervalMs(state);
  const strideMeters = Math.max(0.5, (state.speed * interval) / 1000);
  return (state.distance / strideMeters) * Math.PI;
}

function squashAndStretch(answer: Answer | null): { wide: number; tall: number } {
  if (!answer || answer.ageMs > SQUASH_MS) return { wide: 1, tall: 1 };
  const settling = 1 - answer.ageMs / SQUASH_MS;

  if (answer.kind === 'perfect') {
    return { wide: 1 - NARROWER * settling, tall: 1 + STRETCH_TALLER * settling };
  }
  if (answer.kind === 'good') {
    return { wide: 1 - (NARROWER / 2) * settling, tall: 1 + (STRETCH_TALLER / 2) * settling };
  }
  if (answer.kind === 'tooFast' || answer.kind === 'tooSlow' || answer.kind === 'wrongFoot') {
    return { wide: 1 + NARROWER * settling, tall: 1 - SQUASH_SHORTER * settling };
  }
  return { wide: 1, tall: 1 };
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  u: number,
  shirtColour: string,
  stumbling: boolean
): void {
  // shorts
  ctx.fillStyle = stumbling ? RUNNER_STUMBLE : RUNNER_SHORTS;
  roundedRect(ctx, (-SHIRT_WIDTH / 2) * u, HIP_Y * u - 2 * u, SHIRT_WIDTH * u, 9 * u, 3 * u);
  ctx.fill();

  // shirt
  ctx.fillStyle = stumbling ? RUNNER_STUMBLE : shirtColour;
  roundedRect(
    ctx,
    (-SHIRT_WIDTH / 2) * u,
    (HIP_Y - SHIRT_HEIGHT) * u,
    SHIRT_WIDTH * u,
    SHIRT_HEIGHT * u,
    5 * u
  );
  ctx.fill();

  // neck
  ctx.fillStyle = RUNNER_SKIN;
  ctx.fillRect(-2 * u, NECK_Y * u, 4 * u, 5 * u);
}

function drawArm(
  ctx: CanvasRenderingContext2D,
  u: number,
  swing: number,
  shirtColour: string,
  behind: boolean
): void {
  const handX = swing * ARM_SWING * u;
  const handY = (HIP_Y - 4) * u - Math.abs(swing) * 2 * u;
  // the elbow bends outwards, halfway down the swing
  const elbowX = handX * 0.55;
  const elbowY = ((SHOULDER_Y + HIP_Y) / 2) * u;

  ctx.save();
  ctx.strokeStyle = behind ? shade(shirtColour) : shirtColour;
  ctx.lineWidth = 4 * u;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, SHOULDER_Y * u);
  ctx.quadraticCurveTo(elbowX, elbowY, handX, handY);
  ctx.stroke();

  // the hand
  ctx.fillStyle = RUNNER_SKIN;
  ctx.beginPath();
  ctx.arc(handX, handY, 2.4 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLeg(
  ctx: CanvasRenderingContext2D,
  u: number,
  swing: number,
  stumbling: boolean,
  isDueFoot: boolean
): void {
  const footX = swing * LEG_SWING * u;
  // the foot lifts as it swings forward
  const lift = Math.max(0, swing) * 5 * u;
  const footY = -lift;
  const kneeX = footX * 0.5;
  const kneeY = (HIP_Y * u + footY) / 2 + 2 * u;

  ctx.save();
  ctx.strokeStyle = stumbling ? RUNNER_STUMBLE : RUNNER_SKIN;
  ctx.lineWidth = 4.5 * u;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, HIP_Y * u);
  ctx.lineTo(kneeX, kneeY);
  ctx.lineTo(footX, footY);
  ctx.stroke();

  // the shoe, lit up when this is the foot that must land next
  ctx.fillStyle = stumbling ? RUNNER_STUMBLE : isDueFoot ? FOOT_READY : RUNNER_SHOE;
  roundedRect(ctx, footX - SHOE_WIDTH * 0.4 * u, footY, SHOE_WIDTH * u, SHOE_HEIGHT * u, 1.5 * u);
  ctx.fill();
  ctx.restore();
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  u: number,
  stumbling: boolean
): void {
  const y = HEAD_Y * u;

  ctx.fillStyle = stumbling ? RUNNER_STUMBLE : RUNNER_SKIN;
  ctx.beginPath();
  ctx.arc(0, y, HEAD_RADIUS * u, 0, Math.PI * 2);
  ctx.fill();

  drawFace(ctx, state, u, y, stumbling);
}

/**
 * The face says what the numbers say, faster. Worst news first: a fall beats
 * being tired, being tired beats being pleased with yourself.
 */
function drawFace(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  u: number,
  headY: number,
  stumbling: boolean
): void {
  const eyeX = 3.2 * u;
  const eyeY = headY - 1.5 * u;
  const mouthY = headY + 3.5 * u;

  ctx.save();
  ctx.strokeStyle = RUNNER_FACE;
  ctx.fillStyle = RUNNER_FACE;
  ctx.lineWidth = 1.2 * u;
  ctx.lineCap = 'round';

  if (stumbling) {
    // dizzy: two little spirals and an open mouth
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * eyeX, eyeY, 2 * u, 0, Math.PI * 1.7);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, mouthY, 2 * u, 0, Math.PI * 2);
    ctx.stroke();
  } else if (state.energy < 30) {
    // tired: wide eyes, a flat mouth and two drops of sweat
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * eyeX, eyeY, 1.9 * u, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(side * eyeX - 2 * u, eyeY - 4 * u);
      ctx.lineTo(side * eyeX + 2 * u, eyeY - 4.6 * u);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-2.5 * u, mouthY);
    ctx.lineTo(2.5 * u, mouthY);
    ctx.stroke();

    ctx.fillStyle = SWEAT;
    ctx.beginPath();
    ctx.arc(-HEAD_RADIUS * u - 1.5 * u, headY - 3 * u, 1.6 * u, 0, Math.PI * 2);
    ctx.arc(HEAD_RADIUS * u + 1.5 * u, headY - 1 * u, 1.3 * u, 0, Math.PI * 2);
    ctx.fill();
  } else if (state.combo >= 10) {
    // pleased: happy arcs and an open grin
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * eyeX, eyeY + 0.5 * u, 1.8 * u, Math.PI, 0);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, mouthY - 1 * u, 3 * u, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else {
    // getting on with it
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * eyeX, eyeY, 1.2 * u, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, mouthY - 1.5 * u, 2.4 * u, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

/** A darker version of the shirt, for the arm on the far side. */
function shade(colour: string): string {
  if (!colour.startsWith('#') || colour.length !== 7) return colour;
  const dim = (from: number) =>
    Math.round(parseInt(colour.slice(from, from + 2), 16) * 0.72)
      .toString(16)
      .padStart(2, '0');
  return `#${dim(1)}${dim(3)}${dim(5)}`;
}
