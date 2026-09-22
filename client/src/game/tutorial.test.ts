import { describe, it, expect } from 'vitest';
import {
  FEET_PRESSES,
  TIMING_PRESSES,
  createTutorial,
  tutorialNext,
  tutorialPress,
  type TutorialState,
} from './tutorial';

/** Presses on the beat, on whichever foot is being asked for. */
function onBeat(state: TutorialState, times: number): TutorialState {
  let next = state;
  for (let i = 0; i < times; i += 1) next = tutorialPress(next, next.expected, 'green');
  return next;
}

describe('the practice', () => {
  it('starts by teaching when, not which foot', () => {
    const state = createTutorial();
    expect(state.stage).toBe('timing');
    expect(state.pressesDone).toBe(0);
    expect(state.hint).toBe('none');
    expect(state.done).toBe(false);
  });

  it('says early or late without moving on, and never fails', () => {
    const start = createTutorial();

    const early = tutorialPress(start, 'left', 'early');
    expect(early.hint).toBe('early');
    expect(early.pressesDone).toBe(0);

    const late = tutorialPress(early, 'left', 'late');
    expect(late.hint).toBe('late');
    expect(late.pressesDone).toBe(0);

    const good = tutorialPress(late, 'left', 'green');
    expect(good.pressesDone).toBe(1);
    expect(good.hint).toBe('none');
  });

  it('accepts either foot while it is only teaching timing', () => {
    // One idea at a time: the wrong foot is not wrong yet.
    const start = createTutorial();
    expect(tutorialPress(start, 'right', 'green').pressesDone).toBe(1);
  });

  it('moves on to feet once the timing is learned', () => {
    const state = onBeat(createTutorial(), TIMING_PRESSES);
    expect(state.stage).toBe('feet');
    expect(state.pressesDone).toBe(0);
    expect(state.expected).toBe('left');
  });

  it('now asks for the right foot, and alternates', () => {
    let state = onBeat(createTutorial(), TIMING_PRESSES);

    const wrongFoot = tutorialPress(state, 'right', 'green');
    expect(wrongFoot.hint).toBe('otherFoot');
    expect(wrongFoot.pressesDone).toBe(0);

    state = tutorialPress(state, 'left', 'green');
    expect(state.pressesDone).toBe(1);
    expect(state.expected).toBe('right');
  });

  it('still cares about timing while teaching feet', () => {
    const state = onBeat(createTutorial(), TIMING_PRESSES);
    const early = tutorialPress(state, 'left', 'early');
    expect(early.hint).toBe('early');
    expect(early.pressesDone).toBe(0);
  });

  it('reaches the card after the feet, and finishes from there', () => {
    let state = onBeat(createTutorial(), TIMING_PRESSES);
    state = onBeat(state, FEET_PRESSES);
    expect(state.stage).toBe('road');
    expect(state.done).toBe(false);

    // The card has nothing to press: presses do nothing at all.
    expect(tutorialPress(state, 'left', 'green')).toBe(state);

    const finished = tutorialNext(state);
    expect(finished.stage).toBe('done');
    expect(finished.done).toBe(true);
  });

  it('changes nothing once it is over', () => {
    let state = onBeat(createTutorial(), TIMING_PRESSES);
    state = tutorialNext(onBeat(state, FEET_PRESSES));
    expect(tutorialPress(state, 'left', 'green')).toBe(state);
    expect(tutorialNext(state)).toBe(state);
  });
});
