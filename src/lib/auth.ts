import { db } from "@/db";
import { sessions, settings, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import crypto from "crypto";

const SESSION_COOKIE = "adchemy_session";
const SESSION_DAYS = 30;

// --- Password hashing ---

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, storedHash] = stored.split(":");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return hash === storedHash;
}

// --- Session management ---

export async function createSession(userId: string): Promise<string> {
  const id = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  await db
    .insert(sessions)
    .values({ id, userId, expiresAt, createdAt: new Date().toISOString() })
    .run();

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  });

  return id;
}

export async function validateSession(): Promise<{
  valid: boolean;
  user: typeof users.$inferSelect | null;
}> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return { valid: false, user: null };

  const session = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get();

  if (!session) return { valid: false, user: null };

  if (new Date(session.expiresAt) < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    return { valid: false, user: null };
  }

  // Get user
  if (!session.userId) return { valid: false, user: null };

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .get();

  if (!user || user.status !== "active") return { valid: false, user: null };

  // Rolling session: extend expiry
  const newExpiry = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  await db
    .update(sessions)
    .set({ expiresAt: newExpiry })
    .where(eq(sessions.id, sessionId))
    .run();

  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  });

  return { valid: true, user };
}

export async function getCurrentUser() {
  const { user } = await validateSession();
  return user;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    cookieStore.delete(SESSION_COOKIE);
  }
}

// --- Migration helpers ---

export async function isPinSet(): Promise<boolean> {
  const result = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "pin_hash"))
    .get();
  return !!result;
}

export async function hasUsers(): Promise<boolean> {
  const result = await db.select().from(users).limit(1).all();
  return result.length > 0;
}
