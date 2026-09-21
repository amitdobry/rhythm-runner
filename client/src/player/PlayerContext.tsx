import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { enterAsPlayer, fetchMe, leave, type EnterResult, type Player } from '../services/api';

/**
 * "Who is playing right now?" - available to every screen.
 * On page load we ask the server; the answer comes from the session cookie.
 */
interface PlayerContextValue {
  player: Player | null;
  loading: boolean;
  /** Claims the name if it is free, opens it if the code is right. */
  enter: (nickname: string, pin: string) => Promise<EnterResult>;
  logout: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMe()
      .then(setPlayer)
      .catch(() => setPlayer(null))
      .finally(() => setLoading(false));
  }, []);

  const enter = async (nickname: string, pin: string) => {
    const result = await enterAsPlayer(nickname, pin);
    setPlayer(result.player);
    return result;
  };

  const logout = async () => {
    await leave();
    setPlayer(null);
  };

  return (
    <PlayerContext.Provider value={{ player, loading, enter, logout }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const value = useContext(PlayerContext);
  if (!value) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return value;
}
