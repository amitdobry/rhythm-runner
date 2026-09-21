// Everything the game says out loud.
//
// Short recordings answer the player's steps, one plays before the run, and a
// quiet loop keeps the run moving. The pace tick is still made by the browser
// itself, because it happens twice a second and a recording would wear thin.
//
// Two rules decide the shape of this file:
//
//  - A browser will not make a sound until the player has touched the page, so
//    unlock() is called on the first press. Only PLAYING needs that gesture;
//    downloading does not, so the recordings are fetched the moment the game
//    loads and are ready before anyone presses anything.
//  - Nothing here ever throws. A game with no sound is still a game.

export type ClickKind = 'due' | 'perfect' | 'good' | 'miss' | 'skipped' | 'stumble';

export interface Metronome {
  unlock(): void;
  click(kind: ClickKind): void;
  cue(name: CueName): void;
  music(on: boolean): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}

/** Remembered so a silenced demo stays silent on the next visit. */
const MUTED_KEY = 'rr_muted';

export function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false; // sound is on by default
  }
}

export function rememberMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
  } catch {
    // forgetting the choice is not worth an error
  }
}

/** One-off moments that bracket a run, rather than answering a step. */
export type CueName = 'start' | 'finish' | 'turbo';

/** Recordings live in client/public/sounds. */
const SOUND_URL: Record<string, string> = {
  perfect: '/sounds/perfect.mp3',
  good: '/sounds/good.mp3',
  miss: '/sounds/bad.mp3',
  start: '/sounds/start.mp3',
  stumble: '/sounds/stumble.mp3',
  finish: '/sounds/finish.mp3',
  sad: '/sounds/sad.mp3',
  turbo: '/sounds/turbo.mp3',
};
const MUSIC_URL = '/sounds/music.mp3';

// Quiet enough for a classroom, and quiet enough that the answers to the
// player's steps are still the things you notice.
const MUSIC_VOLUME = 0.12;
const EFFECT_VOLUME = 0.55;
const TICK_VOLUME = 0.06;

const TICK_HZ = 880;
const TICK_SECONDS = 0.04;

// If there is no turbo recording, the browser makes one: a rising sweep.
const SWEEP_FROM_HZ = 440;
const SWEEP_TO_HZ = 1320;
const SWEEP_SECONDS = 0.3;

// Three things can go wrong at almost the same moment. Only the worst of them
// is heard; the picture on screen still shows all of it.
const FAILURE_RANK: Record<string, number> = { stumble: 3, miss: 2, sad: 1 };
const FAILURE_GAP_MS = 300;

// A start cue longer than the countdown would run into the first step.
const START_CUE_MAX_S = 3;
const START_CUE_FADE_S = 0.2;

/** Does nothing at all. Used when the browser has no Web Audio. */
function silentMetronome(): Metronome {
  return {
    unlock() {},
    click() {},
    cue() {},
    music() {},
    setMuted() {},
    dispose() {},
  };
}

