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
  let keepalive: ReturnType<typeof setInterval> | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  // Single place to tear everything down so no timer outlives the connection.
  const cleanup = () => {
    if (!alive) return;
    alive = false;
    if (keepalive) clearInterval(keepalive);
    if (pollTimer) clearTimeout(pollTimer);
  };

  // The browser/proxy often drops a backgrounded SSE connection WITHOUT calling
  // the stream's cancel(), so abort is our reliable disconnect signal.
  request.signal.addEventListener("abort", cleanup);

  const stream = new ReadableStream({
    async start(controller) {
      // Writing to a closed/cancelled controller throws — that's our cue that
      // the client is gone, so always tear down rather than swallowing it.
      const safeEnqueue = (chunk: string): boolean => {
        try {
          controller.enqueue(encoder.encode(chunk));
          return true;
        } catch {
          cleanup();
          return false;
        }
      };

      // Send initial keepalive
      if (!safeEnqueue(": keepalive\n\n")) return;

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
            if (!safeEnqueue(`data: ${data}\n\n`)) return; // client gone — stop polling
            if (msg.createdAt > lastSeen) lastSeen = msg.createdAt;
          }
        } catch {
          // DB error — skip this poll cycle, but keep the loop alive
        }

        if (alive) {
          pollTimer = setTimeout(poll, 3000);
        }
      };

      // Start polling after initial delay
      pollTimer = setTimeout(poll, 3000);

      // Send keepalive every 15s to prevent connection timeout
      keepalive = setInterval(() => {
        if (!alive) { if (keepalive) clearInterval(keepalive); return; }
        safeEnqueue(": keepalive\n\n");
      }, 15000);
    },
    cancel() {
      cleanup();
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
