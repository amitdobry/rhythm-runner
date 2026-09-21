import { Db, ObjectId } from 'mongodb';
import { COLLECTIONS } from '../database/mongo.js';
import type { Player } from '../player/players.js';
import { weekEndFor, weekKeyFor } from './week.js';

/**
 * Everything the server knows about a finished run: how to check one, how to
 * save it, and how to read the leaderboards back out.
 *
 * The browser sends the numbers, so the server trusts none of them. A run that
 * could not have happened in 60 seconds of the real game is refused.
 *
 * There are two boards over the same rows: this week, so the top stays
 * winnable, and all time. One board for every device.
 */

export type Platform = 'pc' | 'mobile';

/** week = this Sunday-to-Sunday board in Israel; all = every run ever. */
export type Range = 'week' | 'all';

export function isRange(value: unknown): value is Range {
  return value === 'week' || value === 'all';
}

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
  turbos?: number; // how many turbos the run earned; older pages do not send it
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
  weekKey: string; // the Sunday that starts the Israeli week of createdAt
  score: number;
  distance: number;
  accuracy: number;
  bestCombo: number;
  runSeconds: number;
  platform: Platform;
  course: string;
  turbos?: number;
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

  // Optional, and only believed when it is a sensible whole number.
  const turbos = raw.turbos;
  if (turbos !== undefined) {
    if (typeof turbos !== 'number' || !Number.isInteger(turbos) || turbos < 0) return null;
  }

  return {
    score,
    distance,
    accuracy,
    bestCombo,
    runSeconds,
    platform,
    course,
    ...(turbos === undefined ? {} : { turbos }),
  };
}

export interface SaveResult {
  saved: ScoreRow;
  rankWeek: number;
  rankAll: number;
  personalBest: boolean;
  previousBest: number | null;
}

export async function saveRun(db: Db, player: Player, summary: RunSummary): Promise<SaveResult> {
  const playerId = new ObjectId(player.id);
  const createdAt = new Date();
  const weekKey = weekKeyFor(createdAt);

  // Read the old best BEFORE the insert, or every run would tie with itself.
  const previousBest = await bestScoreFor(db, playerId, summary.course, null);
  const personalBest = previousBest === null || summary.score > previousBest;

  const doc: ScoreDoc = {
    _id: new ObjectId(),
    playerId,
    nickname: player.nickname,
    weekKey,
    ...summary,
    createdAt,
  };
  await db.collection<ScoreDoc>(COLLECTIONS.scores).insertOne(doc);

  // Rank is where the player stands on the board, not where this one run
  // stands: a run below your own best must not push you down the list.
  const [rankWeek, rankAll] = await Promise.all([
    rankFor(db, playerId, summary.course, weekKey),
    rankFor(db, playerId, summary.course, null),
  ]);

  return { saved: toRow(doc), rankWeek, rankAll, personalBest, previousBest };
}

/**
 * One row per player, best score first. One board for everyone: the phone
 * layout is a layout, not a different game, so a thumb and a keyboard are
 * ranked together. Pass a weekKey for this week's board, null for all time.
 */
export async function topScores(
  db: Db,
  limit: number,
  weekKey: string | null
): Promise<ScoreRow[]> {
  const docs = await db
    .collection<ScoreDoc>(COLLECTIONS.scores)
    .aggregate<ScoreDoc>([
      { $match: weekKey ? { course: COURSE, weekKey } : { course: COURSE } },
      { $sort: { score: -1 } },
      { $group: { _id: '$playerId', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
      { $sort: { score: -1 } },
      { $limit: limit },
    ])
    .toArray();
  return docs.map(toRow);
}

/** This player's best run this week and ever, and how many runs they have made. */
export async function personalBest(
  db: Db,
  playerId: string,
  now = new Date()
): Promise<{ best: { week: ScoreRow | null; all: ScoreRow | null }; runs: number }> {
  const scores = db.collection<ScoreDoc>(COLLECTIONS.scores);
  const id = new ObjectId(playerId);
  const weekKey = weekKeyFor(now);

  const [week, all, runs] = await Promise.all([
    scores.find({ playerId: id, course: COURSE, weekKey }).sort({ score: -1 }).limit(1).next(),
    scores.find({ playerId: id, course: COURSE }).sort({ score: -1 }).limit(1).next(),
    scores.countDocuments({ playerId: id }),
  ]);

  return {
    best: { week: week ? toRow(week) : null, all: all ? toRow(all) : null },
    runs,
  };
}

/** Where a player stands on one board, and their own row - or null if absent. */
export async function standingFor(
  db: Db,
  playerId: string,
  weekKey: string | null
): Promise<{ rank: number; row: ScoreRow } | null> {
  const id = new ObjectId(playerId);
  const filter = weekKey
    ? { playerId: id, course: COURSE, weekKey }
    : { playerId: id, course: COURSE };

  const best = await db
    .collection<ScoreDoc>(COLLECTIONS.scores)
    .find(filter)
    .sort({ score: -1 })
    .limit(1)
    .next();
  if (!best) return null;

  return { rank: await rankFor(db, id, COURSE, weekKey), row: toRow(best) };
}

/** The week a board covers, as two dates a page can show. */
export function weekWindow(now = new Date()): { weekStart: string; weekEnd: string } {
  const weekStart = weekKeyFor(now);
  return { weekStart, weekEnd: weekEndFor(weekStart) };
}

/** This player's best score on one board, or null if they have never run it. */
async function bestScoreFor(
  db: Db,
  playerId: ObjectId,
  course: string,
  weekKey: string | null
): Promise<number | null> {
  const best = await db
    .collection<ScoreDoc>(COLLECTIONS.scores)
    .find(weekKey ? { playerId, course, weekKey } : { playerId, course })
    .sort({ score: -1 })
    .limit(1)
    .next();
  return best?.score ?? null;
}

/** How many OTHER players are ahead of this player on one board, plus one. */
async function rankFor(
  db: Db,
  playerId: ObjectId,
  course: string,
  weekKey: string | null
): Promise<number> {
  const playerBest = (await bestScoreFor(db, playerId, course, weekKey)) ?? 0;
  const match = weekKey
    ? { course, weekKey, playerId: { $ne: playerId } }
    : { course, playerId: { $ne: playerId } };

  const counted = await db
    .collection<ScoreDoc>(COLLECTIONS.scores)
    .aggregate<{ players: number }>([
      { $match: match },
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
