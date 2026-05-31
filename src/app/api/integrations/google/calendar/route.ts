import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuthedClient } from "@/lib/integrations/google";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { validateEmailRecipients } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`calendar:read:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  try {
    const auth = await getAuthedClient();
    const calendar = google.calendar({ version: "v3", auth });

    const now = new Date();
    const oneWeekFromNow = new Date(
      now.getTime() + 7 * 24 * 60 * 60 * 1000
    );

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: oneWeekFromNow.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50,
    });

    const events = (res.data.items || []).map((event) => ({
      id: event.id,
      summary: event.summary || "",
      description: event.description || "",
      start: event.start?.dateTime || event.start?.date || "",
      end: event.end?.dateTime || event.end?.date || "",
      location: event.location || "",
      attendees: (event.attendees || []).map((a) => ({
        email: a.email,
        responseStatus: a.responseStatus,
      })),
      htmlLink: event.htmlLink || "",
    }));

    return NextResponse.json({ events });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Failed to fetch events";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 20 event creations per minute
  const rl = rateLimit(`calendar:create:${user.id}`, { maxRequests: 20, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  try {
    const { summary, start, end, description, attendees } =
      await request.json();

    if (!summary || !start || !end) {
      return NextResponse.json(
        { error: "Missing required fields: summary, start, end" },
        { status: 400 }
      );
    }

    const auth = await getAuthedClient();
    const calendar = google.calendar({ version: "v3", auth });

    const eventBody: {
      summary: string;
      description?: string;
      start: { dateTime: string; timeZone?: string };
      end: { dateTime: string; timeZone?: string };
      attendees?: Array<{ email: string }>;
    } = {
      summary,
      start: { dateTime: start },
      end: { dateTime: end },
    };

    if (description) {
      eventBody.description = description;
    }

    if (attendees && Array.isArray(attendees)) {
      // Validate attendee emails
      const { valid, invalid } = validateEmailRecipients(attendees);
      if (!valid) {
        return NextResponse.json(
          { error: `Invalid attendee email(s): ${invalid.join(", ")}` },
          { status: 400 }
        );
      }
      eventBody.attendees = attendees.map((email: string) => ({ email: email.trim() }));
    }

    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: eventBody,
    });

    // Audit log
    await logAudit({
      action: "calendar.create",
      resource: "google/calendar",
      detail: { summary, attendees: attendees || [] },
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      event: {
        id: res.data.id,
        summary: res.data.summary,
        start: res.data.start?.dateTime || res.data.start?.date,
        end: res.data.end?.dateTime || res.data.end?.date,
        htmlLink: res.data.htmlLink,
      },
    });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Failed to create event";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
