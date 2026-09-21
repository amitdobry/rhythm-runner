/**
 * Vercel entry point.
 *
 * On Vercel there is no long-running server: this file is called for every
 * request under /api (see vercel.json). It reuses the very same Express app as
 * local development (server/src/app.ts, compiled to server/dist by `npm run build`),
 * and opens the database connection on the first request instead of at start-up.
 * Warm invocations reuse the cached connection.
 *
 * Local development does not use this file; `npm run dev` still runs server/src/index.ts.
 */
import { createApp } from '../server/dist/app.js';
import { loadConfig } from '../server/dist/config.js';
import { connectToMongo, getConnectionState } from '../server/dist/database/mongo.js';

const app = createApp();

let config = null;
try {
  config = loadConfig();
} catch (err) {
  console.error('[vercel]', err instanceof Error ? err.message : err);
  console.error('[vercel] Set MONGODB_URI in the Vercel project environment variables.');
}

/** One connection attempt at a time; a failed attempt is retried on the next request. */
let pending = null;
function ensureDatabase() {
  if (!config || getConnectionState().state === 'connected') return Promise.resolve();
  if (!pending) {
    pending = connectToMongo(config.mongoUri, config.mongoDbName).finally(() => {
      pending = null;
    });
  }
  return pending;
}

export default async function handler(req, res) {
  await ensureDatabase();
  app(req, res);
}
