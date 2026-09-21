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
  cue(name: 'start'): void;
  music(on: boolean): void;
  dispose(): void;
}

/** Recordings live in client/public/sounds. */
const SOUND_URL: Record<string, string> = {
  perfect: '/sounds/perfect.mp3',
  good: '/sounds/good.mp3',
  miss: '/sounds/bad.mp3',
  start: '/sounds/start.mp3',
  stumble: '/sounds/stumble.mp3',
};
const MUSIC_URL = '/sounds/music.mp3';

// Quiet enough for a classroom, and quiet enough that the answers to the
// player's steps are still the things you notice.
const MUSIC_VOLUME = 0.12;
const EFFECT_VOLUME = 0.55;
const SKIPPED_VOLUME = 0.28; // a missed beat is a quieter version of a wrong step
const TICK_VOLUME = 0.06;

const TICK_HZ = 880;
const TICK_SECONDS = 0.04;

/** Does nothing at all. Used when the browser has no Web Audio. */
function silentMetronome(): Metronome {
  return {
    unlock() {},
    click() {},
    cue() {},
    music() {},
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
  const play = (name: string, volume: number): void => {
    void (async () => {
      try {
        if (!context) return;
        if (context.state !== 'running') await context.resume();
        const audio = await buffer(name);
        if (!audio || !context || !alive) return;

        const source = context.createBufferSource();
        const gain = context.createGain();
        gain.gain.value = volume;
        source.buffer = audio;
        source.connect(gain);
        gain.connect(context.destination);
        source.start();
      } catch {
        // a missed sound must never stop the game
      }
    })();
  };

  /** The pace tick, made by the browser: rise fast, fall away. */
  const playTick = () => {
    if (!context || context.state !== 'running') return;
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
      else if (kind === 'skipped') play('miss', SKIPPED_VOLUME);
      else if (kind === 'stumble') play('stumble', EFFECT_VOLUME);
      else play(kind, EFFECT_VOLUME);
    },

    cue(name) {
      play(name, EFFECT_VOLUME);
    },

    music(on) {
      try {
        if (!on) {
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