export function createMetronome(): Metronome {
  const AudioContextClass =
    typeof window === 'undefined'
      ? undefined
      : window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) return silentMetronome();

  let context: AudioContext | null = null;
  let musicElement: HTMLAudioElement | null = null;
  let alive = true;
  let muted = readMuted();
  let musicWanted = false;
  let lastFailureRank = 0;
  let lastFailureAt = 0;

  // Start downloading straight away: bytes need no permission, only sound does.
  const bytes = new Map<string, Promise<ArrayBuffer | null>>();
  for (const [name, url] of Object.entries(SOUND_URL)) {
    bytes.set(
      name,
      fetch(url)
        .then((response) => (response.ok ? response.arrayBuffer() : null))
        .catch(() => null)
    );
  }

  const decoded = new Map<string, AudioBuffer>();
  const decoding = new Map<string, Promise<AudioBuffer | null>>();

  /** The decoded recording, decoding it first if this is the first time. */
  const buffer = (name: string): Promise<AudioBuffer | null> => {
    const ready = decoded.get(name);
    if (ready) return Promise.resolve(ready);

    const started = decoding.get(name);
    if (started) return started;

    const job = (async () => {
      const raw = await bytes.get(name);
      if (!raw || !context) return null;
      try {
        // decodeAudioData empties the buffer it is given, so it gets a copy
        // and the original stays available for a second attempt.
        const audio = await context.decodeAudioData(raw.slice(0));
        decoded.set(name, audio);
        return audio;
      } catch {
        return null;
      } finally {
        decoding.delete(name);
      }
    })();

    decoding.set(name, job);
    return job;
  };

  /**
   * Play a recording. Waits for the sound system to wake up and for the file
   * to decode, rather than giving up - otherwise the very first sound of the
   * game, the one before the countdown, is always the one nobody hears.
   */
  const play = (name: string, volume: number, fadeAfterS?: number): void => {
    if (muted) return;
    void (async () => {
      try {
        if (!context) return;
        if (context.state !== 'running') await context.resume();
        const audio = await buffer(name);
        if (!audio || !context || !alive || muted) return;

        const source = context.createBufferSource();
        const gain = context.createGain();
        gain.gain.value = volume;
        source.buffer = audio;
        source.connect(gain);
        gain.connect(context.destination);

        const now = context.currentTime;
        // A recording longer than the countdown is faded out rather than
        // allowed to play over the runner's first step.
        if (fadeAfterS !== undefined && audio.duration > fadeAfterS) {
          gain.gain.setValueAtTime(volume, now + fadeAfterS - START_CUE_FADE_S);
          gain.gain.linearRampToValueAtTime(0.0001, now + fadeAfterS);
          source.start(now);
          source.stop(now + fadeAfterS);
        } else {
          source.start(now);
        }
      } catch {
        // a missed sound must never stop the game
      }
    })();
  };

  /**
   * One failure sound at a time. A stumble drowns a wrong step, which drowns a
   * missed beat, when they land within a breath of each other.
   */
  const playFailure = (name: string): void => {
    const rank = FAILURE_RANK[name] ?? 0;
    const now = Date.now();
    if (now - lastFailureAt < FAILURE_GAP_MS && rank < lastFailureRank) return;
    lastFailureRank = rank;
    lastFailureAt = now;
    play(name, name === 'sad' ? EFFECT_VOLUME : EFFECT_VOLUME);
  };

  /** The fallback turbo: a sweep upwards, made by the browser itself. */
  const playSweep = () => {
    if (muted || !context || context.state !== 'running') return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(SWEEP_FROM_HZ, now);
    oscillator.frequency.exponentialRampToValueAtTime(SWEEP_TO_HZ, now + SWEEP_SECONDS);
    gain.gain.setValueAtTime(TICK_VOLUME * 3, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + SWEEP_SECONDS);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + SWEEP_SECONDS);
  };

  /** The pace tick, made by the browser: rise fast, fall away. */
  const playTick = () => {
    if (muted || !context || context.state !== 'running') return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = TICK_HZ;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(TICK_VOLUME, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + TICK_SECONDS);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + TICK_SECONDS);
  };

  return {
    unlock() {
      try {
        if (!context) context = new AudioContextClass();
        if (context.state === 'suspended') void context.resume();
        // Decode now, while the player is still reading the overlay.
        for (const name of Object.keys(SOUND_URL)) void buffer(name);
      } catch {
        context = null; // no sound, but the game keeps running
      }
    },

    click(kind) {
      if (kind === 'due') playTick();
      else if (kind === 'skipped') playFailure('sad');
      else if (kind === 'stumble') playFailure('stumble');
      else if (kind === 'miss') playFailure('miss');
      else play(kind, EFFECT_VOLUME);
    },

    cue(name) {
      if (name === 'turbo') {
        // Use Amit's recording if it arrived; otherwise make the sound here.
        void (async () => {
          const recorded = await buffer('turbo');
          if (recorded) play('turbo', EFFECT_VOLUME);
          else playSweep();
        })();
        return;
      }
      play(name, EFFECT_VOLUME, name === 'start' ? START_CUE_MAX_S : undefined);
    },

    music(on) {
      musicWanted = on;
      try {
        if (!on || muted) {
          musicElement?.pause();
          return;
        }
        if (!musicElement) {
          // The loop is big, so it is only fetched when a run actually starts.
          musicElement = new Audio(MUSIC_URL);
          musicElement.loop = true;
          musicElement.volume = MUSIC_VOLUME;
        }
        void musicElement.play().catch(() => {});
      } catch {
        // no music, still a game
      }
    },

    setMuted(next) {
      muted = next;
      rememberMuted(next);
      if (muted) musicElement?.pause();
      else if (musicWanted) void musicElement?.play().catch(() => {});
    },

    dispose() {
      alive = false;
      try {
        musicElement?.pause();
        musicElement = null;
        void context?.close();
      } catch {
        // already closed
      }
      context = null;
      decoded.clear();
    },
  };
}
