import { db } from "@/db";
import { sessions, settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import crypto from "crypto";

const SESSION_COOKIE = "adchemy_session";
const SESSION_DAYS = 30;

export async function isPinSet(): Promise<boolean> {
  const result = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "pin_hash"))
    .get();
  return !!result;
}

export async function setPin(pin: string): Promise<void> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 64).toString("hex");
  const stored = `${salt}:${hash}`;
  await db.insert(settings)
    .values({ key: "pin_hash", value: stored })
    .onConflictDoUpdate({ target: settings.key, set: { value: stored } })
    .run();
}

export async function verifyPin(pin: string): Promise<boolean> {
  const result = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "pin_hash"))
    .get();
  if (!result) return false;

  const [salt, storedHash] = result.value.split(":");
  const hash = crypto.scryptSync(pin, salt, 64).toString("hex");
  return hash === storedHash;
}

export async function createSession(): Promise<string> {
  const id = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  await db.insert(sessions)
    .values({ id, expiresAt, createdAt: new Date().toISOString() })
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

export async function validateSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return false;

  const session = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get();

  if (!session) return false;

  if (new Date(session.expiresAt) < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    return false;
  }

  // Rolling session: extend expiry
  const newExpiry = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  await db.update(sessions)
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

  return true;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    cookieStore.delete(SESSION_COOKIE);
  }
}
