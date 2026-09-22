import { useEffect, useRef } from 'react';
import type { Foot, GameConfig } from '../game/config';
import { footForKey } from '../game/useGameLoop';
import type { PressTiming, TutorialState } from '../game/tutorial';
import { pressesNeeded } from '../game/tutorial';
import { T } from '../text/he';
import { Footprint } from './Footprint';

/**
 * The practice, on the real thing.
 *
 * The old overlay showed two still footprints, so a child practised against a
 * picture and then met the shrinking ring for the first time in a real run.
 * This one puts the actual target on the screen - the same red, yellow and
 * green bands, the same ring closing in - and asks them to hit it.
 *
 * The ring here is made of plain elements rather than canvas, because it has
 * to sit on top of the game and be readable while the words explain it.
 */

// The ring is slower while the idea is new, then real speed for the feet.
const SLOW_FACTOR = 1.5;
const BASE_RADIUS = 46; // px, at the ring's resting point

export function TutorialOverlay({
  state,
  config,
  onFoot,
  onNext,
  onSkip,
}: {
  state: TutorialState;
  config: GameConfig;
  onFoot: (foot: Foot, timing: PressTiming) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const startedAt = useRef(performance.now());

  const interval = config.baseStepIntervalMs * (state.stage === 'timing' ? SLOW_FACTOR : 1);
  const green = config.goodWindowMs; // the window that would really have scored

  // A new stage gets a fresh ring rather than inheriting the old phase.
  useEffect(() => {
    startedAt.current = performance.now();
  }, [state.stage]);

  // The ring closes in on the green, over and over, exactly as it does in the
  // game: it starts at twice the resting radius and reaches it when due.
  useEffect(() => {
    if (state.stage !== 'timing' && state.stage !== 'feet') return;
    let frame = 0;
    const loop = (now: number) => {
      frame = window.requestAnimationFrame(loop);
      const intoCycle = (now - startedAt.current) % interval;
      const radius = BASE_RADIUS * (1 + (interval - intoCycle) / interval);
      const ring = ringRef.current;
      if (ring) {
        ring.style.width = `${radius * 2}px`;
        ring.style.height = `${radius * 2}px`;
      }
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [state.stage, interval]);

  /** How far this press was from the nearest moment the ring was on green. */
  const judge = (): PressTiming => {
    const elapsed = performance.now() - startedAt.current;
    const intoCycle = elapsed % interval;
    // The due moments are the ends of cycles, so a press just after one is
    // late and a press just before the next is early.
    const offset = intoCycle > interval / 2 ? intoCycle - interval : intoCycle;
    if (Math.abs(offset) <= green) return 'green';
    return offset < 0 ? 'early' : 'late';
  };

  const press = (foot: Foot) => {
    if (state.stage !== 'timing' && state.stage !== 'feet') return;
    onFoot(foot, judge());
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const foot = footForKey(event);
      if (!foot) return;
      event.preventDefault();
      press(foot);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = overlayRef.current?.getBoundingClientRect();
    if (!box) return;
    press(event.clientX - box.left < box.width / 2 ? 'left' : 'right');
  };

  if (state.stage === 'road') return <RoadCard onNext={onNext} />;

  const teaching = state.stage === 'timing';
  const hint =
    state.hint === 'otherFoot'
      ? T.tutorialOtherFoot
      : state.hint === 'early'
        ? T.tutorialEarly
        : state.hint === 'late'
          ? T.tutorialLate
          : teaching
            ? T.tutorialWhenHint
            : T.tutorialFeetHint;

  return (
    <div className="overlay tutorial" ref={overlayRef} onPointerDown={onPointerDown}>
      <h2>{teaching ? T.tutorialWhenTitle : T.tutorialFeetTitle}</h2>
      <p className={`overlay-lead${state.hint === 'none' ? '' : ' nudge'}`}>{hint}</p>

      <Target
        ringRef={ringRef}
        interval={interval}
        green={green}
        perfect={config.perfectWindowMs}
      />

      {/* Physical left stays on the physical left, whichever way the words read. */}
      <div className="tutorial-feet">
        {(['left', 'right'] as const).map((foot) => (
          <span
            key={foot}
            className={`tutorial-foot${!teaching && state.expected === foot ? ' due' : ''}${
              teaching ? ' quiet' : ''
            }`}
          >
            <Footprint side={foot} />
            <span className="tutorial-foot-name">{foot === 'left' ? T.left : T.right}</span>
          </span>
        ))}
      </div>

      <Dots done={state.pressesDone} total={pressesNeeded(state.stage)} />

      <button
        className="quiet-link on-dark"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onSkip}
      >
        {T.skip}
      </button>
    </div>
  );
}

/** The same rings as the game draws, in the same order, out of plain elements. */
function Target({
  ringRef,
  interval,
  green,
  perfect,
}: {
  ringRef: React.RefObject<HTMLDivElement>;
  interval: number;
  green: number;
  perfect: number;
}) {
  const size = (ratio: number) => BASE_RADIUS * ratio * 2;
  return (
    <div className="tutorial-target" style={{ width: size(1.4), height: size(1.4) }}>
      <i className="zone red" style={{ width: size(1.4), height: size(1.4) }} />
      <i
        className="zone yellow"
        style={{ width: size(1 + green / interval), height: size(1 + green / interval) }}
      />
      <i
        className="zone green"
        style={{ width: size(1 + perfect / interval), height: size(1 + perfect / interval) }}
      />
      <i
        className="zone yellow"
        style={{ width: size(1 - perfect / interval), height: size(1 - perfect / interval) }}
      />
      <i
        className="zone red"
        style={{ width: size(1 - green / interval), height: size(1 - green / interval) }}
      />
      <div className="tutorial-ring" ref={ringRef} />
    </div>
  );
}

/** How many of this stage's presses are done. */
function Dots({ done, total }: { done: number; total: number }) {
  return (
    <div className="tutorial-dots" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < done ? 'on' : ''} />
      ))}
    </div>
  );
}

/** The last beat: why the pace keeps changing, and why that is not your problem. */
function RoadCard({ onNext }: { onNext: () => void }) {
  return (
    <div className="overlay tutorial">
      <h2>{T.tutorialRoadTitle}</h2>
      <div className="road-icons">
        <span>
          <svg viewBox="0 0 40 24" width="46" height="28" aria-hidden="true">
            <line x1="4" y1="12" x2="36" y2="12" stroke="currentColor" strokeWidth="3" />
          </svg>
          {T.tutorialRoadFlat}
        </span>
        <span>
          <svg viewBox="0 0 40 24" width="46" height="28" aria-hidden="true">
            <line x1="4" y1="20" x2="36" y2="5" stroke="currentColor" strokeWidth="3" />
          </svg>
          {T.tutorialRoadUphill}
        </span>
        <span>
          <svg viewBox="0 0 40 24" width="46" height="28" aria-hidden="true">
            <path
              d="M4 14 q6 -7 11 0 t11 0 t11 0"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            />
          </svg>
          {T.tutorialRoadWater}
        </span>
      </div>
      <p className="overlay-lead">{T.tutorialRoadBody}</p>
      <button className="primary" onClick={onNext}>
        {T.start}
      </button>
    </div>
  );
}
