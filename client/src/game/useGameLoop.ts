// Owns the animation frame, the canvas size and every way a player can press a
// foot. The game rules live in engine.ts; this file only feeds them time and
// input and draws the result.

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Foot, GameConfig } from './config';
import { createGame, startRun, step, tick, type GameState, type Phase } from './engine';
import { createMetronome, type Metronome } from './audio';
import { render } from './render';

const STEP_MS = 10; // the simulation always moves in 10 ms steps
const MAX_CATCH_UP_MS = 250; // a hidden tab must not fast-forward the run
const COUNTDOWN_MS = 3000;

export interface GameLoop {
  phase: Phase;
  finished: GameState | null; // the last moment of a finished run, for the results
  start(): void;
  restart(): void;
  pressFoot(foot: Foot): void;
  countdown: number | null;
}

/**
 * Which foot a key press means.
 *
 * Matched on event.code, the PHYSICAL key, not event.key, the letter it
 * produces: on a Hebrew keyboard the F key reports "כ" and J reports "ח", so
 * matching letters left half our players unable to play. The letters stay as
 * a fallback for the rare browser that reports no code.
 */
export function footForKey(event: KeyboardEvent): Foot | null {
  const code = event.code;
  if (code === 'ArrowLeft' || code === 'KeyF') return 'left';
  if (code === 'ArrowRight' || code === 'KeyJ') return 'right';

  const key = event.key;
  if (key === 'ArrowLeft' || key === 'f' || key === 'F') return 'left';
  if (key === 'ArrowRight' || key === 'j' || key === 'J') return 'right';
  return null;
}

export interface GameLoopOptions {
  /** false while the practice overlay is on top and owns the input itself. */
  listenToInput?: boolean;
}

