// Everything the game says out loud.
//
// Four short recordings answer the player's steps, one plays before the run,
// and a quiet loop keeps the run moving. The pace tick is still made by the
// browser itself, because it happens up to twice a second and a recording
// would wear thin.
//
// Browsers refuse to make a sound until the player has touched the page, so
// unlock() is called on the first key press or tap. Nothing here ever throws:
// a game with no sound is still a game.

export type ClickKind = 'due' | 'perfect' | 'good' | 'miss';

export interface Metronome {
  unlock(): void;
  click(kind: ClickKind): void;
  cue(name: 'start'): void;
  music(on: boolean): void;
  dispose(): void;
}

/** Recordings live in client/public/sounds and are fetched on first use. */
const SOUND_URL: Record<string, string> = {
  perfect: '/sounds/perfect.mp3',
  good: '/sounds/good.mp3',
  miss: '/sounds/bad.mp3',
  start: '/sounds/start.mp3',
};
const MUSIC_URL = '/sounds/music.mp3';

// Quiet enough for a classroom, and quiet enough that the sound effects and
// the pace tick are still the things you notice.
const MUSIC_VOLUME = 0.12;
const EFFECT_VOLUME = 0.55;
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
  const buffers = new Map<string, AudioBuffer>();
  const loading = new Set<string>();

  /** Fetch and decode one recording, once. Failure just means silence. */
  const load = (name: string) => {
    const url = SOUND_URL[name];
    if (!url || !context || buffers.has(name) || loading.has(name)) return;
    loading.add(name);
    void fetch(url)
      .then((response) => response.arrayBuffer())
      .then((raw) => context?.decodeAudioData(raw))
      .then((decoded) => {
        if (decoded) buffers.set(name, decoded);
      })
      .catch(() => {})
      .finally(() => loading.delete(name));
  };

  const playBuffer = (name: string) => {
    const buffer = buffers.get(name);
    if (!context || !buffer || context.state !== 'running') {
      load(name); // not ready this time; be ready for the next one
      return;
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = EFFECT_VOLUME;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(context.destination);
    source.start();
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
        for (const name of Object.keys(SOUND_URL)) load(name);
      } catch {
        context = null; // no sound, but the game keeps running
      }
    },

    click(kind) {
      try {
        if (kind === 'due') playTick();
        else playBuffer(kind);
      } catch {
        // a missed sound must never stop the game
      }
    },

    cue(name) {
      try {
        playBuffer(name);
      } catch {
        // as above
      }
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
      try {
        musicElement?.pause();
        musicElement = null;
        void context?.close();
      } catch {
        // already closed
      }
      context = null;
      buffers.clear();
    },
  };
}
