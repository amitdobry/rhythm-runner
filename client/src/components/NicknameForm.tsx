import { useState, type FormEvent } from 'react';
import { usePlayer } from '../player/PlayerContext';
import { ApiError } from '../services/api';
import { T, fill } from '../text/he';
import { track } from '../analytics/analytics';

/**
 * Pick a nickname and the four-digit code that keeps it yours.
 *
 * One form for both cases: a name nobody has taken is claimed with whatever
 * code you type, and a name you claimed before opens only for that code. The
 * server decides which of the two happened; the page only reports it.
 *
 * It is never the first thing a child meets: they play first, and this appears
 * when there is a score worth keeping.
 */
export function NicknameForm({ onEntered }: { onEntered?: (claimed: boolean) => void }) {
  const { enter } = usePlayer();
  const [nickname, setNickname] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await enter(nickname, pin);
      onEntered?.(result.claimed);
    } catch (err) {
      setError(messageFor(err));
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

      <label htmlFor="pin">{T.pinLabel}</label>
      <input
        id="pin"
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={pin}
        onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
        autoComplete="off"
      />
      <p className="muted pin-hint">{T.pinHint}</p>

      <button type="submit" disabled={busy || nickname.trim().length === 0 || pin.length !== 4}>
        {busy ? T.entering : T.enter}
      </button>
      {error && <p className="bad">{error}</p>}
    </form>
  );
}

/** Turns the server's answer into something a child can act on. */
function messageFor(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return err instanceof Error ? err.message : T.enterFailed;
  }

  if (err.code === 'wrong_pin') {
    track('pin_wrong');
    return fill(T.wrongPin, { n: err.attemptsLeft ?? 0 });
  }
  if (err.code === 'locked') {
    track('pin_locked');
    const minutes = Math.max(1, Math.ceil((err.retryAfterSeconds ?? 0) / 60));
    return fill(T.pinLocked, { minutes });
  }
  if (err.code === 'bad_input') return T.pinFormat;
  return err.message || T.enterFailed;
}
