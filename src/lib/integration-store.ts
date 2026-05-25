import crypto from "crypto";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.DB_KEY;
  if (!key) {
    throw new Error("DB_KEY environment variable is required for encrypted token storage");
  }
  // Derive a 32-byte key from the provided key
  return crypto.scryptSync(key, "adchemy-salt", 32);
}

function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  // Store as iv:tag:encrypted
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

function decrypt(data: string): string {
  const key = getEncryptionKey();
  const [ivHex, tagHex, encrypted] = data.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export interface IntegrationTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scope?: string;
  extra?: Record<string, string>;
}

export async function saveIntegrationTokens(
  provider: string,
  tokens: IntegrationTokens
): Promise<void> {
  const encrypted = encrypt(JSON.stringify(tokens));
  await db.insert(settings)
    .values({ key: `integration:${provider}`, value: encrypted })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: encrypted },
    })
    .run();
}

export async function getIntegrationTokens(
  provider: string
): Promise<IntegrationTokens | null> {
  const row = await db
    .select()
    .from(settings)
    .where(eq(settings.key, `integration:${provider}`))
    .get();

  if (!row) return null;

  try {
    return JSON.parse(decrypt(row.value));
  } catch {
    return null;
  }
}

export async function deleteIntegrationTokens(provider: string): Promise<void> {
  await db.delete(settings)
    .where(eq(settings.key, `integration:${provider}`))
    .run();
}

export async function isIntegrationConnected(provider: string): Promise<boolean> {
  const tokens = await getIntegrationTokens(provider);
  if (!tokens) return false;
  if (tokens.expiresAt && new Date(tokens.expiresAt) < new Date()) {
    return false;
  }
  return true;
}

export async function listIntegrations(): Promise<Array<{
  provider: string;
  connected: boolean;
}>> {
  const providers = ["meta", "x", "linkedin", "google", "razorpay"];
  const results = await Promise.all(
    providers.map(async (p) => ({
      provider: p,
      connected: await isIntegrationConnected(p),
    }))
  );
  return results;
}
