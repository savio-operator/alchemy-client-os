import { TwitterApi } from "twitter-api-v2";
import { getIntegrationTokens, saveIntegrationTokens } from "@/lib/integration-store";
import crypto from "crypto";

// Store PKCE verifiers in memory (short-lived, used during OAuth flow)
const pkceVerifiers = new Map<string, string>();

function getClient(): TwitterApi {
  const tokens = getIntegrationTokens("x");
  if (!tokens) throw new Error("X not connected");
  return new TwitterApi(tokens.accessToken);
}

export function getXOAuthUrl(): { url: string; state: string } {
  const clientId = process.env.X_CLIENT_ID;
  if (!clientId) throw new Error("X_CLIENT_ID not configured");

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/x/callback`;
  const state = crypto.randomBytes(16).toString("hex");

  // Generate PKCE
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  pkceVerifiers.set(state, codeVerifier);

  // Clean up verifiers after 10 minutes
  setTimeout(() => pkceVerifiers.delete(state), 10 * 60 * 1000);

  const scope = "tweet.read tweet.write users.read offline.access";
  const url = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

  return { url, state };
}

export async function exchangeXCode(code: string, state: string): Promise<void> {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("X credentials not configured");

  const codeVerifier = pkceVerifiers.get(state);
  if (!codeVerifier) throw new Error("Invalid or expired OAuth state");
  pkceVerifiers.delete(state);

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/x/callback`;

  const client = new TwitterApi({ clientId, clientSecret });
  const { accessToken, refreshToken, expiresIn } = await client.loginWithOAuth2({
    code,
    codeVerifier,
    redirectUri,
  });

  saveIntegrationTokens("x", {
    accessToken,
    refreshToken,
    expiresAt: expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : undefined,
    scope: "tweet.read,tweet.write,users.read",
  });
}

export async function refreshXToken(): Promise<void> {
  const tokens = getIntegrationTokens("x");
  if (!tokens?.refreshToken) throw new Error("No refresh token");

  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("X credentials not configured");

  const client = new TwitterApi({ clientId, clientSecret });
  const { accessToken, refreshToken, expiresIn } = await client.refreshOAuth2Token(
    tokens.refreshToken
  );

  saveIntegrationTokens("x", {
    accessToken,
    refreshToken: refreshToken || tokens.refreshToken,
    expiresAt: expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : undefined,
    scope: tokens.scope,
  });
}

export async function postTweet(text: string) {
  const client = getClient();
  return client.v2.tweet(text);
}

export async function getMentions(userId?: string) {
  const client = getClient();
  if (!userId) {
    const me = await client.v2.me();
    userId = me.data.id;
  }
  return client.v2.userMentionTimeline(userId, { max_results: 20 });
}

export async function getMe() {
  const client = getClient();
  return client.v2.me();
}
