// Is this a PC or a phone? A thumb on glass is slower than a finger on a key,
// so the two get different timing windows and different leaderboards.
// This file is allowed to touch the browser; the game logic is not.

import type { Platform } from './config';

const STORAGE_KEY = 'rr_platform';

function isPlatform(value: string | null): value is Platform {
  return value === 'pc' || value === 'mobile';
}

/** What the device looks like: a coarse pointer or a touch screen means a phone. */
export function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'pc';
  try {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return 'mobile';
    if (navigator.maxTouchPoints > 0) return 'mobile';
  } catch {
    // Some browsers refuse matchMedia in odd contexts. Assume a PC.
  }
  return 'pc';
}

/**
 * What the player asked for: ?platform=mobile in the address bar wins and is
 * remembered, otherwise whatever was remembered last time. null = no choice yet.
 */
export function readOverride(): Platform | null {
  if (typeof window === 'undefined') return null;

  try {
    const fromUrl = new URLSearchParams(window.location.search).get('platform');
    if (isPlatform(fromUrl)) {
      rememberPlatform(fromUrl);
      return fromUrl;
    }
  } catch {
    // A malformed query string is not worth crashing over.
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isPlatform(stored)) return stored;
  } catch {
    // Private mode can refuse localStorage.
  }

  return null;
}

/** Remember the choice so the next visit starts the same way. */
export function rememberPlatform(platform: Platform): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, platform);
  } catch {
    // Not being able to remember is not an error worth showing a child.
  }
}
