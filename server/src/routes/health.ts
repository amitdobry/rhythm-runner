import { Router } from 'express';
import { getConnectionState } from '../database/mongo.js';

/** GET /api/health - is the server up, and is the database reachable? */
export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const database = getConnectionState();
  res.json({
    status: 'ok',
    database: database.state,
    databaseError: database.error,
    time: new Date().toISOString(),
  });
});
