import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUpdateCounts } from "@/lib/update-tracker";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const counts = await getUpdateCounts(user.id);
  return NextResponse.json(counts);
}
