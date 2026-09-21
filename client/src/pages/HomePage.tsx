import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../player/PlayerContext';
import {
  fetchHealth,
  fetchMyBest,
  fetchTopScores,
  type Health,
  type MyScores,
  type Platform,
  type ScoreRow,
} from '../services/api';
import { detectPlatform, readOverride } from '../game/platform';

/** The protected application area: play, and see who is ahead of you. */
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

      <HighScores nickname={player?.nickname} />
    </main>
  );
}

/** The two leaderboards, and where the player sits on the one they play. */
function HighScores({ nickname }: { nickname?: string }) {
  const [platform, setPlatform] = useState<Platform>(() => readOverride() ?? detectPlatform());
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  const [mine, setMine] = useState<MyScores | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    setRows(null);
    setFailed(false);
    fetchTopScores(platform, 10)
      .then((found) => current && setRows(found))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [platform]);

  useEffect(() => {
    fetchMyBest()
      .then(setMine)
      .catch(() => setMine(null));
  }, []);

  const best = mine?.best[platform] ?? null;

  return (
    <section className="panel scores">
      <h2>High scores</h2>

      <div className="score-tabs">
        <button className={platform === 'pc' ? 'chosen' : ''} onClick={() => setPlatform('pc')}>
          PC
        </button>
        <button
          className={platform === 'mobile' ? 'chosen' : ''}
          onClick={() => setPlatform('mobile')}
        >
          Mobile
        </button>
      </div>

      {failed && <p className="muted">Scores are not available right now.</p>}
      {!failed && rows !== null && rows.length === 0 && (
        <p className="muted">No runs yet. Be the first.</p>
      )}
      {!failed && rows !== null && rows.length > 0 && (
        <table className="score-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Score</th>
              <th>Distance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${row.nickname}-${row.createdAt}`}
                className={row.nickname === nickname ? 'me' : ''}
              >
                <td>{index + 1}</td>
                <td title={row.nickname}>{shortName(row.nickname)}</td>
                <td>{formatNumber(row.score)}</td>
                <td>{formatNumber(row.distance)} m</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {mine && (
        <p className="muted">
          Your best: {best ? formatNumber(best.score) : '—'} · {mine.runs}{' '}
          {mine.runs === 1 ? 'run' : 'runs'}
        </p>
      )}
    </section>
  );
}

/** Long names would push the table off a phone screen. */
export function shortName(nickname: string): string {
  return nickname.length > 14 ? `${nickname.slice(0, 14)}…` : nickname;
}

/** 1240 reads better as 1 240. */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-GB').replace(/,/g, ' ');
}
