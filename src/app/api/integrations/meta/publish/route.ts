import { NextResponse } from "next/server";
import { getPages, publishToFacebook, createInstagramContainer, publishInstagramContainer, getInstagramAccount } from "@/lib/integrations/meta";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`meta:publish:${user.id}`, { maxRequests: 10, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  const body = await request.json();
  const { platform, message, imageUrl, pageId } = body as {
    platform: "facebook" | "instagram";
    message: string;
    imageUrl?: string;
    pageId?: string;
  };

  try {
    const pages = await getPages();
    const page = pageId ? pages.find((p) => p.id === pageId) : pages[0];
    if (!page) {
      return NextResponse.json({ error: "No Facebook page found" }, { status: 400 });
    }

    if (platform === "facebook") {
      const result = await publishToFacebook(page.id, page.access_token, message);

      await logAudit({
        action: "meta.publish.facebook",
        resource: "meta/facebook",
        detail: { pageId: page.id, messageLength: message?.length || 0 },
        userId: user.id,
      });

      return NextResponse.json(result);
    }

    if (platform === "instagram") {
      if (!imageUrl) {
        return NextResponse.json({ error: "Instagram requires an image URL" }, { status: 400 });
      }
      const igId = await getInstagramAccount(page.id);
      if (!igId) {
        return NextResponse.json({ error: "No Instagram business account linked" }, { status: 400 });
      }
      const container = await createInstagramContainer(igId, imageUrl, message);
      const published = await publishInstagramContainer(igId, container.id);

      await logAudit({
        action: "meta.publish.instagram",
        resource: "meta/instagram",
        detail: { igId, captionLength: message?.length || 0 },
        userId: user.id,
      });

      return NextResponse.json(published);
    }

    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Publish failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