export function useGameLoop(
  canvasRef: RefObject<HTMLCanvasElement>,
  config: GameConfig,
  options: GameLoopOptions = {}
): GameLoop {
  const listenToInput = options.listenToInput ?? true;
  // React only hears about the run when something changes that the page draws
  // in HTML: the phase and the countdown. The canvas reads the live state from
  // the ref sixty times a second without re-rendering anything.
  const [phase, setPhase] = useState<Phase>('ready');
  const [finished, setFinished] = useState<GameState | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const configRef = useRef(config);
  const stateRef = useRef<GameState>(createGame(config));
  const phaseRef = useRef<Phase>('ready');
  const pendingFeet = useRef<Foot[]>([]);
  const metronomeRef = useRef<Metronome | null>(null);
  const unlockedRef = useRef(false);
  const countdownEndsAtRef = useRef<number | null>(null);
  const clickedDueRef = useRef<number | null>(null);
  const sizeRef = useRef({ width: 960, height: 540 });

  // A new platform means a new config, which means a new game.
  useEffect(() => {
    configRef.current = config;
    stateRef.current = createGame(config);
    phaseRef.current = 'ready';
    setPhase('ready');
    setFinished(null);
    setCountdown(null);
    countdownEndsAtRef.current = null;
    pendingFeet.current = [];
    clickedDueRef.current = null;
  }, [config]);

  /** Every way of pressing a foot ends here. */
  const pressFoot = useCallback((foot: Foot) => {
    if (!unlockedRef.current) {
      metronomeRef.current?.unlock();
      unlockedRef.current = true;
    }
    // The press waits in the queue and is judged at the next simulation step,
    // so it is measured against the moment it happened, not the next frame.
    pendingFeet.current.push(foot);
  }, []);

  const start = useCallback(() => {
    if (!unlockedRef.current) {
      metronomeRef.current?.unlock();
      unlockedRef.current = true;
    }
    metronomeRef.current?.cue('start'); // "ready?" while the countdown runs
    stateRef.current = createGame(configRef.current);
    phaseRef.current = 'ready';
    setPhase('ready');
    setFinished(null);
    pendingFeet.current = [];
    clickedDueRef.current = null;
    countdownEndsAtRef.current = performance.now() + COUNTDOWN_MS;
    setCountdown(3);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const metronome = createMetronome();
    metronomeRef.current = metronome;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      let cssWidth: number;
      let cssHeight: number;

      if (configRef.current.platform === 'mobile') {
        cssWidth = window.innerWidth;
        cssHeight = Math.round(window.innerHeight * 0.6);
      } else {
        const available = canvas.parentElement?.clientWidth ?? window.innerWidth;
        cssWidth = Math.min(960, available);
        cssHeight = Math.round((cssWidth * 9) / 16);
      }

      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      // Changing width resets the canvas, so the scale goes on afterwards.
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { width: cssWidth, height: cssHeight };
    };

    resize();

    const clickFor = (kind: GameState['lastEvent']) => {
      if (!kind) return;
      if (kind.kind === 'perfect') metronome.click('perfect');
      else if (kind.kind === 'good') metronome.click('good');
      else if (kind.kind === 'tooFast' || kind.kind === 'tooSlow' || kind.kind === 'wrongFoot') {
        metronome.click('miss');
      }
    };

    const drainInput = () => {
      while (pendingFeet.current.length > 0) {
        const foot = pendingFeet.current.shift();
        if (!foot) break;
        const before = stateRef.current;
        const after = step(before, foot);
        stateRef.current = after;
        if (after !== before) clickFor(after.lastEvent);
      }
    };

    const guideClick = () => {
      if (!configRef.current.paceGuideClick) return;
      const current = stateRef.current;
      if (current.phase !== 'running') return;
      if (current.timeMs >= current.nextDueMs && clickedDueRef.current !== current.nextDueMs) {
        clickedDueRef.current = current.nextDueMs;
        metronome.click('due');
      }
    };

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      render(ctx, stateRef.current, sizeRef.current);
    };

    let frame = 0;
    let lastFrameMs: number | null = null;
    let accumulator = 0;

    const loop = (now: number) => {
      frame = window.requestAnimationFrame(loop);

      const elapsed = lastFrameMs === null ? 0 : now - lastFrameMs;
      lastFrameMs = now;

      // 3 - 2 - 1 - go
      const countdownEndsAt = countdownEndsAtRef.current;
      if (countdownEndsAt !== null) {
        const remaining = countdownEndsAt - now;
        if (remaining <= 0) {
          countdownEndsAtRef.current = null;
          setCountdown(null);
          stateRef.current = startRun(stateRef.current);
          pendingFeet.current = [];
          clickedDueRef.current = null;
          accumulator = 0;
        } else {
          const shown = Math.ceil(remaining / 1000);
          setCountdown((current) => (current === shown ? current : shown));
        }
      }

      accumulator = Math.min(accumulator + elapsed, MAX_CATCH_UP_MS);
      while (accumulator >= STEP_MS) {
        accumulator -= STEP_MS;
        drainInput();
        stateRef.current = tick(stateRef.current, STEP_MS);
        guideClick();
      }

      // The only thing React needs from a frame is a change of phase.
      const current = stateRef.current;
      if (current.phase !== phaseRef.current) {
        phaseRef.current = current.phase;
        setPhase(current.phase);
        setFinished(current.phase === 'finished' ? current : null);
        // The loop plays only while the runner is running.
        metronome.music(current.phase === 'running');
      }

      draw();
    };

    frame = window.requestAnimationFrame(loop);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return; // holding a key is not a stream of steps
      const foot = footForKey(event);
      if (!foot) return;
      event.preventDefault();
      pressFoot(foot);
    };

    const onPointerDown = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pressFoot(event.clientX - rect.left < rect.width / 2 ? 'left' : 'right');
    };

    window.addEventListener('resize', resize);
    if (listenToInput) {
      window.addEventListener('keydown', onKeyDown);
      // On a phone the two pads below the canvas do this job instead.
      if (configRef.current.platform === 'pc') {
        canvas.addEventListener('pointerdown', onPointerDown);
      }
    }

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      metronome.music(false);
      metronome.dispose();
      metronomeRef.current = null;
      unlockedRef.current = false;
    };
  }, [canvasRef, config, listenToInput, pressFoot]);

  return { phase, finished, start, restart: start, pressFoot, countdown };
}
