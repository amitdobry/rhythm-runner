import { Db, ObjectId } from 'mongodb';
import { COLLECTIONS } from '../database/mongo.js';
import type { Player } from '../player/players.js';

/**
 * Everything the server knows about a finished run: how to check one, how to
 * save it, and how to read the leaderboards back out.
 *
 * The browser sends the numbers, so the server trusts none of them. A run that
 * could not have happened in 60 seconds of the real game is refused.
 */

export type Platform = 'pc' | 'mobile';

// These three mirror client/src/game/config.ts. If the game changes there -
// a faster runner, a bigger multiplier, a quicker pace - change them here too.
export const MAX_SPEED = 20; // speed.max: metres per second the runner can never pass
export const MAX_MULTIPLIER = 3; // the best combo multiplier
export const MIN_STEP_INTERVAL_MS = 480; // the quickest pace: 600 ms downhill (x0.8)

const COURSE = 'level-1';

export interface RunSummary {
  score: number;
  distance: number;
  accuracy: number;
  bestCombo: number;
  runSeconds: number;
  platform: Platform;
  course: string;
}

export interface ScoreRow {
  nickname: string;
  score: number;
  distance: number;
  accuracy: number;
  bestCombo: number;
  platform: Platform;
  course: string;
  createdAt: string; // ISO
}

interface ScoreDoc {
  _id: ObjectId;
  playerId: ObjectId;
  nickname: string; // copied at save time so the leaderboard needs no join
  score: number;
  distance: number;
  accuracy: number;
  bestCombo: number;
  runSeconds: number;
  platform: Platform;
  course: string;
  createdAt: Date;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** A run the server is willing to believe, or null. */
export function validateRun(body: unknown): RunSummary | null {
  if (typeof body !== 'object' || body === null) return null;
  const raw = body as Record<string, unknown>;

  const score = finiteNumber(raw.score);
  const distance = finiteNumber(raw.distance);
  const accuracy = finiteNumber(raw.accuracy);
  const bestCombo = finiteNumber(raw.bestCombo);
  const runSeconds = finiteNumber(raw.runSeconds);
  if (
    score === null ||
    distance === null ||
    accuracy === null ||
    bestCombo === null ||
    runSeconds === null
  ) {
    return null;
  }

  if (!Number.isInteger(score) || score < 0) return null;
  if (!Number.isInteger(distance) || distance < 0) return null;
  if (!Number.isInteger(bestCombo) || bestCombo < 0) return null;
  if (accuracy < 0 || accuracy > 1) return null;
  if (runSeconds < 10 || runSeconds > 300) return null;

  const platform = raw.platform;
  if (platform !== 'pc' && platform !== 'mobile') return null;

  const course = raw.course;
  if (typeof course !== 'string' || course.length < 1 || course.length > 40) return null;

  // Could this have happened at all? Nobody runs faster than the game allows.
  if (distance > MAX_SPEED * runSeconds) return null;
  if (score > distance * MAX_MULTIPLIER) return null;
  if (bestCombo > (runSeconds * 1000) / MIN_STEP_INTERVAL_MS) return null;

  return { score, distance, accuracy, bestCombo, runSeconds, platform, course };
}

export async function saveRun(
  db: Db,
  player: Player,
  summary: RunSummary
): Promise<{ saved: ScoreRow; rank: number }> {
  const doc: ScoreDoc = {
    _id: new ObjectId(),
    playerId: new ObjectId(player.id),
    nickname: player.nickname,
    ...summary,
    createdAt: new Date(),
  };
  await db.collection<ScoreDoc>(COLLECTIONS.scores).insertOne(doc);

  // Rank is where the player stands on the board, not where this one run
  // stands: a run below your own best must not push you down the list.
  const best = await bestScoreFor(db, doc.playerId, summary.course);
  const rank = await rankOf(db, doc.playerId, summary.course, best);
  return { saved: toRow(doc), rank };
}

/**
 * One row per player, best score first. One board for everyone: the phone
 * layout is a layout, not a different game, so a thumb and a keyboard are
 * ranked together. Which device it was is kept on the row for analytics.
 */
export async function topScores(db: Db, limit: number): Promise<ScoreRow[]> {
  const docs = await db
    .collection<ScoreDoc>(COLLECTIONS.scores)
    .aggregate<ScoreDoc>([
      { $match: { course: COURSE } },
      { $sort: { score: -1 } },
      { $group: { _id: '$playerId', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
      { $sort: { score: -1 } },
      { $limit: limit },
    ])
    .toArray();
  return docs.map(toRow);
}

/** This player's best run, and how many runs they have made. */
export async function personalBest(
  db: Db,
  playerId: string
): Promise<{ best: ScoreRow | null; runs: number }> {
  const scores = db.collection<ScoreDoc>(COLLECTIONS.scores);
  const id = new ObjectId(playerId);

  const [best, runs] = await Promise.all([
    scores.find({ playerId: id, course: COURSE }).sort({ score: -1 }).limit(1).next(),
    scores.countDocuments({ playerId: id }),
  ]);

  return { best: best ? toRow(best) : null, runs };
}

/** This player's best score, or 0 if they have never finished a run. */
async function bestScoreFor(db: Db, playerId: ObjectId, course: string): Promise<number> {
  const best = await db
    .collection<ScoreDoc>(COLLECTIONS.scores)
    .find({ playerId, course })
    .sort({ score: -1 })
    .limit(1)
    .next();
  return best?.score ?? 0;
}

/** How many OTHER players are ahead of this player, plus one. */
async function rankOf(
  db: Db,
  playerId: ObjectId,
  course: string,
  playerBest: number
): Promise<number> {
  const counted = await db
    .collection<ScoreDoc>(COLLECTIONS.scores)
    .aggregate<{ players: number }>([
      { $match: { course, playerId: { $ne: playerId } } },
      { $group: { _id: '$playerId', best: { $max: '$score' } } },
      { $match: { best: { $gt: playerBest } } },
      { $count: 'players' },
    ])
    .toArray();
  return 1 + (counted[0]?.players ?? 0);
}

function toRow(doc: ScoreDoc): ScoreRow {
  return {
    nickname: doc.nickname,
    score: doc.score,
    distance: doc.distance,
    accuracy: doc.accuracy,
    bestCombo: doc.bestCombo,
    platform: doc.platform,
    course: doc.course,
    createdAt: doc.createdAt.toISOString(),
  };
}
