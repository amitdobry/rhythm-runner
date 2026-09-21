import { describe, it, expect } from 'vitest';
import { TUTORIAL_FEET, createTutorial, tutorialPress } from './tutorial';

describe('the practice steps', () => {
  it('starts on the left foot, with nothing done and no nudge', () => {
    const state = createTutorial();
    expect(state.stepIndex).toBe(0);
    expect(state.expected).toBe('left');
    expect(state.done).toBe(false);
    expect(state.hint).toBe('none');
  });

  it('walks left, right, left, right and is then done', () => {
    let state = createTutorial();
    for (const foot of TUTORIAL_FEET) {
      expect(state.expected).toBe(foot);
      state = tutorialPress(state, foot);
    }
    expect(state.stepIndex).toBe(4);
    expect(state.done).toBe(true);
    expect(state.hint).toBe('none');
  });

  it('asks again on the wrong foot, without moving forward or failing', () => {
    const start = createTutorial();
    const wrong = tutorialPress(start, 'right');
    expect(wrong.stepIndex).toBe(0);
    expect(wrong.expected).toBe('left');
    expect(wrong.done).toBe(false);
    expect(wrong.hint).toBe('otherFoot');

    const right = tutorialPress(wrong, 'left');
    expect(right.stepIndex).toBe(1);
    expect(right.expected).toBe('right');
    expect(right.hint).toBe('none');
  });

  it('changes nothing once the practice is finished', () => {
    let state = createTutorial();
    for (const foot of TUTORIAL_FEET) state = tutorialPress(state, foot);
    expect(tutorialPress(state, 'left')).toBe(state);
    expect(tutorialPress(state, 'right')).toBe(state);
  });
});
