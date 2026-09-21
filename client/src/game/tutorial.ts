// The four practice steps a child takes before the first real run.
// Pure, like the rest of the game rules: no screen, no clock.
//
// There is no way to fail. A wrong foot only asks again, because the point is
// to teach "left, right, left, right", not to test anybody.

import type { Foot } from './config';

export const TUTORIAL_FEET: Foot[] = ['left', 'right', 'left', 'right'];

export interface TutorialState {
  stepIndex: number; // how many correct presses so far, 0 to 4
  expected: Foot;
  done: boolean;
  hint: 'none' | 'otherFoot';
}

export function createTutorial(): TutorialState {
  return { stepIndex: 0, expected: TUTORIAL_FEET[0], done: false, hint: 'none' };
}

export function tutorialPress(state: TutorialState, foot: Foot): TutorialState {
  if (state.done) return state;

  if (foot !== state.expected) {
    // Ask again with a nudge, and stay exactly where we were.
    return state.hint === 'otherFoot' ? state : { ...state, hint: 'otherFoot' };
  }

  const stepIndex = state.stepIndex + 1;
  return {
    stepIndex,
    expected: TUTORIAL_FEET[stepIndex] ?? state.expected,
    done: stepIndex === TUTORIAL_FEET.length,
    hint: 'none',
  };
}
