import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../player/PlayerContext';
import { submitScore } from '../services/api';
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

  const { phase, finished, start, restart, pressFoot, countdown } = useGameLoop(canvasRef, config);

  // The run is sent once, when it ends. A failure is quiet: it must never
  // stand between a child and the next run.
  const [saved, setSaved] = useState<Saved>({ status: 'idle' });
  const sentRef = useRef(false);

  useEffect(() => {
    if (phase === 'ready') {
      sentRef.current = false;
      setSaved({ status: 'idle' });
      return;
    }
    if (phase !== 'finished' || finished === null || sentRef.current) return;
    sentRef.current = true;
    setSaved({ status: 'saving' });
    submitScore(summarize(finished))
      .then((result) => setSaved({ status: 'saved', rank: result.rank }))
      .catch(() => setSaved({ status: 'failed' }));
  }, [phase, finished]);

  // While the game is open the page itself must not move: no scrolling and
  // no pull-to-refresh when a thumb misses a pad.
  useEffect(() => {
    document.body.classList.add('playing');
    return () => document.body.classList.remove('playing');
  }, []);

  const isMobile = platform === 'mobile';
  const running = phase === 'running';
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

        {phase === 'ready' && countdown === null && (
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

        {phase === 'finished' && finished !== null && (
          <div className="overlay">
            <h2>Run finished</h2>
            <ResultsTable state={finished} />
            <ScoreNote saved={saved} platform={platform} />
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

      {isMobile && <p className="rotate-hint">Hold your phone upright to play.</p>}

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

type Saved =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; rank: number }
  | { status: 'failed' };

function ScoreNote({ saved, platform }: { saved: Saved; platform: Platform }) {
  if (saved.status === 'saving') return <p className="score-note">Saving your score...</p>;
  if (saved.status === 'saved') {
    return (
      <p className="score-note">
        Rank #{saved.rank} on {platform === 'pc' ? 'PC' : 'mobile'}
      </p>
    );
  }
  if (saved.status === 'failed') return <p className="score-note muted">Score not saved</p>;
  return null;
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
