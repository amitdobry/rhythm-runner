import { useEffect, useState } from 'react';
import { usePlayer } from '../player/PlayerContext';
import { fetchHealth, type Health } from '../services/api';

/** The protected application area. Deliberately empty: the game is designed with the students. */
export function HomePage() {
  const { player, logout } = usePlayer();
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <main className="page">
      <header className="page-header">
        <h1>Rhythm Runner</h1>
        <button onClick={logout}>Log out</button>
      </header>

      <section className="panel">
        <p>Rhythm Runner — foundation ready. The game will be designed with the students.</p>
        <p className="muted">You are playing as {player?.nickname}.</p>
      </section>

      <p className="muted">
        Server: {health ? health.status : 'unreachable'} · Database:{' '}
        {health ? health.database : 'unknown'}
      </p>
    </main>
  );
}
