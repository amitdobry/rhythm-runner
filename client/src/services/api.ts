/**
 * Everything the browser asks the server for goes through this file.
 * The Vite dev server forwards /api to the Express server (see vite.config.ts).
 */

export interface Player {
  id: string;
  nickname: string;
}

export interface Health {
  status: 'ok';
  database: 'connected' | 'disconnected' | 'error';
  databaseError: string | null;
  time: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** 'wrong_pin', 'locked', 'bad_input' - what the page should say. */
    public readonly code?: string,
    public readonly attemptsLeft?: number,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body.error ?? `${url} answered ${response.status}`,
      body.code,
      body.attemptsLeft,
      body.retryAfterSeconds
    );
  }
  return body as T;
}

export const fetchHealth = () => request<Health>('/api/health');

/** Who is this browser signed in as? null when nobody. */
export async function fetchMe(): Promise<Player | null> {
  try {
    const { player } = await request<{ player: Player }>('/api/player/me');
    return player;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export interface EnterResult {
  player: Player;
  claimed: boolean;
}

export async function enterAsPlayer(nickname: string, pin: string): Promise<EnterResult> {
  return request<EnterResult>('/api/player/enter', {
    method: 'POST',
    body: JSON.stringify({ nickname, pin }),
  });
}

export const leave = () => request<{ ok: true }>('/api/player/leave', { method: 'POST' });

// ---------------------------------------------------------------- scores

export type Platform = 'pc' | 'mobile';

/** What the game sends after a run. The server checks every number. */
export interface RunSummary {
  score: number;
  distance: number;
  accuracy: number;
  bestCombo: number;
  runSeconds: number;
  platform: Platform;
  course: string;
}

/** One line on a leaderboard. */
export interface ScoreRow {
  nickname: string;
  score: number;
  distance: number;
  accuracy: number;
  bestCombo: number;
  platform: Platform;
  course: string;
  createdAt: string;
}

export interface MyScores {
  best: { week: ScoreRow | null; all: ScoreRow | null };
  runs: number;
}

export type Range = 'week' | 'all';

/** One page of the board, plus where the signed-in player stands on it. */
export interface TopScores {
  range: Range;
  weekStart: string;
  weekEnd: string;
  rows: ScoreRow[];
  me: { rank: number; row: ScoreRow } | null;
}

export interface SavedScore {
  saved: ScoreRow;
  rankWeek: number;
  rankAll: number;
  personalBest: boolean;
  previousBest: number | null;
}

export function submitScore(summary: RunSummary): Promise<SavedScore> {
  return request<SavedScore>('/api/scores', {
    method: 'POST',
    body: JSON.stringify(summary),
  });
}

/**
 * The leaderboard: one board for everyone, phone and keyboard together, for
 * this week or for all time. This one works before you have entered a nickname.
 */
export function fetchTopScores(range: Range, limit?: number): Promise<TopScores> {
  const query = new URLSearchParams({ range });
  if (limit !== undefined) query.set('limit', String(limit));
  return request<TopScores>(`/api/scores/top?${query.toString()}`);
}

export const fetchMyBest = () => request<MyScores>('/api/scores/me');
