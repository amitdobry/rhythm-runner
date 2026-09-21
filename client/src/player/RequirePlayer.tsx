import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { usePlayer } from './PlayerContext';

/** Wraps a screen that only a signed-in player may see. */
export function RequirePlayer({ children }: { children: ReactNode }) {
  const { player, loading } = usePlayer();
  if (loading) return <p className="muted">Checking who you are...</p>;
  if (!player) return <Navigate to="/enter" replace />;
  return <>{children}</>;
}
