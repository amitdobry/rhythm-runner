import { useState, type FormEvent } from 'react';
import { usePlayer } from '../player/PlayerContext';
import { T } from '../text/he';

/**
 * Pick a nickname. No password, no email.
 *
 * It is never the first thing a child meets any more: they play first, and
 * this appears only when there is a score worth keeping, or when someone who
 * has played before wants their old name back.
 */
export function NicknameForm({ onEntered }: { onEntered?: () => void }) {
  const { enter } = usePlayer();
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await enter(nickname);
      onEntered?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : T.enterFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="nickname-form" onSubmit={submit}>
      <label htmlFor="nickname">{T.nicknameLabel}</label>
      <input
        id="nickname"
        value={nickname}
        onChange={(event) => setNickname(event.target.value)}
        placeholder={T.nicknamePlaceholder}
        autoComplete="off"
        autoFocus
      />
      <button type="submit" disabled={busy || nickname.trim().length === 0}>
        {busy ? T.entering : T.enter}
      </button>
      {error && <p className="bad">{error}</p>}
    </form>
  );
}
