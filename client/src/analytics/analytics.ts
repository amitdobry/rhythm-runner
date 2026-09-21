/**
 * A tiny anonymous funnel, ours alone.
 *
 * No third party, no tracking cookie, no personal data - and never the
 * nickname. All we keep is a random id for this browser, what happened, the
 * device kind and which leaflet the visitor came from. If sending fails,
 * nothing happens: counting must never get in the way of playing.
 */

import { detectPlatform, readOverride } from '../game/platform';

export type EventName =
  | 'landing_viewed'
  | 'play_pressed'
  | 'tutorial_started'
  | 'tutorial_completed'
  | 'tutorial_skipped'
  | 'run_started'
  | 'run_completed'
  | 'run_abandoned'
  | 'run_again'
  | 'save_pressed'
  | 'score_saved'
  | 'returning_entered'
  | 'leaderboard_viewed'
  | 'workshop_shown'
  | 'workshop_clicked'
  | 'behind_opened';

const SID_KEY = 'rr_sid';
const BATCH_KEY = 'rr_batch';
const SID_LENGTH = 20;
const SID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // private mode can refuse; that is fine
  }
}

function store(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // not being able to remember costs us one row in a count
  }
}

function makeSid(): string {
  const values = new Uint32Array(SID_LENGTH);
  crypto.getRandomValues(values);
  let sid = '';
  for (const value of values) sid += SID_ALPHABET[value % SID_ALPHABET.length];
  return sid;
}

/** The random name of this browser. Made once, kept, never linked to a person. */
export function sessionId(): string {
  const stored = readStored(SID_KEY);
  if (stored && /^[a-z0-9]{8,40}$/.test(stored)) return stored;
  const sid = makeSid();
  store(SID_KEY, sid);
  return sid;
}

/**
 * Which leaflet this visitor came from: ?b=1..6, remembered for the rest of
 * the visit. Anything else counts as no batch at all.
 */
export function currentBatch(): string {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('b');
    if (fromUrl && /^[1-6]$/.test(fromUrl)) {
      store(BATCH_KEY, fromUrl);
      return fromUrl;
    }
  } catch {
    // a malformed query string is not worth crashing over
  }
  const stored = readStored(BATCH_KEY);
  return stored && /^[1-6]$/.test(stored) ? stored : '';
}

function currentPlatform(): 'pc' | 'mobile' | 'unknown' {
  try {
    return readOverride() ?? detectPlatform();
  } catch {
    return 'unknown';
  }
}

export function track(name: EventName, data?: Record<string, number | string | boolean>): void {
  try {
    void fetch('/api/events', {
      method: 'POST',
      keepalive: true, // still sent when the page is closing
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sid: sessionId(),
        name,
        platform: currentPlatform(),
        batch: currentBatch(),
        ...(data ? { data } : {}),
      }),
    }).catch(() => {});
  } catch {
    // counting never breaks the game
  }
}
