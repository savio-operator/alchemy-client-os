import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { approveUser, rejectUser, getUserById, updateUserRole } from "@/lib/user";
import type { UserRole } from "@/lib/user";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "founder") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action, role } = body as {
    action: "approve" | "reject" | "change_role";
    role?: UserRole;
  };

  const targetUser = await getUserById(id);
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  switch (action) {
    case "approve": {
      const assignRole = role || "member";
      const updated = await approveUser(id, assignRole, currentUser.id);
      return NextResponse.json(updated);
    }
    case "reject": {
      await rejectUser(id);
      return NextResponse.json({ success: true });
    }
    case "change_role": {
      if (!role) {
        return NextResponse.json(
          { error: "Role is required" },
          { status: 400 }
        );
      }
      const updated = await updateUserRole(id, role);
      return NextResponse.json(updated);
    }
    default:
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
  }
}
