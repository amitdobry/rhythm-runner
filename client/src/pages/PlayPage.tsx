import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../player/PlayerContext';
import { configForPlatform, type Platform } from '../game/config';
import { summarize, type GameState } from '../game/engine';
import { detectPlatform, readOverride, rememberPlatform } from '../game/platform';
import { useGameLoop } from '../game/useGameLoop';

/** The screen you play on. Two layouts: keys on a PC, two pads on a phone. */
export function PlayPage() {
  const { player } = usePlayer();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // What the player asked for wins; otherwise we guess from the device.
  const [platform, setPlatform] = useState<Platform>(() => readOverride() ?? detectPlatform());
  const config = useMemo(() => configForPlatform(platform), [platform]);

  const { state, start, restart, pressFoot, countdown } = useGameLoop(canvasRef, config);

  const isMobile = platform === 'mobile';
  const running = state.phase === 'running';
  const showHeader = !(isMobile && running);

  const choosePlatform = (next: Platform) => {
    setPlatform(next);
    rememberPlatform(next);
  };

  return (
    <main className={isMobile ? 'play play-mobile' : 'play play-pc'}>
      {showHeader && (
        <header className="play-header">
          <Link to="/">&larr; Back</Link>
          <span className="muted">{player?.nickname}</span>
        </header>
      )}

      <div className="play-stage">
        <canvas ref={canvasRef} className="play-canvas" />

        {countdown !== null && (
          <div className="overlay overlay-countdown">
            <span className="countdown">{countdown}</span>
          </div>
        )}

        {state.phase === 'ready' && countdown === null && (
          <div className="overlay">
            <h2>Rhythm Runner</h2>
            <p className="overlay-lead">
              {isMobile
                ? 'Tap left, tap right, at the pace of the road. Ready?'
                : 'Left foot: ← or F. Right foot: → or J. Match the pace of the road. Ready?'}
            </p>
            <div className="platform-toggle">
              <button
                className={platform === 'pc' ? 'chosen' : ''}
                onClick={() => choosePlatform('pc')}
              >
                PC
              </button>
              <button
                className={platform === 'mobile' ? 'chosen' : ''}
                onClick={() => choosePlatform('mobile')}
              >
                Mobile
              </button>
            </div>
            <button className="primary" onClick={start}>
              Start
            </button>
          </div>
        )}

        {state.phase === 'finished' && (
          <div className="overlay">
            <h2>Run finished</h2>
            <ResultsTable state={state} />
            <div className="overlay-buttons">
              <button className="primary" onClick={restart}>
                Run again
              </button>
              <Link className="button-link" to="/">
                Home
              </Link>
            </div>
          </div>
        )}
      </div>

      {isMobile && (
        <div className="play-pads">
          <button
            className="pad"
            aria-label="Left foot"
            onPointerDown={(event) => {
              event.preventDefault();
              pressFoot('left');
            }}
          >
            <Footprint side="left" />
            <span>LEFT</span>
          </button>
          <button
            className="pad"
            aria-label="Right foot"
            onPointerDown={(event) => {
              event.preventDefault();
              pressFoot('right');
            }}
          >
            <Footprint side="right" />
            <span>RIGHT</span>
          </button>
        </div>
      )}
    </main>
  );
}

function ResultsTable({ state }: { state: GameState }) {
  const summary = summarize(state);
  return (
    <dl className="results">
      <div>
        <dt>Distance</dt>
        <dd>{summary.distance} m</dd>
      </div>
      <div>
        <dt>Score</dt>
        <dd>{summary.score}</dd>
      </div>
      <div>
        <dt>Best combo</dt>
        <dd>{summary.bestCombo}</dd>
      </div>
      <div>
        <dt>Accuracy</dt>
        <dd>{Math.round(summary.accuracy * 100)}%</dd>
      </div>
      <div>
        <dt>Played on</dt>
        <dd>{summary.platform === 'pc' ? 'PC' : 'Phone'}</dd>
      </div>
    </dl>
  );
}

/** A simple footprint drawn with shapes, so the pads need no pictures. */
function Footprint({ side }: { side: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 40 56"
      width="34"
      height="48"
      aria-hidden="true"
      style={{ transform: side === 'left' ? 'scaleX(-1)' : undefined }}
    >
      <ellipse cx="20" cy="34" rx="12" ry="18" fill="currentColor" />
      <circle cx="10" cy="11" r="4.5" fill="currentColor" />
      <circle cx="19" cy="7" r="4" fill="currentColor" />
      <circle cx="27" cy="9" r="3.5" fill="currentColor" />
    </svg>
  );
}
