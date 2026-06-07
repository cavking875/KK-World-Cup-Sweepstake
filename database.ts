import path from 'path';
import { SweepstakeState } from './src/types';

// Auto-detect backend: use Postgres if DATABASE_URL is set (Railway), otherwise SQLite (local dev)
const USE_POSTGRES = !!process.env.DATABASE_URL;

// ---------- SQLite backend (local dev) ----------

let _sqliteDb: any = null;

async function getSqliteDb() {
  if (!_sqliteDb) {
    const { default: Database } = await import('better-sqlite3');
    const DB_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.cwd();
    const DB_PATH = path.join(DB_DIR, 'sweepstake.db');
    _sqliteDb = new Database(DB_PATH);
    _sqliteDb.pragma('journal_mode = WAL');
    _sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS sweepstake_state (
        id INTEGER PRIMARY KEY DEFAULT 1,
        data TEXT NOT NULL
      )
    `);
  }
  return _sqliteDb;
}

// ---------- PostgreSQL backend (Railway) ----------

let _pgPool: any = null;

async function getPgPool() {
  if (!_pgPool) {
    const { Pool } = await import('pg');
    _pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await _pgPool.query(`
      CREATE TABLE IF NOT EXISTS sweepstake_state (
        id INTEGER PRIMARY KEY DEFAULT 1,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  }
  return _pgPool;
}

// ---------- Public async API ----------

export async function hasExistingState(): Promise<boolean> {
  try {
    if (USE_POSTGRES) {
      const pool = await getPgPool();
      const result = await pool.query('SELECT id FROM sweepstake_state WHERE id = 1');
      return result.rows.length > 0;
    } else {
      const db = await getSqliteDb();
      const row = db.prepare('SELECT id FROM sweepstake_state WHERE id = 1').get();
      return !!row;
    }
  } catch {
    return false;
  }
}

export async function loadState(): Promise<SweepstakeState> {
  if (USE_POSTGRES) {
    const pool = await getPgPool();
    const result = await pool.query('SELECT data FROM sweepstake_state WHERE id = 1');
    if (result.rows.length === 0) throw new Error('No state found in database');
    // JSONB is auto-parsed by the pg driver
    return result.rows[0].data as SweepstakeState;
  } else {
    const db = await getSqliteDb();
    const row = db.prepare('SELECT data FROM sweepstake_state WHERE id = 1').get() as any;
    if (!row) throw new Error('No state found in database');
    return JSON.parse(row.data) as SweepstakeState;
  }
}

export async function saveState(state: SweepstakeState): Promise<void> {
  if (USE_POSTGRES) {
    const pool = await getPgPool();
    await pool.query(
      `INSERT INTO sweepstake_state (id, data) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()`,
      [JSON.stringify(state)]
    );
  } else {
    const db = await getSqliteDb();
    db.prepare(`
      INSERT INTO sweepstake_state (id, data) VALUES (1, ?)
      ON CONFLICT(id) DO UPDATE SET data = excluded.data
    `).run(JSON.stringify(state));
  }
}

