import 'dotenv/config';

/**
 * All configuration comes from environment variables (server/.env in development).
 * The server must fail clearly when something required is missing.
 */

export interface ServerConfig {
  port: number;
  mongoUri: string;
  mongoDbName: string;
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

export function loadConfig(): ServerConfig {
  return {
    port: Number(process.env.PORT ?? 4000),
    mongoUri: required('MONGODB_URI'),
    mongoDbName: process.env.MONGODB_DB_NAME?.trim() || 'rhythm_runner',
  };
}
