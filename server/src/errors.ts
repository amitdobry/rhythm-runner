import type { ErrorRequestHandler, RequestHandler } from 'express';

/** An error that already knows which HTTP status it deserves. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

/** Anything under /api that no route claimed. */
export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: `No such API route: ${req.method} ${req.path}` });
};

/**
 * The last stop for every error. Known errors keep their status and message;
 * unexpected ones are logged in full and answered with a plain 500.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error('[server] unexpected error:', err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
};
