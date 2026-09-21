import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { usePlayer } from '../player/PlayerContext';
import { fetchTopScores, type ScoreRow } from '../services/api';
import { detectPlatform, readOverride } from '../game/platform';
import { formatNumber, shortName } from './HomePage';

/** The front door: pick a nickname and you are in. No password, no email. */
export function EnterPage() {
  const { player, loading, enter } = usePlayer();
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ScoreRow[] | null>(null);

  // Seeing other children's names first is half the reason to type your own.
  // If this fails, nothing is shown and entering still works.
  useEffect(() => {
    let current = true;
    fetchTopScores(readOverride() ?? detectPlatform(), 5)
      .then((found) => current && setRows(found))
      .catch(() => current && setRows(null));
    return () => {
      current = false;
    };
  }, []);

  if (loading) return <p className="muted">Checking who you are...</p>;
  if (player) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await enter(nickname);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enter.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <h1>Rhythm Runner</h1>
      <form className="panel" onSubmit={submit}>
        <label htmlFor="nickname">Pick a nickname to enter</label>
        <input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          autoComplete="off"
          autoFocus
        />
        <button type="submit" disabled={busy || nickname.trim().length === 0}>
          {busy ? 'Entering...' : 'Enter'}
        </button>
        {error && <p className="bad">{error}</p>}
      </form>

      {rows !== null && rows.length > 0 && (
        <section className="panel scores">
          <h2>{rows.some(isToday) ? "Today's runners" : 'High scores'}</h2>
          <table className="score-table">
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.nickname}-${row.createdAt}`}>
                  <td>{index + 1}</td>
                  <td title={row.nickname}>{shortName(row.nickname)}</td>
                  <td>{formatNumber(row.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

function isToday(row: ScoreRow): boolean {
  return new Date(row.createdAt).toDateString() === new Date().toDateString();
}
