import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../player/PlayerContext';
import {
  fetchMyBest,
  fetchTopScores,
  type MyScores,
  type Platform,
  type ScoreRow,
} from '../services/api';
import { detectPlatform, readOverride } from '../game/platform';
import { T, fill, formatNumber } from '../text/he';
import { track } from '../analytics/analytics';
import { NicknameForm } from '../components/NicknameForm';
import { BehindTheGame } from '../components/BehindTheGame';

/**
 * The first screen. One enormous button and nothing in the way of it: a child
 * who scanned a leaflet in a corridor should be running within one tap. The
 * nickname, the boards and the story all come after.
 */
export function LandingPage() {
  const { player, logout } = usePlayer();
  const [showNickname, setShowNickname] = useState(false);
  const [showBehind, setShowBehind] = useState(false);
  const platform = usePlatform();

  useEffect(() => {
    track('landing_viewed');
  }, []);

  return (
    <main className="page landing">
      <h1 className="brand">{T.brand}</h1>
      <p className="tagline">{T.tagline}</p>

      <Link className="play-button" to="/play" onClick={() => track('play_pressed')}>
        {T.playNow}
      </Link>

      <HighScores nickname={player?.nickname} platform={platform} />

      {player ? (
        <section className="panel who">
          <p className="hello">{fill(T.hello, { name: player.nickname })}</p>
          <MyBestLine platform={platform} />
          <button onClick={logout}>{T.logOut}</button>
        </section>
      ) : showNickname ? (
        <section className="panel">
          <NicknameForm
            onEntered={() => {
              track('returning_entered');
              setShowNickname(false);
            }}
          />
        </section>
      ) : (
        <button className="quiet-link" onClick={() => setShowNickname(true)}>
          {T.playedBefore}
        </button>
      )}

      <button
        className="quiet-link"
        onClick={() => {
          track('behind_opened');
          setShowBehind(true);
        }}
      >
        {T.behindLink}
      </button>

      <p className="muted footer">{T.builtWith}</p>

      {showBehind && <BehindTheGame onClose={() => setShowBehind(false)} />}
    </main>
  );
}

/** What the player asked for wins; otherwise we guess from the device. */
function usePlatform(): Platform {
  const [platform] = useState<Platform>(() => readOverride() ?? detectPlatform());
  return platform;
}

function MyBestLine({ platform }: { platform: Platform }) {
  const [mine, setMine] = useState<MyScores | null>(null);

  useEffect(() => {
    fetchMyBest()
      .then(setMine)
      .catch(() => setMine(null));
  }, []);

  if (!mine) return null;
  return <p className="muted">{bestLine(mine, platform)}</p>;
}

/** "one run" is not "1 runs": Hebrew needs its own sentence for a single run. */
export function bestLine(mine: MyScores, platform: Platform): string {
  const best = mine.best[platform];
  const score = best ? formatNumber(best.score) : '—';
  return mine.runs === 1
    ? fill(T.yourBestOne, { score })
    : fill(T.yourBest, { score, runs: formatNumber(mine.runs) });
}

/** The two boards, and where the player sits on the one they play. */
function HighScores({ nickname, platform }: { nickname?: string; platform: Platform }) {
  const [tab, setTab] = useState<Platform>(platform);
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  const [mine, setMine] = useState<MyScores | null>(null);
  const [failed, setFailed] = useState(false);
  const seen = useRef(false);

  useEffect(() => {
    let current = true;
    setRows(null);
    setFailed(false);
    fetchTopScores(tab, 10)
      .then((found) => {
        if (!current) return;
        setRows(found);
        if (!seen.current) {
          seen.current = true;
          track('leaderboard_viewed');
        }
      })
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [tab]);

  useEffect(() => {
    fetchMyBest()
      .then(setMine)
      .catch(() => setMine(null));
  }, [nickname]);

  return (
    <section className="panel scores">
      <h2>{T.highScores}</h2>

      <div className="score-tabs">
        <button className={tab === 'pc' ? 'chosen' : ''} onClick={() => setTab('pc')}>
          {T.tabPc}
        </button>
        <button className={tab === 'mobile' ? 'chosen' : ''} onClick={() => setTab('mobile')}>
          {T.tabMobile}
        </button>
      </div>

      {failed && <p className="muted">{T.scoresUnavailable}</p>}
      {!failed && rows !== null && rows.length === 0 && <p className="muted">{T.noRunsYet}</p>}
      {!failed && rows !== null && rows.length > 0 && (
        <table className="score-table">
          <thead>
            <tr>
              <th>#</th>
              <th>{T.name}</th>
              <th>{T.score}</th>
              <th>{T.distance}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${row.nickname}-${row.createdAt}`}
                className={row.nickname === nickname ? 'me' : ''}
              >
                <td className="num">{index + 1}</td>
                <td title={row.nickname}>{shortName(row.nickname)}</td>
                <td className="num">{formatNumber(row.score)}</td>
                <td className="num">
                  {formatNumber(row.distance)} {T.meters}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {mine && <p className="muted">{bestLine(mine, tab)}</p>}
    </section>
  );
}

/** Long names would push the table off a phone screen. */
export function shortName(nickname: string): string {
  return nickname.length > 14 ? `${nickname.slice(0, 14)}…` : nickname;
}
