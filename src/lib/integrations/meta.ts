import { getIntegrationTokens, saveIntegrationTokens } from "@/lib/integration-store";

const META_API = "https://graph.facebook.com/v21.0";

async function getTokens() {
  const tokens = await getIntegrationTokens("meta");
  if (!tokens) throw new Error("Meta not connected");
  return tokens;
}

async function metaFetch(path: string, options?: RequestInit) {
  const tokens = await getTokens();
  const url = `${META_API}${path}${path.includes("?") ? "&" : "?"}access_token=${tokens.accessToken}`;
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Meta API error");
  }
  return res.json();
}

export async function getPages(): Promise<Array<{ id: string; name: string; access_token: string }>> {
  const data = await metaFetch("/me/accounts");
  return data.data;
}

export async function getInstagramAccount(pageId: string): Promise<string | null> {
  const data = await metaFetch(`/${pageId}?fields=instagram_business_account`);
  return data.instagram_business_account?.id || null;
}

export async function publishToFacebook(
  pageId: string,
  pageAccessToken: string,
  message: string,
  link?: string
) {
  const body: Record<string, string> = { message };
  if (link) body.link = link;

  const res = await fetch(`${META_API}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: pageAccessToken }),
  });
  return res.json();
}

export async function createInstagramContainer(
  igUserId: string,
  imageUrl: string,
  caption: string
) {
  return metaFetch(`/${igUserId}/media`, {
    method: "POST",
    body: JSON.stringify({ image_url: imageUrl, caption }),
  });
}

export async function publishInstagramContainer(igUserId: string, containerId: string) {
  return metaFetch(`/${igUserId}/media_publish`, {
    method: "POST",
    body: JSON.stringify({ creation_id: containerId }),
  });
}

export async function getPageInsights(pageId: string, metric: string, period: string = "day") {
  return metaFetch(`/${pageId}/insights?metric=${metric}&period=${period}`);
}

export function getMetaOAuthUrl(): string {
  const clientId = process.env.META_APP_ID;
  if (!clientId) throw new Error("META_APP_ID not configured");

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/meta/callback`;
  const scope = "pages_show_list,pages_manage_posts,instagram_basic,instagram_content_publish,read_insights";

  return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code`;
}

export async function exchangeMetaCode(code: string): Promise<void> {
  const clientId = process.env.META_APP_ID;
  const clientSecret = process.env.META_APP_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/meta/callback`;

  const res = await fetch(
    `${META_API}/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${clientSecret}&code=${code}`
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  // Exchange for long-lived token
  const longRes = await fetch(
    `${META_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${data.access_token}`
  );
  const longData = await longRes.json();

  await saveIntegrationTokens("meta", {
    accessToken: longData.access_token || data.access_token,
    expiresAt: longData.expires_in
      ? new Date(Date.now() + longData.expires_in * 1000).toISOString()
      : undefined,
    scope: "pages,instagram",
  });
}
