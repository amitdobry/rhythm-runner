import { useEffect, useRef } from 'react';
import type { Foot } from '../game/config';
import type { TutorialState } from '../game/tutorial';
import { footForKey } from '../game/useGameLoop';
import { T } from '../text/he';
import { Footprint } from './Footprint';

/**
 * Four practice steps before the first run: left, right, left, right.
 *
 * It cannot be failed. A wrong foot only asks again, because a child who has
 * just scanned a leaflet in a corridor must not meet a failure in their first
 * ten seconds. While it is up, it owns the input; the game loop listens to
 * nothing.
 */
export function TutorialOverlay({
  state,
  onFoot,
  onSkip,
}: {
  state: TutorialState;
  onFoot: (foot: Foot) => void;
  onSkip: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const foot = footForKey(event);
      if (!foot) return;
      event.preventDefault();
      onFoot(foot);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onFoot]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = overlayRef.current?.getBoundingClientRect();
    if (!box) return;
    onFoot(event.clientX - box.left < box.width / 2 ? 'left' : 'right');
  };

  return (
    <div className="overlay tutorial" ref={overlayRef} onPointerDown={onPointerDown}>
      <h2>{state.done ? T.tutorialDone : T.tutorialTitle}</h2>
      {!state.done && (
        <p className="overlay-lead">
          {state.hint === 'otherFoot' ? T.tutorialOtherFoot : T.tutorialHint}
        </p>
      )}

      {/* Physical left stays on the physical left, whichever way the words read. */}
      <div className="tutorial-feet">
        {(['left', 'right'] as const).map((foot) => (
          <span
            key={foot}
            className={`tutorial-foot${!state.done && state.expected === foot ? ' due' : ''}`}
          >
            <Footprint side={foot} />
            <span className="tutorial-foot-name">{foot === 'left' ? T.left : T.right}</span>
          </span>
        ))}
      </div>

      {!state.done && (
        <button
          className="quiet-link on-dark"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onSkip}
        >
          {T.skip}
        </button>
      )}
    </div>
  );
}
