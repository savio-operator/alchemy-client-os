import { TwitterApi } from "twitter-api-v2";
import { getIntegrationTokens, saveIntegrationTokens } from "@/lib/integration-store";
import crypto from "crypto";
import { db, initPromise } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

async function getClient(): Promise<TwitterApi> {
  const tokens = await getIntegrationTokens("x");
  if (!tokens) throw new Error("X not connected");
  return new TwitterApi(tokens.accessToken);
}

export async function getXOAuthUrl(): Promise<{ url: string; state: string }> {
  const clientId = process.env.X_CLIENT_ID;
  if (!clientId) throw new Error("X_CLIENT_ID not configured");

  await initPromise;

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/x/callback`;
  const state = crypto.randomBytes(16).toString("hex");

  // Generate PKCE
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  // Store verifier in DB with expiry (10 min)
  const key = `pkce:x:${state}`;
  const value = JSON.stringify({ verifier: codeVerifier, expiresAt: Date.now() + 10 * 60 * 1000 });

  const existing = await db.select().from(settings).where(eq(settings.key, key)).get();
  if (existing) {
    await db.update(settings).set({ value }).where(eq(settings.key, key)).run();
  } else {
    await db.insert(settings).values({ key, value }).run();
  }

  const scope = "tweet.read tweet.write users.read offline.access";
  const url = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

  return { url, state };
}

export async function exchangeXCode(code: string, state: string): Promise<void> {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("X credentials not configured");

  await initPromise;

  // Retrieve PKCE verifier from DB
  const key = `pkce:x:${state}`;
  const row = await db.select().from(settings).where(eq(settings.key, key)).get();
  if (!row) throw new Error("Invalid or expired OAuth state");

  const { verifier, expiresAt } = JSON.parse(row.value);
  if (Date.now() > expiresAt) {
    await db.delete(settings).where(eq(settings.key, key)).run();
    throw new Error("OAuth state expired");
  }

  // Clean up
  await db.delete(settings).where(eq(settings.key, key)).run();

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/x/callback`;

  const client = new TwitterApi({ clientId, clientSecret });
  const { accessToken, refreshToken, expiresIn } = await client.loginWithOAuth2({
    code,
    codeVerifier: verifier,
    redirectUri,
  });

  await saveIntegrationTokens("x", {
    accessToken,
    refreshToken,
    expiresAt: expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : undefined,
    scope: "tweet.read,tweet.write,users.read",
  });
}

export async function refreshXToken(): Promise<void> {
  const tokens = await getIntegrationTokens("x");
  if (!tokens?.refreshToken) throw new Error("No refresh token");

  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("X credentials not configured");

  const client = new TwitterApi({ clientId, clientSecret });
  const { accessToken, refreshToken, expiresIn } = await client.refreshOAuth2Token(
    tokens.refreshToken
  );

  await saveIntegrationTokens("x", {
    accessToken,
    refreshToken: refreshToken || tokens.refreshToken,
    expiresAt: expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : undefined,
    scope: tokens.scope,
  });
}

export async function postTweet(text: string) {
  const client = await getClient();
  return client.v2.tweet(text);
}

export async function getMentions(userId?: string) {
  const client = await getClient();
  if (!userId) {
    const me = await client.v2.me();
    userId = me.data.id;
  }
  return client.v2.userMentionTimeline(userId, { max_results: 20 });
}

export async function getMe() {
  const client = await getClient();
  return client.v2.me();
}
