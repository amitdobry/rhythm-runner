import express from 'express';
import { healthRouter } from './routes/health.js';
import { playerRouter } from './routes/player.js';
import { scoresRouter } from './routes/scores.js';
import { eventsRouter } from './routes/events.js';
import { errorHandler, notFound } from './errors.js';

/**
 * Builds the Express app without starting it or touching the database,
 * so tests can exercise the routes on their own.
 */
export function createApp() {
  const app = express();
  app.use(express.json());

  app.use('/api/health', healthRouter);
  app.use('/api/player', playerRouter);
  app.use('/api/scores', scoresRouter);
  app.use('/api/events', eventsRouter);

  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
