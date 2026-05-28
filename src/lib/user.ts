import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";
import crypto from "crypto";

export type UserRole = "founder" | "manager" | "member";
export type UserStatus = "pending" | "active" | "rejected";

export async function createUser(
  name: string,
  email: string,
  password: string,
  role: UserRole = "member",
  status: UserStatus = "pending"
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = hashPassword(password);

  await db
    .insert(users)
    .values({
      id,
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,
      status,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return db.select().from(users).where(eq(users.id, id)).get();
}

export async function getUserById(id: string) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

export async function getUserByEmail(email: string) {
  return db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .get();
}

export async function getAllUsers() {
  return db.select().from(users).all();
}

export async function getPendingUsers() {
  return db.select().from(users).where(eq(users.status, "pending")).all();
}

export async function approveUser(
  userId: string,
  role: UserRole,
  approvedById: string
) {
  const now = new Date().toISOString();
  await db
    .update(users)
    .set({ status: "active", role, approvedBy: approvedById, updatedAt: now })
    .where(eq(users.id, userId))
    .run();
  return db.select().from(users).where(eq(users.id, userId)).get();
}

export async function rejectUser(userId: string) {
  const now = new Date().toISOString();
  await db
    .update(users)
    .set({ status: "rejected", updatedAt: now })
    .where(eq(users.id, userId))
    .run();
}

export async function updateUserRole(userId: string, role: UserRole) {
  const now = new Date().toISOString();
  await db
    .update(users)
    .set({ role, updatedAt: now })
    .where(eq(users.id, userId))
    .run();
  return db.select().from(users).where(eq(users.id, userId)).get();
}
