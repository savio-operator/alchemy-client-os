import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const DB_DIR = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : path.join(process.cwd(), "data");
const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, "adchemy.db");

let _sqlite: Database.Database | null = null;
let _db: BetterSQLite3Database<typeof schema> | null = null;
let _initialized = false;

function getSqlite(): Database.Database {
  if (!_sqlite) {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    _sqlite = new Database(DB_PATH);
    _sqlite.pragma("journal_mode = WAL");
    _sqlite.pragma("foreign_keys = ON");
  }
  return _sqlite;
}

function initTables(sqlite: Database.Database) {
  if (_initialized) return;
  _initialized = true;

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      industry TEXT,
      stage TEXT,
      created_at TEXT NOT NULL,
      archived_at TEXT
    );

    CREATE TABLE IF NOT EXISTS client_profile (
      client_id TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
      raw_json TEXT
    );

    CREATE TABLE IF NOT EXISTS client_brief (
      client_id TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
      summary_md TEXT,
      north_star TEXT,
      audience TEXT,
      voice TEXT,
      constraints TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS history_entries (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT,
      body TEXT,
      attachments TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT,
      "column" TEXT NOT NULL DEFAULT 'raw',
      tags TEXT,
      is_online INTEGER DEFAULT 1,
      estimated_cost REAL,
      refined_body TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      objective TEXT,
      channel TEXT,
      hypothesis TEXT,
      creative_notes TEXT,
      budget REAL,
      start_date TEXT,
      end_date TEXT,
      kpi TEXT,
      outcome TEXT,
      status TEXT NOT NULL DEFAULT 'planned',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS social_posts (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      copy TEXT,
      media_urls TEXT,
      scheduled_for TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS discoveries (
      id TEXT PRIMARY KEY,
      source_name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      external_id TEXT NOT NULL,
      author TEXT,
      title TEXT,
      body TEXT,
      media_urls TEXT,
      external_url TEXT,
      raw_json TEXT,
      fetched_at TEXT NOT NULL,
      popularity_score REAL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_discoveries_dedup
      ON discoveries(source_name, external_id);

    CREATE TABLE IF NOT EXISTS client_discoveries (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      discovery_id TEXT NOT NULL REFERENCES discoveries(id) ON DELETE CASCADE,
      score REAL NOT NULL,
      tags TEXT,
      why_md TEXT,
      surfaced_at TEXT,
      dismissed_at TEXT,
      saved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      agent_name TEXT NOT NULL,
      input_json TEXT,
      output_md TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      forecast_md TEXT,
      created_at TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS history_fts USING fts5(
      title,
      body,
      content='history_entries',
      content_rowid='rowid'
    );
  `);
}

export const sqlite = new Proxy({} as Database.Database, {
  get(_target, prop) {
    const instance = getSqlite();
    initTables(instance);
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});

export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_target, prop) {
    if (!_db) {
      const instance = getSqlite();
      initTables(instance);
      _db = drizzle(instance, { schema });
    }
    const value = (_db as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(_db);
    }
    return value;
  },
});

// Helper to sync FTS index
export function indexHistoryEntry(id: string, title: string | null, body: string | null) {
  const row = sqlite.prepare("SELECT rowid FROM history_entries WHERE id = ?").get(id) as { rowid: number } | undefined;
  if (row) {
    sqlite.prepare("INSERT OR REPLACE INTO history_fts(rowid, title, body) VALUES (?, ?, ?)").run(
      row.rowid,
      title || "",
      stripHtml(body || "")
    );
  }
}

export function searchHistory(query: string, clientId: string) {
  return sqlite
    .prepare(
      `SELECT h.* FROM history_entries h
       JOIN history_fts f ON h.rowid = f.rowid
       WHERE history_fts MATCH ? AND h.client_id = ?
       ORDER BY rank
       LIMIT 50`
    )
    .all(query, clientId);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
