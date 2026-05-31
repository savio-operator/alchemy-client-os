import crypto from "crypto";
import { db, initPromise } from "@/db";
import { auditLog } from "@/db/schema";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";

export async function logAudit(params: {
  action: string;
  resource?: string;
  detail?: Record<string, unknown>;
  userId?: string;
}) {
  try {
    await initPromise;
    const headerList = await headers();
    const ip =
      headerList.get("x-forwarded-for") ||
      headerList.get("x-real-ip") ||
      "unknown";
    const userAgent = headerList.get("user-agent") || "unknown";

    let userId = params.userId;
    if (!userId) {
      const user = await getCurrentUser();
      userId = user?.id;
    }

    await db
      .insert(auditLog)
      .values({
        id: crypto.randomUUID(),
        userId: userId || null,
        action: params.action,
        resource: params.resource || null,
        detail: params.detail ? JSON.stringify(params.detail) : null,
        ip,
        userAgent,
        createdAt: new Date().toISOString(),
      })
      .run();
  } catch {
    // Audit logging should never break the request
    console.error("[audit] Failed to log:", params.action);
  }
}
