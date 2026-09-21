import { MongoClient, Db } from 'mongodb';

/**
 * The one place that talks to MongoDB.
 *
 * COLLECTIONS lists every collection this project uses. Keep it honest:
 * when the game learns to remember something new, its collection is added here.
 */
export const COLLECTIONS = {
  players: 'players',
  sessions: 'sessions',
  scores: 'scores',
  events: 'events',
} as const;

/** Events are a counting tool, not an archive: MongoDB drops each one after this. */
const EVENT_TTL_SECONDS = 180 * 24 * 60 * 60;

export type ConnectionState = 'connected' | 'disconnected' | 'error';

let client: MongoClient | null = null;
let db: Db | null = null;
let state: ConnectionState = 'disconnected';
let lastError: string | null = null;

export async function connectToMongo(uri: string, dbName: string): Promise<void> {
  try {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
    await client.connect();
    await client.db(dbName).command({ ping: 1 });
    db = client.db(dbName);
    await ensureIndexes(db);
    state = 'connected';
    lastError = null;
  } catch (err) {
    state = 'error';
    lastError = err instanceof Error ? err.message : String(err);
    db = null;
  }
}

/** Indexes describe the rules the database enforces for us. */
async function ensureIndexes(database: Db): Promise<void> {
  await database.collection(COLLECTIONS.players).createIndex({ nickname: 1 }, { unique: true });
  await database.collection(COLLECTIONS.sessions).createIndex({ token: 1 }, { unique: true });
  // MongoDB deletes a session by itself once expiresAt has passed.
  await database
    .collection(COLLECTIONS.sessions)
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  // One index per leaderboard question: "who is best on this board?" and
  // "what is this player s best?"
  await database.collection(COLLECTIONS.scores).createIndex({ platform: 1, course: 1, score: -1 });
  await database
    .collection(COLLECTIONS.scores)
    .createIndex({ playerId: 1, platform: 1, score: -1 });
  // The funnel keeps nothing for long: see EVENT_TTL_SECONDS above.
  await database
    .collection(COLLECTIONS.events)
    .createIndex({ at: 1 }, { expireAfterSeconds: EVENT_TTL_SECONDS });
  await database.collection(COLLECTIONS.events).createIndex({ name: 1, at: -1 });
  await database.collection(COLLECTIONS.events).createIndex({ ref: 1, at: -1 });
}

/** null means "not connected". Callers must handle that case clearly. */
export function getDb(): Db | null {
  return db;
}

export function getConnectionState(): { state: ConnectionState; error: string | null } {
  return { state, error: lastError };
}

export async function closeMongo(): Promise<void> {
  await client?.close();
  client = null;
  db = null;
  state = 'disconnected';
}
