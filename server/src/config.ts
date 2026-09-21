import 'dotenv/config';

/**
 * All configuration comes from environment variables (server/.env in development).
 * The server must fail clearly when something required is missing.
 */

export interface ServerConfig {
  port: number;
  mongoUri: string;
  mongoDbName: string;
  adminKey: string | null;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to server/.env and fill it in.`
    );
  }
  return value.trim();
}

/**
 * The key that unlocks the analytics summary. Optional: without it the
 * summary route simply does not exist. Read on every request so a route can
 * ask for it without the whole config (which insists on MONGODB_URI).
 */
export function readAdminKey(): string | null {
  return process.env.ADMIN_KEY?.trim() || null;
}

export function loadConfig(): ServerConfig {
  return {
    port: Number(process.env.PORT ?? 4000),
    mongoUri: required('MONGODB_URI'),
    mongoDbName: process.env.MONGODB_DB_NAME?.trim() || 'rhythm_runner',
    adminKey: readAdminKey(),
  };
}
