import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
        <p>
          Match the pace of the road: left foot, right foot, up the hills and through the water.
        </p>
        <p className="muted">You are playing as {player?.nickname}.</p>
        <Link className="button-link primary" to="/play">
          Play
        </Link>
      </section>

      <p className="muted">
        Server: {health ? health.status : 'unreachable'} · Database:{' '}
        {health ? health.database : 'unknown'}
      </p>
    </main>
  );
}
