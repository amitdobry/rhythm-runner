import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';

const saved = { ...process.env };

beforeEach(() => {
  delete process.env.MONGODB_URI;
  delete process.env.MONGODB_DB_NAME;
  delete process.env.PORT;
});
afterEach(() => {
  process.env = { ...saved };
});

describe('loadConfig', () => {
  it('refuses to start without MONGODB_URI and says how to fix it', () => {
    expect(() => loadConfig()).toThrow(/MONGODB_URI.*\.env\.example/);
  });

  it('uses rhythm_runner and port 4000 as defaults', () => {
    process.env.MONGODB_URI = 'mongodb://example.invalid/';
    const config = loadConfig();
    expect(config.mongoDbName).toBe('rhythm_runner');
    expect(config.port).toBe(4000);
  });
});
