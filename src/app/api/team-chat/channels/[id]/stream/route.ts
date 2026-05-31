import { db } from "@/db";
import { chatMessages, chatChannelMembers, users } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: channelId } = await params;

  // Verify membership
  const membership = await db
    .select()
    .from(chatChannelMembers)
    .where(and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, user.id)))
    .get();

  if (!membership) {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();
  let lastSeen = new Date().toISOString();
  let alive = true;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial keepalive
      controller.enqueue(encoder.encode(": keepalive\n\n"));

      const poll = async () => {
        if (!alive) return;

        try {
          const newMsgs = await db
            .select()
            .from(chatMessages)
            .where(and(eq(chatMessages.channelId, channelId), gt(chatMessages.createdAt, lastSeen)))
            .all();

          for (const msg of newMsgs) {
            const u = await db.select().from(users).where(eq(users.id, msg.userId)).get();
            const data = JSON.stringify({ ...msg, userName: u?.name || "Unknown", userRole: u?.role || "member" });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            if (msg.createdAt > lastSeen) lastSeen = msg.createdAt;
          }
        } catch {
          // DB error — skip this poll cycle
        }

        if (alive) {
          setTimeout(poll, 3000);
        }
      };

      // Start polling after initial delay
      setTimeout(poll, 3000);

      // Send keepalive every 15s to prevent connection timeout
      const keepalive = setInterval(() => {
        if (!alive) { clearInterval(keepalive); return; }
        try { controller.enqueue(encoder.encode(": keepalive\n\n")); } catch { clearInterval(keepalive); }
      }, 15000);
    },
    cancel() {
      alive = false;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
