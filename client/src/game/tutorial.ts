import type { Foot } from './config';

/**
 * The practice before the first run.
 *
 * Everyone who tested the game said the same thing: they could not tell what
 * was going on. The old practice taught the easy half - which foot - and hid
 * the hard half behind an overlay, so the ring, the timing and the changing
 * pace all arrived at once the moment the run started.
 *
 * So it now teaches one idea at a time, in the order you can learn them:
 *
 *   1. WHEN.  The ring shrinks; press when it reaches the green. One foot, so
 *             there is nothing else to think about.
 *   2. WHICH. The same ring, now alternating left and right.
 *   3. WHY.   A card: the road sets the pace, and the ring always shows it.
 *
 * Nothing here can be failed. A press at the wrong moment or on the wrong foot
 * says so kindly and asks again.
 *
 * Pure, like the rest of the game rules: the overlay decides whether a press
 * was early, green or late and passes that in, so this file never reads a clock.
 */

export type TutorialStage = 'timing' | 'feet' | 'road' | 'done';

/** How a press landed against the ring. */
export type PressTiming = 'early' | 'green' | 'late';

export const TIMING_PRESSES = 3;
export const FEET_PRESSES = 4;

export interface TutorialState {
  stage: TutorialStage;
  pressesDone: number; // within the current stage
  expected: Foot;
  hint: 'none' | 'otherFoot' | 'early' | 'late';
  done: boolean;
}

export function createTutorial(): TutorialState {
  return { stage: 'timing', pressesDone: 0, expected: 'left', hint: 'none', done: false };
}

/** How many presses this stage asks for. The card asks for none. */
export function pressesNeeded(stage: TutorialStage): number {
  if (stage === 'timing') return TIMING_PRESSES;
  if (stage === 'feet') return FEET_PRESSES;
  return 0;
}

export function tutorialPress(
  state: TutorialState,
  foot: Foot,
  timing: PressTiming
): TutorialState {
  if (state.stage === 'road' || state.stage === 'done') return state;

  // Learning when to press comes first, so in that stage either foot will do.
  if (state.stage === 'feet' && foot !== state.expected) {
    return state.hint === 'otherFoot' ? state : { ...state, hint: 'otherFoot' };
  }

  if (timing !== 'green') {
    const hint = timing === 'early' ? 'early' : 'late';
    return state.hint === hint ? state : { ...state, hint };
  }

  const pressesDone = state.pressesDone + 1;
  if (pressesDone < pressesNeeded(state.stage)) {
    return {
      ...state,
      pressesDone,
      expected: state.stage === 'feet' ? other(state.expected) : state.expected,
      hint: 'none',
    };
  }

  // Stage finished: on to the next idea.
  if (state.stage === 'timing') {
    return { stage: 'feet', pressesDone: 0, expected: 'left', hint: 'none', done: false };
  }
  return { stage: 'road', pressesDone: 0, expected: 'left', hint: 'none', done: false };
}

/** Leaves the card at the end, which is the only part with nothing to press. */
export function tutorialNext(state: TutorialState): TutorialState {
  if (state.stage !== 'road') return state;
  return { ...state, stage: 'done', done: true };
}

function other(foot: Foot): Foot {
  return foot === 'left' ? 'right' : 'left';
}
