// A short click, made by the browser itself. No sound files to download.
// Browsers refuse to make a sound until the player has touched the page, so
// unlock() is called on the first key press or tap.

export interface Metronome {
  unlock(): void;
  click(kind: 'due' | 'perfect' | 'good' | 'miss'): void;
  dispose(): void;
}

/** One pitch per kind, so a child can hear what happened without looking. */
const PITCH_HZ: Record<'due' | 'perfect' | 'good' | 'miss', number> = {
  due: 880,
  perfect: 1320,
  good: 1046,
  miss: 220,
};

const TONE_SECONDS = 0.04; // 40 ms: a tick, not a beep
const VOLUME = 0.12; // quiet enough for a classroom

/** Does nothing at all. Used when the browser has no Web Audio. */
function silentMetronome(): Metronome {
  return {
    unlock() {},
    click() {},
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

  return {
    unlock() {
      try {
        if (!context) context = new AudioContextClass();
        if (context.state === 'suspended') void context.resume();
      } catch {
        context = null; // no sound, but the game keeps running
      }
    },

    click(kind) {
      try {
        if (!context || context.state !== 'running') return;
        const now = context.currentTime;

        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'square';
        oscillator.frequency.value = PITCH_HZ[kind];

        // Rise fast, fall away: that is what makes it a click and not a beep.
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(VOLUME, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + TONE_SECONDS);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + TONE_SECONDS);
      } catch {
        // A missed click must never stop the game.
      }
    },

    dispose() {
      try {
        void context?.close();
      } catch {
        // Already closed.
      }
      context = null;
    },
  };
}
