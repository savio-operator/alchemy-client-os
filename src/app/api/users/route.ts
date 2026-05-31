import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAllUsers } from "@/lib/user";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allUsers = await getAllUsers();

  // Founders see full details; others see limited info (no email, no createdAt)
  if (currentUser.role === "founder") {
    return NextResponse.json(
      allUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
      }))
    );
  }

  // Non-founders see only active users with limited fields
  return NextResponse.json(
    allUsers
      .filter((u) => u.status === "active")
      .map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        status: u.status,
      }))
  );
}
