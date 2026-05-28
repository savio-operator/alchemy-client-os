import { google } from "googleapis";
import {
  getIntegrationTokens,
  saveIntegrationTokens,
} from "@/lib/integration-store";
import crypto from "crypto";

const SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/spreadsheets",
];

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error("Google credentials not configured");

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/google/callback`;

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function getAuthedClient(userId?: string) {
  const tokens = await getIntegrationTokens("google", userId);
  if (!tokens) throw new Error("Google not connected");

  const client = getOAuth2Client();
  client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiresAt
      ? new Date(tokens.expiresAt).getTime()
      : undefined,
  });

  // Auto-refresh handler
  client.on("tokens", async (newTokens) => {
    const existing = await getIntegrationTokens("google", userId);
    await saveIntegrationTokens("google", {
      accessToken: newTokens.access_token || existing?.accessToken || "",
      refreshToken:
        newTokens.refresh_token || existing?.refreshToken || undefined,
      expiresAt: newTokens.expiry_date
        ? new Date(newTokens.expiry_date).toISOString()
        : existing?.expiresAt,
      scope: existing?.scope,
    }, userId);
  });

  return client;
}

// --- OAuth ---

export function getGoogleOAuthUrl(userId?: string): { url: string; state: string } {
  const client = getOAuth2Client();
  // Embed userId in state so callback can save per-user tokens
  const statePayload = userId
    ? JSON.stringify({ nonce: crypto.randomBytes(16).toString("hex"), userId })
    : crypto.randomBytes(16).toString("hex");
  const state = Buffer.from(statePayload).toString("base64url");

  const url = client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    state,
    prompt: "consent",
  });

  return { url, state };
}

export function parseOAuthState(state: string): { userId?: string } {
  try {
    const decoded = Buffer.from(state, "base64url").toString();
    const parsed = JSON.parse(decoded);
    return { userId: parsed.userId };
  } catch {
    return {};
  }
}

export async function exchangeGoogleCode(code: string, userId?: string): Promise<void> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);

  await saveIntegrationTokens("google", {
    accessToken: tokens.access_token || "",
    refreshToken: tokens.refresh_token || undefined,
    expiresAt: tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : undefined,
    scope: SCOPES.join(","),
  }, userId);
}

// --- Google Analytics 4 ---

export async function listGA4Properties(): Promise<
  Array<{ name: string; displayName: string; propertyId: string }>
> {
  const auth = await getAuthedClient();
  const admin = google.analyticsadmin({ version: "v1beta", auth });

  const res = await admin.properties.list({
    filter: 'parent:accounts/-',
    pageSize: 50,
  });

  return (res.data.properties || []).map((p) => ({
    name: p.name || "",
    displayName: p.displayName || "",
    propertyId: (p.name || "").replace("properties/", ""),
  }));
}

export async function getGA4Report(
  propertyId: string,
  startDate = "28daysAgo",
  endDate = "today"
) {
  const auth = await getAuthedClient();
  const analyticsData = google.analyticsdata({ version: "v1beta", auth });

  const res = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "screenPageViews" },
        { name: "conversions" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
      ],
      dimensions: [{ name: "date" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    },
  });

  const rows = (res.data.rows || []).map((row) => ({
    date: row.dimensionValues?.[0]?.value || "",
    sessions: parseInt(row.metricValues?.[0]?.value || "0"),
    users: parseInt(row.metricValues?.[1]?.value || "0"),
    pageViews: parseInt(row.metricValues?.[2]?.value || "0"),
    conversions: parseInt(row.metricValues?.[3]?.value || "0"),
    bounceRate: parseFloat(row.metricValues?.[4]?.value || "0"),
    avgSessionDuration: parseFloat(row.metricValues?.[5]?.value || "0"),
  }));

  // Totals
  const totals = rows.reduce(
    (acc, r) => ({
      sessions: acc.sessions + r.sessions,
      users: acc.users + r.users,
      pageViews: acc.pageViews + r.pageViews,
      conversions: acc.conversions + r.conversions,
    }),
    { sessions: 0, users: 0, pageViews: 0, conversions: 0 }
  );

  return { rows, totals, startDate, endDate };
}

export async function getGA4TopPages(
  propertyId: string,
  startDate = "28daysAgo",
  endDate = "today"
) {
  const auth = await getAuthedClient();
  const analyticsData = google.analyticsdata({ version: "v1beta", auth });

  const res = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }],
      dimensions: [{ name: "pagePath" }],
      orderBys: [
        { metric: { metricName: "screenPageViews" }, desc: true },
      ],
      limit: "20",
    },
  });

  return (res.data.rows || []).map((row) => ({
    path: row.dimensionValues?.[0]?.value || "",
    views: parseInt(row.metricValues?.[0]?.value || "0"),
    users: parseInt(row.metricValues?.[1]?.value || "0"),
  }));
}

export async function getGA4TrafficSources(
  propertyId: string,
  startDate = "28daysAgo",
  endDate = "today"
) {
  const auth = await getAuthedClient();
  const analyticsData = google.analyticsdata({ version: "v1beta", auth });

  const res = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: "10",
    },
  });

  return (res.data.rows || []).map((row) => ({
    channel: row.dimensionValues?.[0]?.value || "",
    sessions: parseInt(row.metricValues?.[0]?.value || "0"),
    users: parseInt(row.metricValues?.[1]?.value || "0"),
  }));
}

// --- Google Search Console ---

export async function listSearchConsoleSites(): Promise<
  Array<{ siteUrl: string; permissionLevel: string }>
> {
  const auth = await getAuthedClient();
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const res = await searchconsole.sites.list();

  return (res.data.siteEntry || []).map((s) => ({
    siteUrl: s.siteUrl || "",
    permissionLevel: s.permissionLevel || "",
  }));
}

export async function getSearchConsoleData(
  siteUrl: string,
  startDate?: string,
  endDate?: string
) {
  const auth = await getAuthedClient();
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const now = new Date();
  const end =
    endDate ||
    new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]; // 2 days ago (data delay)
  const start =
    startDate ||
    new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]; // 30 days ago

  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: start,
      endDate: end,
      dimensions: ["query"],
      rowLimit: 25,
    },
  });

  return {
    rows: (res.data.rows || []).map((r) => ({
      query: r.keys?.[0] || "",
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: r.ctr || 0,
      position: r.position || 0,
    })),
    startDate: start,
    endDate: end,
  };
}

export async function getSearchConsolePages(
  siteUrl: string,
  startDate?: string,
  endDate?: string
) {
  const auth = await getAuthedClient();
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const now = new Date();
  const end =
    endDate ||
    new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
  const start =
    startDate ||
    new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: start,
      endDate: end,
      dimensions: ["page"],
      rowLimit: 25,
    },
  });

  return {
    rows: (res.data.rows || []).map((r) => ({
      page: r.keys?.[0] || "",
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: r.ctr || 0,
      position: r.position || 0,
    })),
    startDate: start,
    endDate: end,
  };
}
