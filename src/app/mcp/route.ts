import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { db, initPromise } from "@/db";
import {
  users,
  tasks,
  challenges,
  attendance,
  notifications,
  clients,
  campaigns,
  ideas,
  socialPosts,
  userClientAccess,
} from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// --- Auth ---

function verifyAdminToken(request: Request): boolean {
  const token = process.env.MCP_ADMIN_TOKEN;
  if (!token) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${token}`;
}

// --- Tool helpers ---

function txt(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function err(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

// --- Build MCP server ---

function buildServer(): McpServer {
  const server = new McpServer({
    name: "adchemy-os",
    version: "2.0.0",
  });

  // ── MEMBERS ──────────────────────────────────────────────────────────────

  server.tool("list_members", "List all team members with name, role, ID, status", {}, async () => {
    await initPromise;
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
      })
      .from(users)
      .all();
    return txt(rows);
  });

  server.tool(
    "get_member",
    "Get one member's full profile by ID",
    { member_id: z.string().describe("User ID") },
    async ({ member_id }) => {
      await initPromise;
      const row = await db.select().from(users).where(eq(users.id, member_id)).get();
      if (!row) return err("Member not found");
      const { passwordHash: _, ...safe } = row;
      return txt(safe);
    }
  );

  server.tool(
    "assign_role",
    "Assign founder/manager/member role to a user (founder-level only)",
    {
      member_id: z.string().describe("User ID"),
      role: z.enum(["founder", "manager", "member"]).describe("New role"),
    },
    async ({ member_id, role }) => {
      await initPromise;
      const existing = await db.select().from(users).where(eq(users.id, member_id)).get();
      if (!existing) return err("Member not found");
      const now = new Date().toISOString();
      await db.update(users).set({ role, updatedAt: now }).where(eq(users.id, member_id)).run();
      return txt({ success: true, member_id, role });
    }
  );

  // ── TASKS ─────────────────────────────────────────────────────────────────

  server.tool(
    "create_task",
    "Create a new task",
    {
      title: z.string().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      assignee_id: z.string().optional().describe("User ID to assign to"),
      client_id: z.string().optional().describe("Client ID (optional)"),
      due_date: z.string().optional().describe("Due date ISO string"),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("Priority"),
    },
    async ({ title, description, assignee_id, client_id, due_date, priority }) => {
      await initPromise;
      const now = new Date().toISOString();
      const task = {
        id: crypto.randomUUID(),
        title,
        description: description ?? null,
        assignedTo: assignee_id ?? null,
        clientId: client_id ?? null,
        dueDate: due_date ?? null,
        priority: priority ?? "medium",
        status: "todo",
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(tasks).values(task).run();
      return txt(task);
    }
  );

  server.tool(
    "assign_task",
    "Assign a task to a team member",
    {
      task_id: z.string().describe("Task ID"),
      assignee_id: z.string().describe("User ID to assign to"),
    },
    async ({ task_id, assignee_id }) => {
      await initPromise;
      const existing = await db.select().from(tasks).where(eq(tasks.id, task_id)).get();
      if (!existing) return err("Task not found");
      const now = new Date().toISOString();
      await db.update(tasks).set({ assignedTo: assignee_id, updatedAt: now }).where(eq(tasks.id, task_id)).run();
      return txt({ success: true, task_id, assignee_id });
    }
  );

  server.tool(
    "list_tasks",
    "List tasks with optional filters",
    {
      assignee_id: z.string().optional().describe("Filter by assignee user ID"),
      client_id: z.string().optional().describe("Filter by client ID"),
      status: z.enum(["todo", "in_progress", "done"]).optional().describe("Filter by status"),
    },
    async ({ assignee_id, client_id, status }) => {
      await initPromise;
      const conditions = [];
      if (assignee_id) conditions.push(eq(tasks.assignedTo, assignee_id));
      if (client_id) conditions.push(eq(tasks.clientId, client_id));
      if (status) conditions.push(eq(tasks.status, status));
      const rows =
        conditions.length > 0
          ? await db.select().from(tasks).where(and(...conditions)).all()
          : await db.select().from(tasks).all();
      return txt(rows);
    }
  );

  server.tool(
    "update_task_status",
    "Update the status of a task",
    {
      task_id: z.string().describe("Task ID"),
      status: z.enum(["todo", "in_progress", "done"]).describe("New status"),
    },
    async ({ task_id, status }) => {
      await initPromise;
      const existing = await db.select().from(tasks).where(eq(tasks.id, task_id)).get();
      if (!existing) return err("Task not found");
      const now = new Date().toISOString();
      const updates: Record<string, unknown> = { status, updatedAt: now };
      if (status === "done" && !existing.completedAt) updates.completedAt = now;
      if (status !== "done") updates.completedAt = null;
      await db.update(tasks).set(updates).where(eq(tasks.id, task_id)).run();
      return txt({ success: true, task_id, status });
    }
  );

  server.tool(
    "delete_task",
    "Delete a task permanently",
    { task_id: z.string().describe("Task ID") },
    async ({ task_id }) => {
      await initPromise;
      const existing = await db.select().from(tasks).where(eq(tasks.id, task_id)).get();
      if (!existing) return err("Task not found");
      await db.delete(tasks).where(eq(tasks.id, task_id)).run();
      return txt({ success: true, deleted: task_id });
    }
  );

  // ── CHALLENGES ────────────────────────────────────────────────────────────

  server.tool(
    "create_challenge",
    "Create a new challenge assigned to a team member",
    {
      title: z.string().describe("Challenge title"),
      description: z.string().optional().describe("Challenge description"),
      assignee_id: z.string().describe("User ID to assign to"),
      reward: z.string().optional().describe("Reward description"),
      due_date: z.string().optional().describe("Due date ISO string"),
    },
    async ({ title, description, assignee_id, reward, due_date }) => {
      await initPromise;
      const assignee = await db.select().from(users).where(eq(users.id, assignee_id)).get();
      if (!assignee) return err("Assignee not found");
      const now = new Date().toISOString();
      const challenge = {
        id: crypto.randomUUID(),
        title,
        description: description ?? null,
        assignedTo: assignee_id,
        assignedBy: "mcp-admin",
        status: "active",
        reward: reward ?? null,
        dueDate: due_date ?? null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(challenges).values(challenge).run();
      return txt(challenge);
    }
  );

  server.tool(
    "list_challenges",
    "List challenges with optional filters",
    {
      assignee_id: z.string().optional().describe("Filter by assignee user ID"),
      status: z.enum(["active", "completed", "expired"]).optional().describe("Filter by status"),
    },
    async ({ assignee_id, status }) => {
      await initPromise;
      const conditions = [];
      if (assignee_id) conditions.push(eq(challenges.assignedTo, assignee_id));
      if (status) conditions.push(eq(challenges.status, status));
      const rows =
        conditions.length > 0
          ? await db.select().from(challenges).where(and(...conditions)).all()
          : await db.select().from(challenges).all();
      return txt(rows);
    }
  );

  server.tool(
    "update_challenge_status",
    "Update the status of a challenge",
    {
      challenge_id: z.string().describe("Challenge ID"),
      status: z.enum(["active", "completed", "expired"]).describe("New status"),
    },
    async ({ challenge_id, status }) => {
      await initPromise;
      const existing = await db.select().from(challenges).where(eq(challenges.id, challenge_id)).get();
      if (!existing) return err("Challenge not found");
      const now = new Date().toISOString();
      const updates: Record<string, unknown> = { status, updatedAt: now };
      if (status === "completed" && !existing.completedAt) updates.completedAt = now;
      await db.update(challenges).set(updates).where(eq(challenges.id, challenge_id)).run();
      return txt({ success: true, challenge_id, status });
    }
  );

  // ── ATTENDANCE ────────────────────────────────────────────────────────────

  server.tool(
    "get_attendance",
    "Get attendance records for a member in a date range (read-only)",
    {
      member_id: z.string().describe("User ID"),
      from: z.string().describe("Start date YYYY-MM-DD"),
      to: z.string().describe("End date YYYY-MM-DD"),
    },
    async ({ member_id, from, to }) => {
      await initPromise;
      const rows = await db
        .select()
        .from(attendance)
        .where(
          and(
            eq(attendance.userId, member_id),
            gte(attendance.date, from),
            lte(attendance.date, to)
          )
        )
        .all();
      return txt(rows);
    }
  );

  server.tool(
    "list_all_attendance",
    "List all members' attendance status for a specific date (read-only)",
    { date: z.string().describe("Date YYYY-MM-DD") },
    async ({ date }) => {
      await initPromise;
      const rows = await db
        .select()
        .from(attendance)
        .where(eq(attendance.date, date))
        .all();

      const allUsers = await db
        .select({ id: users.id, name: users.name, role: users.role })
        .from(users)
        .where(eq(users.status, "active"))
        .all();

      const attendanceMap = new Map(rows.map((r) => [r.userId, r]));

      const result = allUsers.map((u) => ({
        member_id: u.id,
        name: u.name,
        role: u.role,
        attendance: attendanceMap.get(u.id) ?? null,
      }));

      return txt(result);
    }
  );

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────

  server.tool(
    "send_notification",
    "Send a notification to a team member",
    {
      member_id: z.string().describe("User ID to notify"),
      message: z.string().describe("Notification message body"),
      type: z
        .enum(["task_assigned", "challenge", "reminder", "general"])
        .describe("Notification type"),
      title: z.string().optional().describe("Notification title"),
      link: z.string().optional().describe("Optional link"),
    },
    async ({ member_id, message, type, title, link }) => {
      await initPromise;
      const user = await db.select().from(users).where(eq(users.id, member_id)).get();
      if (!user) return err("Member not found");
      const now = new Date().toISOString();
      const notif = {
        id: crypto.randomUUID(),
        userId: member_id,
        type,
        title: title ?? "New notification",
        body: message,
        link: link ?? null,
        isRead: false,
        createdAt: now,
      };
      await db.insert(notifications).values(notif).run();
      return txt({ success: true, notification_id: notif.id });
    }
  );

  server.tool(
    "list_notifications",
    "List notifications for a team member",
    { member_id: z.string().describe("User ID") },
    async ({ member_id }) => {
      await initPromise;
      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, member_id))
        .all();
      return txt(rows);
    }
  );

  server.tool(
    "clear_notifications",
    "Mark all notifications as read for a member",
    { member_id: z.string().describe("User ID") },
    async ({ member_id }) => {
      await initPromise;
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, member_id))
        .run();
      return txt({ success: true, member_id });
    }
  );

  // ── CLIENTS ───────────────────────────────────────────────────────────────

  server.tool("list_clients", "List all clients", {}, async () => {
    await initPromise;
    const rows = await db.select().from(clients).all();
    return txt(rows);
  });

  server.tool(
    "get_client",
    "Get a client by ID",
    { client_id: z.string().describe("Client ID") },
    async ({ client_id }) => {
      await initPromise;
      const row = await db.select().from(clients).where(eq(clients.id, client_id)).get();
      if (!row) return err("Client not found");
      return txt(row);
    }
  );

  server.tool(
    "create_client",
    "Create a new client",
    {
      name: z.string().describe("Client name"),
      industry: z.string().optional().describe("Industry"),
      stage: z.string().optional().describe("Stage: lead, onboarding, active, paused, churned"),
      assigned_member_ids: z
        .array(z.string())
        .optional()
        .describe("User IDs to assign access"),
    },
    async ({ name, industry, stage, assigned_member_ids }) => {
      await initPromise;
      const id = crypto.randomUUID();
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const now = new Date().toISOString();
      const client = { id, name, slug, industry: industry ?? null, stage: stage ?? "active", createdAt: now, archivedAt: null };
      await db.insert(clients).values(client).run();

      if (assigned_member_ids?.length) {
        for (const userId of assigned_member_ids) {
          await db
            .insert(userClientAccess)
            .values({ userId, clientId: id, accessLevel: "manage", assignedBy: "mcp-admin", createdAt: now })
            .run();
        }
      }

      return txt(client);
    }
  );

  server.tool(
    "assign_client",
    "Assign a client to a team member",
    {
      client_id: z.string().describe("Client ID"),
      member_id: z.string().describe("User ID"),
      access_level: z
        .enum(["view", "manage", "full"])
        .optional()
        .describe("Access level (default: manage)"),
    },
    async ({ client_id, member_id, access_level }) => {
      await initPromise;
      const now = new Date().toISOString();
      await db
        .insert(userClientAccess)
        .values({
          userId: member_id,
          clientId: client_id,
          accessLevel: access_level ?? "manage",
          assignedBy: "mcp-admin",
          createdAt: now,
        })
        .run();
      return txt({ success: true, client_id, member_id });
    }
  );

  // ── CONTENT CALENDAR (socialPosts) ────────────────────────────────────────

  server.tool(
    "list_calendar_entries",
    "List content calendar entries (social posts) for a client",
    {
      client_id: z.string().describe("Client ID"),
      from: z.string().optional().describe("Start date ISO string"),
      to: z.string().optional().describe("End date ISO string"),
    },
    async ({ client_id, from, to }) => {
      await initPromise;
      const conditions = [eq(socialPosts.clientId, client_id)];
      if (from) conditions.push(gte(socialPosts.scheduledFor, from));
      if (to) conditions.push(lte(socialPosts.scheduledFor, to));
      const rows = await db.select().from(socialPosts).where(and(...conditions)).all();
      return txt(rows);
    }
  );

  server.tool(
    "create_calendar_entry",
    "Create a content calendar entry (social post)",
    {
      client_id: z.string().describe("Client ID"),
      platform: z.string().describe("Platform (e.g. Instagram, Twitter, LinkedIn)"),
      content_description: z.string().describe("Post copy/content"),
      scheduled_date: z.string().optional().describe("Scheduled date ISO string"),
      status: z.enum(["draft", "queued", "posted"]).optional().describe("Status"),
    },
    async ({ client_id, platform, content_description, scheduled_date, status }) => {
      await initPromise;
      const now = new Date().toISOString();
      const post = {
        id: crypto.randomUUID(),
        clientId: client_id,
        platform,
        copy: content_description,
        mediaUrls: null,
        scheduledFor: scheduled_date ?? null,
        status: status ?? "draft",
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(socialPosts).values(post).run();
      return txt(post);
    }
  );

  server.tool(
    "update_calendar_entry",
    "Update a content calendar entry",
    {
      entry_id: z.string().describe("Social post ID"),
      platform: z.string().optional(),
      content_description: z.string().optional(),
      scheduled_date: z.string().optional(),
      status: z.enum(["draft", "queued", "posted"]).optional(),
    },
    async ({ entry_id, platform, content_description, scheduled_date, status }) => {
      await initPromise;
      const existing = await db.select().from(socialPosts).where(eq(socialPosts.id, entry_id)).get();
      if (!existing) return err("Calendar entry not found");
      const now = new Date().toISOString();
      const updates: Record<string, unknown> = { updatedAt: now };
      if (platform !== undefined) updates.platform = platform;
      if (content_description !== undefined) updates.copy = content_description;
      if (scheduled_date !== undefined) updates.scheduledFor = scheduled_date;
      if (status !== undefined) updates.status = status;
      await db.update(socialPosts).set(updates).where(eq(socialPosts.id, entry_id)).run();
      const updated = await db.select().from(socialPosts).where(eq(socialPosts.id, entry_id)).get();
      return txt(updated);
    }
  );

  // ── CAMPAIGNS & IDEAS ─────────────────────────────────────────────────────

  server.tool(
    "list_campaigns",
    "List campaigns for a client",
    { client_id: z.string().describe("Client ID") },
    async ({ client_id }) => {
      await initPromise;
      const rows = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.clientId, client_id))
        .all();
      return txt(rows);
    }
  );

  server.tool(
    "create_campaign",
    "Create a new campaign for a client",
    {
      client_id: z.string().describe("Client ID"),
      type: z.enum(["online", "offline"]).describe("Campaign type"),
      objective: z.string().optional().describe("Campaign objective"),
      channel: z.string().optional().describe("Channel (e.g. Instagram, Google Ads)"),
      budget: z.number().optional().describe("Budget amount"),
      start_date: z.string().optional().describe("Start date ISO"),
      end_date: z.string().optional().describe("End date ISO"),
      kpi: z.string().optional().describe("Key performance indicator"),
      status: z.enum(["planned", "active", "done"]).optional().describe("Status"),
    },
    async ({ client_id, type, objective, channel, budget, start_date, end_date, kpi, status }) => {
      await initPromise;
      const now = new Date().toISOString();
      const campaign = {
        id: crypto.randomUUID(),
        clientId: client_id,
        type,
        objective: objective ?? null,
        channel: channel ?? null,
        hypothesis: null,
        creativeNotes: null,
        budget: budget ?? null,
        startDate: start_date ?? null,
        endDate: end_date ?? null,
        kpi: kpi ?? null,
        outcome: null,
        status: status ?? "planned",
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(campaigns).values(campaign).run();
      return txt(campaign);
    }
  );

  server.tool(
    "list_ideas",
    "List ideas for a client",
    {
      client_id: z.string().describe("Client ID"),
      column: z.enum(["raw", "cooking", "ready"]).optional().describe("Filter by column"),
    },
    async ({ client_id, column }) => {
      await initPromise;
      const conditions = [eq(ideas.clientId, client_id)];
      if (column) conditions.push(eq(ideas.column, column));
      const rows = await db.select().from(ideas).where(and(...conditions)).all();
      return txt(rows);
    }
  );

  server.tool(
    "create_idea",
    "Create a new idea for a client",
    {
      client_id: z.string().describe("Client ID"),
      title: z.string().describe("Idea title"),
      description: z.string().optional().describe("Idea description"),
      column: z.enum(["raw", "cooking", "ready"]).optional().describe("Kanban column"),
    },
    async ({ client_id, title, description, column }) => {
      await initPromise;
      const now = new Date().toISOString();
      const idea = {
        id: crypto.randomUUID(),
        clientId: client_id,
        title,
        body: description ?? null,
        column: column ?? "raw",
        tags: null,
        isOnline: true,
        estimatedCost: null,
        refinedBody: null,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(ideas).values(idea).run();
      return txt(idea);
    }
  );

  server.tool(
    "move_idea",
    "Move an idea to a different kanban column",
    {
      idea_id: z.string().describe("Idea ID"),
      new_column: z.enum(["raw", "cooking", "ready"]).describe("Target column"),
    },
    async ({ idea_id, new_column }) => {
      await initPromise;
      const existing = await db.select().from(ideas).where(eq(ideas.id, idea_id)).get();
      if (!existing) return err("Idea not found");
      const now = new Date().toISOString();
      await db.update(ideas).set({ column: new_column, updatedAt: now }).where(eq(ideas.id, idea_id)).run();
      return txt({ success: true, idea_id, column: new_column });
    }
  );

  // ── FILES (stub — no files table in schema) ───────────────────────────────

  server.tool("list_files", "List files visible to Claude (admin view)", {}, async () => {
    return txt({ note: "File storage is handled via R2/S3. No file index table exists in the DB." });
  });

  server.tool(
    "get_file_visibility",
    "Get visibility settings for a file",
    { file_id: z.string().describe("File ID or path") },
    async () => {
      return txt({ note: "File visibility is not yet tracked in the database." });
    }
  );

  server.tool(
    "set_file_visibility",
    "Set visibility for a file (roles or member IDs)",
    {
      file_id: z.string().describe("File ID or path"),
      visible_to: z.array(z.string()).describe("Roles or member IDs that can see the file"),
    },
    async () => {
      return txt({ note: "File visibility is not yet tracked in the database." });
    }
  );

  return server;
}

// --- Route handler ---

async function handleMCP(request: Request): Promise<Response> {
  if (!verifyAdminToken(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const server = buildServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — works with serverless Next.js
    enableJsonResponse: false,
  });

  await server.connect(transport);
  const response = await transport.handleRequest(request);
  return response;
}

export async function GET() {
  // This server is stateless (no sessions, no server-initiated messages).
  // Per the MCP spec, GET opens a standalone SSE stream — passing it to the
  // transport makes the response hang with no headers, which mcp-remote
  // treats as a fatal error and drops the whole session ("disconnected"
  // right after a successful connect). Answer 405 so clients skip the
  // standalone stream and keep the POST channel alive.
  return new Response(null, {
    status: 405,
    headers: { Allow: "POST, DELETE" },
  });
}

export async function POST(request: Request) {
  return handleMCP(request);
}

export async function DELETE(request: Request) {
  return handleMCP(request);
}
