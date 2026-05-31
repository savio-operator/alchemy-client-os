import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuthedClient } from "@/lib/integrations/google";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { validateEmailRecipients } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`gmail:read:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  try {
    const auth = await getAuthedClient();
    const gmail = google.gmail({ version: "v1", auth });

    const res = await gmail.users.messages.list({
      userId: "me",
      maxResults: 20,
      labelIds: ["INBOX"],
    });

    const messages = res.data.messages || [];

    const emails = await Promise.all(
      messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "metadata",
          metadataHeaders: ["From", "To", "Subject", "Date"],
        });

        const headers = detail.data.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name === name)?.value || "";

        return {
          id: msg.id,
          threadId: msg.threadId,
          from: getHeader("From"),
          to: getHeader("To"),
          subject: getHeader("Subject"),
          date: getHeader("Date"),
          snippet: detail.data.snippet || "",
        };
      })
    );

    return NextResponse.json({ emails });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Failed to fetch emails";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 10 sends per minute
  const rl = rateLimit(`gmail:send:${user.id}`, { maxRequests: 10, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  try {
    const { to, subject, body } = await request.json();

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, body" },
        { status: 400 }
      );
    }

    // Validate recipient email
    const { valid, invalid } = validateEmailRecipients(to);
    if (!valid) {
      return NextResponse.json(
        { error: `Invalid email address: ${invalid.join(", ")}` },
        { status: 400 }
      );
    }

    const auth = await getAuthedClient();
    const gmail = google.gmail({ version: "v1", auth });

    const rawMessage = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/html; charset=utf-8",
      "",
      body,
    ].join("\r\n");

    const encodedMessage = Buffer.from(rawMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    // Audit log
    await logAudit({
      action: "gmail.send",
      resource: "google/gmail",
      detail: { to, subject },
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      messageId: res.data.id,
      threadId: res.data.threadId,
    });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Failed to send email";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
