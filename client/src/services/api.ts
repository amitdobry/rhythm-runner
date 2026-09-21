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
    message: string
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
    throw new ApiError(response.status, body.error ?? `${url} answered ${response.status}`);
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

export async function enterAsPlayer(nickname: string): Promise<Player> {
  const { player } = await request<{ player: Player }>('/api/player/enter', {
    method: 'POST',
    body: JSON.stringify({ nickname }),
  });
  return player;
}

export const leave = () => request<{ ok: true }>('/api/player/leave', { method: 'POST' });
