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
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      status TEXT NOT NULL DEFAULT 'pending',
      avatar_url TEXT,
      approved_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      number TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'draft',
      due_date TEXT,
      paid_at TEXT,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      company TEXT,
      email TEXT,
      phone TEXT,
      source TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      notes TEXT,
      assigned_to TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date TEXT,
      assigned_to TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
      title TEXT,
      body TEXT NOT NULL,
      tags TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deliverables (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      type TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      file_url TEXT,
      delivered_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      link TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      marked_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_user_date
      ON attendance(user_id, date);

    CREATE TABLE IF NOT EXISTS user_client_access (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      access_level TEXT NOT NULL DEFAULT 'view',
      assigned_by TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, client_id)
    );

    CREATE TABLE IF NOT EXISTS chat_channels (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_channel_members (
      channel_id TEXT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TEXT NOT NULL,
      last_read_at TEXT,
      PRIMARY KEY (channel_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      media_url TEXT,
      media_type TEXT,
      media_expires_at TEXT,
      reply_to_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_section_visits (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      section TEXT NOT NULL,
      last_visited_at TEXT NOT NULL,
      PRIMARY KEY (user_id, section)
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      rate REAL NOT NULL,
      amount REAL NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);

  // New tables for Discord-like chat
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS chat_reactions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_presence (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'offline',
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_polls (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
      message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      options TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_poll_votes (
      id TEXT PRIMARY KEY,
      poll_id TEXT NOT NULL REFERENCES chat_polls(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      option_index INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_poll_votes_user
      ON chat_poll_votes(poll_id, user_id);

    CREATE TABLE IF NOT EXISTS voice_participants (
      channel_id TEXT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TEXT NOT NULL,
      muted INTEGER DEFAULT 0,
      deafened INTEGER DEFAULT 0,
      PRIMARY KEY (channel_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS voice_signals (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      from_user_id TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Finance tables
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS finance_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT,
      amount REAL NOT NULL,
      client TEXT,
      month TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS finance_settings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      currency TEXT NOT NULL DEFAULT 'INR',
      expected_monthly_income REAL DEFAULT 0,
      salaries TEXT,
      recurring_expenses TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_settings_user
      ON finance_settings(user_id);

    CREATE TABLE IF NOT EXISTS monthly_fixed_costs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      salaries TEXT,
      recurring_expenses TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_fixed_costs_user_month
      ON monthly_fixed_costs(user_id, month);

    CREATE TABLE IF NOT EXISTS finance_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS finance_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES finance_conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS forecasts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      period TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Challenges table
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      assigned_to TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_by TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'active',
      reward TEXT,
      due_date TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Idempotent ALTER TABLE statements for new columns
  const alters = [
    "ALTER TABLE sessions ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE",
    "ALTER TABLE conversations ADD COLUMN user_id TEXT",
    "ALTER TABLE memories ADD COLUMN user_id TEXT",
    "ALTER TABLE chat_messages ADD COLUMN edited_at TEXT",
    "ALTER TABLE chat_messages ADD COLUMN pinned_at TEXT",
    "ALTER TABLE chat_messages ADD COLUMN pinned_by TEXT",
    "ALTER TABLE chat_channels ADD COLUMN description TEXT",
    "ALTER TABLE chat_channels ADD COLUMN is_private INTEGER DEFAULT 0",
    "ALTER TABLE attendance ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'",
    "ALTER TABLE attendance ADD COLUMN notes TEXT",
    "ALTER TABLE invoices ADD COLUMN tax_percent REAL DEFAULT 0",
    "ALTER TABLE invoices ADD COLUMN discount_amount REAL DEFAULT 0",
    "ALTER TABLE invoices ADD COLUMN notes TEXT",
    "ALTER TABLE invoices ADD COLUMN from_name TEXT",
    "ALTER TABLE invoices ADD COLUMN from_address TEXT",
    "ALTER TABLE invoices ADD COLUMN from_gst TEXT",
  ];
  for (const sql of alters) {
    try {
      await client.execute({ sql, args: [] });
    } catch {
      // Column already exists — ignore
    }
  }
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

/** Await this before any db access to ensure tables exist */
export async function ensureInit() {
  await initPromise;
}

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
