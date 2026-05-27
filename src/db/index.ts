import { createClient, Client } from "@libsql/client";
import { drizzle, LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

const TURSO_URL = process.env.TURSO_DATABASE_URL || "file:data/adchemy.db";
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

let _client: Client | null = null;
let _db: LibSQLDatabase<typeof schema> | null = null;
let _initialized = false;

function getClient(): Client {
  if (!_client) {
    _client = createClient({
      url: TURSO_URL,
      authToken: TURSO_TOKEN,
    });
  }
  return _client;
}

async function initTables() {
  if (_initialized) return;
  _initialized = true;

  const client = getClient();

  await client.executeMultiple(`
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

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      title TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      fact TEXT NOT NULL,
      source_conversation_id TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

// Ensure tables are initialized before any DB access
const initPromise = initTables();

export function getDb(): LibSQLDatabase<typeof schema> {
  if (!_db) {
    _db = drizzle(getClient(), { schema });
  }
  return _db;
}

// Lazy proxy that ensures init before access
export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_target, prop) {
    const instance = getDb();
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});

// Raw query helpers (async replacements for sqlite.prepare)
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  ...args: unknown[]
): Promise<T | undefined> {
  await initPromise;
  const client = getClient();
  const result = await client.execute({ sql, args: args as Array<string | number | null> });
  return result.rows[0] as T | undefined;
}

export async function queryAll<T = Record<string, unknown>>(
  sql: string,
  ...args: unknown[]
): Promise<T[]> {
  await initPromise;
  const client = getClient();
  const result = await client.execute({ sql, args: args as Array<string | number | null> });
  return result.rows as T[];
}

export async function execute(sql: string, ...args: unknown[]) {
  await initPromise;
  const client = getClient();
  return client.execute({ sql, args: args as Array<string | number | null> });
}

// Ensure init completes
export { initPromise };

// Helper to sync FTS index — removed (FTS5 not supported on Turso)
// Use LIKE queries or application-level search instead
export async function indexHistoryEntry(_id: string, _title: string | null, _body: string | null) {
  // No-op: FTS not available on Turso
}

export async function searchHistory(query: string, clientId: string) {
  await initPromise;
  const client = getClient();
  const likeQuery = `%${query}%`;
  const result = await client.execute({
    sql: `SELECT * FROM history_entries
          WHERE client_id = ? AND (title LIKE ? OR body LIKE ?)
          ORDER BY created_at DESC
          LIMIT 50`,
    args: [clientId, likeQuery, likeQuery],
  });
  return result.rows;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
