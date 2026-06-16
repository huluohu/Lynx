import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';

const log = createLogger('db');
const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, '..', '..', 'data', 'lynx.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    log.info('Database connection opened', { path: DB_PATH });
  }
  return db;
}

export function getDbPath() {
  return DB_PATH;
}

export function getDataDirectory() {
  return dirname(DB_PATH);
}

export function runMigrations() {
  const d = getDb();
  const migDir = join(__dirname, '..', '..', 'migrations');
  const files = readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();

  // migration tracking
  d.exec(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT DEFAULT (datetime('now')))`);

  let applied = 0;
  for (const f of files) {
    const exists = d.prepare('SELECT 1 FROM _migrations WHERE name = ?').get(f);
    if (exists) continue;

    const sql = readFileSync(join(migDir, f), 'utf8');
    // Apply migration and record it atomically
    const applyMigration = d.transaction(() => {
      d.exec(sql);
      d.prepare('INSERT INTO _migrations (name) VALUES (?)').run(f);
    });
    applyMigration();
    log.info('Migration applied', { file: f });
    applied++;
  }

  if (applied === 0) {
    log.debug('All migrations up to date');
  }
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
    log.info('Database connection closed');
  }
}
