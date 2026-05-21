import { NextResponse } from "next/server";
import { getPages, publishToFacebook, createInstagramContainer, publishInstagramContainer, getInstagramAccount } from "@/lib/integrations/meta";

export async function POST(request: Request) {
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
      return NextResponse.json(published);
    }

    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Publish failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
