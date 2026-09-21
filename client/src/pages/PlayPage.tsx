import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../player/PlayerContext';
import { submitScore, type RunSummary, type SavedScore } from '../services/api';
import { configForPlatform, type Foot, type Platform } from '../game/config';
import { summarize } from '../game/engine';
import { detectPlatform, readOverride } from '../game/platform';
import { useGameLoop } from '../game/useGameLoop';
import { createTutorial, tutorialPress, type TutorialState } from '../game/tutorial';
import { T, fill, formatNumber } from '../text/he';
import { currentRef, track } from '../analytics/analytics';
import { Footprint } from '../components/Footprint';
import { TutorialOverlay } from '../components/TutorialOverlay';
import { WorkshopReveal } from '../components/WorkshopReveal';
import { BehindTheGame } from '../components/BehindTheGame';
import { NicknameForm } from '../components/NicknameForm';
import { MuteButton } from '../components/MuteButton';
import { Celebration } from '../components/Celebration';

const TUTORIAL_DONE_KEY = 'rr_tutorial_done';
const TUTORIAL_CHEER_MS = 700;
const REVEAL_DELAY_MS = 1200;
const COUNT_UP_MS = 600;

type Saved =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; result: SavedScore }
  | { status: 'failed' };

/** The screen you play on. Two layouts: keys on a PC, two pads on a phone. */
export function PlayPage() {
  const { player } = usePlayer();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // One game. The layout follows the device; ?platform= stays as a testing
  // aid and appears nowhere in the interface.
  const [platform] = useState<Platform>(() => readOverride() ?? detectPlatform());
  const config = useMemo(() => configForPlatform(platform), [platform]);

  const [tutorial, setTutorial] = useState<TutorialState | null>(() =>
    tutorialWasDone() ? null : createTutorial()
  );
  const practising = tutorial !== null;

  const { phase, finished, muted, setMuted, start, restart, pressFoot, countdown } = useGameLoop(
    canvasRef,
    config,
    { listenToInput: !practising }
  );

  const [saved, setSaved] = useState<Saved>({ status: 'idle' });
  const [askNickname, setAskNickname] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const [showBehind, setShowBehind] = useState(false);
  const pendingRun = useRef<RunSummary | null>(null);
  const sentRef = useRef(false);

  const isMobile = platform === 'mobile';
  const running = phase === 'running';
  const over = phase === 'finished';
  const showHeader = !(isMobile && running) && !practising;

  // The page itself must not move while a thumb is hunting for a pad.
  useEffect(() => {
    document.body.classList.add('playing');
    return () => document.body.classList.remove('playing');
  }, []);

  useEffect(() => {
    if (practising) track('tutorial_started');
  }, [practising]);

  // --- the practice ----------------------------------------------------

  const finishTutorial = useCallback(
    (completed: boolean) => {
      rememberTutorialDone();
      track(completed ? 'tutorial_completed' : 'tutorial_skipped');
      setTutorial(null);
      if (completed) start();
    },
    [start]
  );

  const handleFoot = useCallback(
    (foot: Foot) => {
      if (tutorial) {
        setTutorial((current) => (current ? tutorialPress(current, foot) : current));
        return;
      }
      pressFoot(foot);
    },
    [tutorial, pressFoot]
  );

  const tutorialDone = tutorial?.done ?? false;
  useEffect(() => {
    if (!tutorialDone) return;
    const timer = window.setTimeout(() => finishTutorial(true), TUTORIAL_CHEER_MS);
    return () => window.clearTimeout(timer);
  }, [tutorialDone, finishTutorial]);

  // --- counting the run ------------------------------------------------

  useEffect(() => {
    if (phase === 'running') track('run_started');
  }, [phase]);

  // A run somebody walked away from is worth knowing about, and how far in.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const startedAtRef = useRef(0);
  const runSecondsRef = useRef(config.runSeconds);
  runSecondsRef.current = config.runSeconds;
  useEffect(() => {
    if (phase === 'running' && startedAtRef.current === 0) startedAtRef.current = Date.now();
    if (phase !== 'running') startedAtRef.current = 0;
  }, [phase]);
  useEffect(() => {
    const report = () => {
      if (phaseRef.current !== 'running' || startedAtRef.current === 0) return;
      const seconds = (Date.now() - startedAtRef.current) / 1000;
      track('run_abandoned', {
        atSeconds: Math.min(runSecondsRef.current, Math.round(seconds)),
      });
    };
    window.addEventListener('pagehide', report);
    return () => {
      window.removeEventListener('pagehide', report);
      report();
    };
  }, []);

  // --- the results -----------------------------------------------------

  useEffect(() => {
    if (phase === 'ready') {
      sentRef.current = false;
      pendingRun.current = null;
      setSaved({ status: 'idle' });
      setAskNickname(false);
      setShowReveal(false);
      return;
    }
    if (phase !== 'finished' || finished === null || sentRef.current) return;
    sentRef.current = true;

    const summary = summarize(finished);
    pendingRun.current = summary;
    track('run_completed', {
      score: summary.score,
      distance: summary.distance,
      accuracy: Math.round(summary.accuracy * 100) / 100,
      bestCombo: summary.bestCombo,
      skipped: summary.counts.skipped,
      misses: summary.counts.miss,
      platform: summary.platform,
    });

    if (player) void send(summary, setSaved);
  }, [phase, finished, player]);

  // The reveal comes after the numbers have landed, never over them.
  useEffect(() => {
    if (phase !== 'finished') return;
    const timer = window.setTimeout(() => {
      setShowReveal(true);
      track('workshop_shown');
    }, REVEAL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return (
    <main
      className={[isMobile ? 'play play-mobile' : 'play play-pc', over ? 'play-over' : '']
        .join(' ')
        .trim()}
    >
      {showHeader && (
        <header className="play-header">
          <Link to="/">{T.home}</Link>
          <span className="play-header-right">
            <span className="muted">{player?.nickname}</span>
            <MuteButton muted={muted} onToggle={() => setMuted(!muted)} />
          </span>
        </header>
      )}

      <div className="play-stage">
        <canvas ref={canvasRef} className="play-canvas" />

        {tutorial && (
          <TutorialOverlay
            state={tutorial}
            onFoot={handleFoot}
            onSkip={() => finishTutorial(false)}
          />
        )}

        {countdown !== null && (
          <div className="overlay overlay-countdown">
            <span className="countdown num">{countdown}</span>
          </div>
        )}

        {!practising && phase === 'ready' && countdown === null && (
          <div className="overlay">
            <h2>{T.brand}</h2>
            <p className="overlay-lead">{isMobile ? T.mobileHowTo : T.pcHowTo}</p>
            <button className="primary" onClick={start}>
              {T.start}
            </button>
            <button className="quiet-link on-dark" onClick={() => setTutorial(createTutorial())}>
              {T.practiceAgain}
            </button>
            <MuteButton muted={muted} onToggle={() => setMuted(!muted)} />
          </div>
        )}

        {phase === 'finished' && finished !== null && (
          <div className="overlay overlay-results">
            <h2>{T.runFinished}</h2>
            {saved.status === 'saved' && saved.result.personalBest && (
              <>
                <p className="best-banner">
                  {saved.result.previousBest === null ? T.firstBest : T.newBest}
                </p>
                <Celebration />
              </>
            )}
            <Results summary={summarize(finished)} />

            <SaveStep
              saved={saved}
              signedIn={Boolean(player)}
              asking={askNickname}
              onAsk={() => {
                track('save_pressed');
                setAskNickname(true);
              }}
              onEntered={() => {
                setAskNickname(false);
                const summary = pendingRun.current;
                if (summary) void send(summary, setSaved);
              }}
            />

            <div className="overlay-buttons">
              <button
                className="primary big"
                onClick={() => {
                  track('run_again');
                  restart();
                }}
              >
                {T.runAgain}
              </button>
              <Link className="button-link" to="/">
                {T.home}
              </Link>
            </div>

            {showReveal && (
              <WorkshopReveal refCode={currentRef()} onCtaClick={() => track('workshop_clicked')} />
            )}

            <button
              className="quiet-link on-dark"
              onClick={() => {
                track('behind_opened');
                setShowBehind(true);
              }}
            >
              {T.behindLink}
            </button>
          </div>
        )}
      </div>

      {isMobile && !over && <p className="rotate-hint">{T.landscapeHint}</p>}

      {isMobile && !over && (
        <div className="play-pads">
          <button
            className="pad"
            aria-label={T.left}
            onPointerDown={(event) => {
              event.preventDefault();
              handleFoot('left');
            }}
          >
            <Footprint side="left" />
            <span>{T.left}</span>
          </button>
          <button
            className="pad"
            aria-label={T.right}
            onPointerDown={(event) => {
              event.preventDefault();
              handleFoot('right');
            }}
          >
            <Footprint side="right" />
            <span>{T.right}</span>
          </button>
        </div>
      )}

      {showBehind && <BehindTheGame onClose={() => setShowBehind(false)} />}
    </main>
  );
}

async function send(summary: RunSummary, setSaved: (saved: Saved) => void): Promise<void> {
  setSaved({ status: 'saving' });
  try {
    const result = await submitScore(summary);
    setSaved({ status: 'saved', result });
    track('score_saved');
    if (result.personalBest) track('personal_best');
  } catch {
    setSaved({ status: 'failed' });
  }
}

/** The numbers, with score and distance counting up so they feel earned. */
function Results({ summary }: { summary: RunSummary }) {
  const distance = useCountUp(summary.distance);
  const score = useCountUp(summary.score);

  return (
    <dl className="results">
      <div>
        <dt>{T.distance}</dt>
        <dd className="num">
          {formatNumber(distance)} {T.meters}
        </dd>
      </div>
      <div>
        <dt>{T.score}</dt>
        <dd className="num">{formatNumber(score)}</dd>
      </div>
      <div>
        <dt>{T.bestCombo}</dt>
        <dd className="num">{formatNumber(summary.bestCombo)}</dd>
      </div>
      <div>
        <dt>{T.accuracy}</dt>
        <dd className="num">{Math.round(summary.accuracy * 100)}%</dd>
      </div>
      <div>
        <dt>{T.device}</dt>
        <dd>{summary.platform === 'pc' ? T.playedOnPc : T.playedOnMobile}</dd>
      </div>
    </dl>
  );
}

/** Counts from 0 to the real number, slowing as it arrives. */
function useCountUp(target: number): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const startedAt = performance.now();
    const step = (now: number) => {
      const through = Math.min(1, (now - startedAt) / COUNT_UP_MS);
      const eased = 1 - (1 - through) * (1 - through); // ease out
      setValue(Math.round(target * eased));
      if (through < 1) frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [target]);

  return value;
}

function SaveStep({
  saved,
  signedIn,
  asking,
  onAsk,
  onEntered,
}: {
  saved: Saved;
  signedIn: boolean;
  asking: boolean;
  onAsk: () => void;
  onEntered: () => void;
}) {
  if (saved.status === 'saving') return <p className="score-note">{T.savingScore}</p>;
  if (saved.status === 'saved') {
    return (
      <p className="score-note">
        {fill(T.ranks, {
          week: formatNumber(saved.result.rankWeek),
          all: formatNumber(saved.result.rankAll),
        })}
      </p>
    );
  }
  if (saved.status === 'failed') return <p className="score-note muted">{T.scoreNotSaved}</p>;

  if (signedIn) return null; // already on its way to the board
  if (asking) {
    return (
      <div className="save-step">
        <NicknameForm onEntered={onEntered} />
      </div>
    );
  }
  return (
    <button className="save-button" onClick={onAsk}>
      {T.saveScore}
    </button>
  );
}

function tutorialWasDone(): boolean {
  try {
    return window.localStorage.getItem(TUTORIAL_DONE_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberTutorialDone(): void {
  try {
    window.localStorage.setItem(TUTORIAL_DONE_KEY, '1');
  } catch {
    // a child who practises twice has lost nothing
  }
}
