import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { usePlayer } from '../player/PlayerContext';

/** The front door: pick a nickname and you are in. No password, no email. */
export function EnterPage() {
  const { player, loading, enter } = usePlayer();
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    </main>
  );
}
