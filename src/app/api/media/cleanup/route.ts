import { NextResponse } from "next/server";
import { db } from "@/db";
import { chatMessages } from "@/db/schema";
import { deleteFromR2 } from "@/lib/r2";
import { execute } from "@/db";

export async function GET() {
  // Find expired media messages
  const now = new Date().toISOString();

  const expired = await execute(
    `SELECT id, media_url FROM chat_messages WHERE media_url IS NOT NULL AND media_expires_at IS NOT NULL AND media_expires_at < ?`,
    now
  );

  let deleted = 0;
  for (const row of expired.rows) {
    const mediaUrl = row.media_url as string;
    try {
      // Extract R2 key from URL
      const key = mediaUrl.includes("/") ? mediaUrl.split("/").slice(-2).join("/") : mediaUrl;
      await deleteFromR2(`media/${key}`);
    } catch {
      // R2 deletion failed — continue anyway
    }

    // Clear media fields from the message
    await execute(
      `UPDATE chat_messages SET media_url = NULL, media_type = NULL, media_expires_at = NULL WHERE id = ?`,
      row.id as string
    );
    deleted++;
  }

  return NextResponse.json({ deleted });
}
