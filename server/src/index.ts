import { loadConfig } from './config.js';
import { connectToMongo, closeMongo, getConnectionState } from './database/mongo.js';
import { createApp } from './app.js';

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error('\n[server] Cannot start.');
    console.error('[server]', err instanceof Error ? err.message : err);
    process.exit(1);
    return;
  }

  await connectToMongo(config.mongoUri, config.mongoDbName);
  const database = getConnectionState();
  if (database.state === 'connected') {
    console.log(`[server] database "${config.mongoDbName}" connected`);
  } else {
    console.error(`[server] database NOT connected: ${database.error}`);
    console.error('[server] The server is up, but player entry answers 503 until this is fixed.');
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[server] listening on http://localhost:${config.port}`);
  });

  const shutdown = async () => {
    server.close();
    await closeMongo();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
