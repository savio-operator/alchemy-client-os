import { NextResponse } from "next/server";
import { db } from "@/db";
import { searchHistory } from "@/db";
import {
  clients,
  clientBrief,
  ideas,
  campaigns,
  agentRuns,
  invoices,
  leads,
  tasks,
  notes,
  deliverables,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { callAI } from "@/lib/anthropic";
import { getAgent } from "@/lib/agents";

// MCP Server - JSON-RPC endpoint

const SERVER_INFO = {
  name: "adchemy-client-os",
  version: "1.0.0",
};

const CAPABILITIES = {
  tools: {},
};

const TOOLS = [
  // --- Client Management ---
  {
    name: "list_clients",
    description: "List all clients in the system",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_client",
    description: "Get client details by slug",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "Client slug" } },
      required: ["slug"],
    },
  },
  {
    name: "create_client",
    description: "Create a new client",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Client name" },
        slug: { type: "string", description: "URL-friendly slug" },
        industry: { type: "string", description: "Client industry" },
        stage: { type: "string", description: "Client stage: lead, onboarding, active, paused, churned" },
      },
      required: ["name", "slug"],
    },
  },
  {
    name: "update_client",
    description: "Update client details",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Client ID" },
        name: { type: "string", description: "New name" },
        industry: { type: "string", description: "New industry" },
        stage: { type: "string", description: "New stage" },
      },
      required: ["clientId"],
    },
  },
  {
    name: "archive_client",
    description: "Archive a client (soft delete)",
    inputSchema: {
      type: "object",
      properties: { clientId: { type: "string", description: "Client ID" } },
      required: ["clientId"],
    },
  },
  // --- Campaign Management ---
  {
    name: "list_campaigns",
    description: "List campaigns for a client",
    inputSchema: {
      type: "object",
      properties: { clientId: { type: "string", description: "Client ID" } },
      required: ["clientId"],
    },
  },
  {
    name: "create_campaign",
    description: "Create a new campaign for a client",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Client ID" },
        type: { type: "string", description: "Campaign type: online or offline" },
        objective: { type: "string", description: "Campaign objective" },
        channel: { type: "string", description: "Channel (e.g. Instagram, Google Ads)" },
        budget: { type: "number", description: "Budget amount" },
        startDate: { type: "string", description: "Start date (ISO)" },
        endDate: { type: "string", description: "End date (ISO)" },
        kpi: { type: "string", description: "Key performance indicator" },
        status: { type: "string", description: "Status: planned, active, done" },
      },
      required: ["clientId", "type"],
    },
  },
  {
    name: "update_campaign",
    description: "Update campaign details",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string", description: "Campaign ID" },
        objective: { type: "string" },
        channel: { type: "string" },
        budget: { type: "number" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        kpi: { type: "string" },
        outcome: { type: "string" },
        status: { type: "string", description: "Status: planned, active, done" },
      },
      required: ["campaignId"],
    },
  },
  // --- Idea Management ---
  {
    name: "create_idea",
    description: "Create a new idea for a client",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Client ID" },
        title: { type: "string", description: "Idea title" },
        body: { type: "string", description: "Idea body/description" },
        column: { type: "string", description: "Column: raw, cooking, or ready" },
      },
      required: ["clientId", "title"],
    },
  },
  {
    name: "list_ideas",
    description: "List ideas for a client",
    inputSchema: {
      type: "object",
      properties: { clientId: { type: "string", description: "Client ID" } },
      required: ["clientId"],
    },
  },
  {
    name: "update_idea",
    description: "Update an existing idea",
    inputSchema: {
      type: "object",
      properties: {
        ideaId: { type: "string", description: "Idea ID" },
        title: { type: "string" },
        body: { type: "string" },
        column: { type: "string", description: "Column: raw, cooking, or ready" },
        tags: { type: "string", description: "JSON array of tags" },
      },
      required: ["ideaId"],
    },
  },
  {
    name: "delete_idea",
    description: "Delete an idea",
    inputSchema: {
      type: "object",
      properties: { ideaId: { type: "string", description: "Idea ID" } },
      required: ["ideaId"],
    },
  },
  {
    name: "move_idea",
    description: "Move an idea to a different column",
    inputSchema: {
      type: "object",
      properties: {
        ideaId: { type: "string", description: "Idea ID" },
        column: { type: "string", description: "Target column: raw, cooking, or ready" },
      },
      required: ["ideaId", "column"],
    },
  },
  // --- Invoice Management ---
  {
    name: "create_invoice",
    description: "Create an invoice for a client",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Client ID" },
        number: { type: "string", description: "Invoice number (e.g. INV-001)" },
        amount: { type: "number", description: "Invoice amount" },
        currency: { type: "string", description: "Currency code (default: INR)" },
        dueDate: { type: "string", description: "Due date (ISO)" },
        description: { type: "string", description: "Invoice description" },
        status: { type: "string", description: "Status: draft, sent, paid, overdue" },
      },
      required: ["clientId", "number", "amount"],
    },
  },
  {
    name: "list_invoices",
    description: "List invoices, optionally filtered by client",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Client ID (optional, omit for all)" },
        status: { type: "string", description: "Filter by status" },
      },
    },
  },
  {
    name: "mark_invoice_paid",
    description: "Mark an invoice as paid",
    inputSchema: {
      type: "object",
      properties: { invoiceId: { type: "string", description: "Invoice ID" } },
      required: ["invoiceId"],
    },
  },
  // --- Lead/Pipeline Management ---
  {
    name: "add_lead",
    description: "Add a new lead to the pipeline",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Lead contact name" },
        company: { type: "string", description: "Company name" },
        email: { type: "string", description: "Email address" },
        phone: { type: "string", description: "Phone number" },
        source: { type: "string", description: "Source: referral, inbound, outbound, social" },
        notes: { type: "string", description: "Notes about the lead" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_leads",
    description: "List all leads, optionally filtered by status",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status: new, contacted, qualified, proposal, won, lost" },
      },
    },
  },
  {
    name: "update_lead_status",
    description: "Update the status of a lead",
    inputSchema: {
      type: "object",
      properties: {
        leadId: { type: "string", description: "Lead ID" },
        status: { type: "string", description: "New status: new, contacted, qualified, proposal, won, lost" },
        notes: { type: "string", description: "Additional notes" },
      },
      required: ["leadId", "status"],
    },
  },
  // --- Task Management ---
  {
    name: "create_task",
    description: "Create a new task, optionally linked to a client",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title" },
        description: { type: "string", description: "Task description" },
        clientId: { type: "string", description: "Client ID (optional)" },
        priority: { type: "string", description: "Priority: low, medium, high, urgent" },
        dueDate: { type: "string", description: "Due date (ISO)" },
        assignedTo: { type: "string", description: "Assigned team member" },
      },
      required: ["title"],
    },
  },
  {
    name: "list_tasks",
    description: "List tasks, optionally filtered by client or status",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Client ID (optional)" },
        status: { type: "string", description: "Filter by status: todo, in_progress, done" },
      },
    },
  },
  {
    name: "update_task",
    description: "Update a task's status or details",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task ID" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string", description: "Status: todo, in_progress, done" },
        priority: { type: "string", description: "Priority: low, medium, high, urgent" },
        dueDate: { type: "string" },
        assignedTo: { type: "string" },
      },
      required: ["taskId"],
    },
  },
  // --- Notes ---
  {
    name: "add_note",
    description: "Add a note, optionally linked to a client",
    inputSchema: {
      type: "object",
      properties: {
        body: { type: "string", description: "Note content" },
        title: { type: "string", description: "Optional title" },
        clientId: { type: "string", description: "Client ID (optional)" },
        tags: { type: "string", description: "JSON array of tags" },
      },
      required: ["body"],
    },
  },
  {
    name: "list_notes",
    description: "List notes, optionally filtered by client",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Client ID (optional)" },
      },
    },
  },
  // --- Deliverables ---
  {
    name: "log_deliverable",
    description: "Log a deliverable for a client",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Client ID" },
        title: { type: "string", description: "Deliverable title" },
        type: { type: "string", description: "Type: design, video, copy, social_post, report" },
        campaignId: { type: "string", description: "Linked campaign ID (optional)" },
        status: { type: "string", description: "Status: pending, in_progress, review, delivered" },
        fileUrl: { type: "string", description: "File URL (optional)" },
      },
      required: ["clientId", "title"],
    },
  },
  {
    name: "list_deliverables",
    description: "List deliverables for a client",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Client ID" },
        status: { type: "string", description: "Filter by status" },
      },
      required: ["clientId"],
    },
  },
  // --- Dashboard ---
  {
    name: "get_agency_dashboard",
    description: "Get an aggregated agency dashboard with counts and summaries across all data",
    inputSchema: { type: "object", properties: {} },
  },
  // --- Existing tools ---
  {
    name: "run_agent",
    description: "Trigger an AI agent with input text",
    inputSchema: {
      type: "object",
      properties: {
        agentName: { type: "string", description: "Name of the agent to run" },
        clientId: { type: "string", description: "Client ID for context" },
        input: { type: "string", description: "Input text for the agent" },
      },
      required: ["agentName", "clientId", "input"],
    },
  },
  {
    name: "search_history",
    description: "Search history entries for a client",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Client ID" },
        query: { type: "string", description: "Search query" },
      },
      required: ["clientId", "query"],
    },
  },
];

function jsonRpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", error: { code, message }, id };
}

function jsonRpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", result, id };
}

function txt(data: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function err(message: string) {
  return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
}

async function handleToolCall(name: string, args: Record<string, unknown>) {
  const now = new Date().toISOString();

  switch (name) {
    // --- Client Management ---
    case "list_clients": {
      const allClients = await db.select().from(clients).all();
      return txt(allClients);
    }
    case "get_client": {
      const client = await db.select().from(clients).where(eq(clients.slug, args.slug as string)).get();
      if (!client) return err("Client not found");
      const brief = await db.select().from(clientBrief).where(eq(clientBrief.clientId, client.id)).get();
      return txt({ ...client, brief: brief || null });
    }
    case "create_client": {
      const id = globalThis.crypto.randomUUID();
      await db.insert(clients).values({
        id,
        name: args.name as string,
        slug: args.slug as string,
        industry: (args.industry as string) || null,
        stage: (args.stage as string) || "active",
        createdAt: now,
      }).run();
      const created = await db.select().from(clients).where(eq(clients.id, id)).get();
      return txt(created);
    }
    case "update_client": {
      const updates: Record<string, unknown> = {};
      if (args.name) updates.name = args.name;
      if (args.industry) updates.industry = args.industry;
      if (args.stage) updates.stage = args.stage;
      if (Object.keys(updates).length === 0) return err("No fields to update");
      await db.update(clients).set(updates).where(eq(clients.id, args.clientId as string)).run();
      const updated = await db.select().from(clients).where(eq(clients.id, args.clientId as string)).get();
      return txt(updated);
    }
    case "archive_client": {
      await db.update(clients).set({ archivedAt: now }).where(eq(clients.id, args.clientId as string)).run();
      return txt({ success: true, archivedAt: now });
    }

    // --- Campaign Management ---
    case "list_campaigns": {
      const rows = await db.select().from(campaigns).where(eq(campaigns.clientId, args.clientId as string)).all();
      return txt(rows);
    }
    case "create_campaign": {
      const id = globalThis.crypto.randomUUID();
      await db.insert(campaigns).values({
        id,
        clientId: args.clientId as string,
        type: args.type as string,
        objective: (args.objective as string) || null,
        channel: (args.channel as string) || null,
        budget: (args.budget as number) || null,
        startDate: (args.startDate as string) || null,
        endDate: (args.endDate as string) || null,
        kpi: (args.kpi as string) || null,
        status: (args.status as string) || "planned",
        createdAt: now,
        updatedAt: now,
      }).run();
      const created = await db.select().from(campaigns).where(eq(campaigns.id, id)).get();
      return txt(created);
    }
    case "update_campaign": {
      const updates: Record<string, unknown> = { updatedAt: now };
      for (const key of ["objective", "channel", "budget", "startDate", "endDate", "kpi", "outcome", "status"]) {
        if (args[key] !== undefined) updates[key] = args[key];
      }
      await db.update(campaigns).set(updates).where(eq(campaigns.id, args.campaignId as string)).run();
      const updated = await db.select().from(campaigns).where(eq(campaigns.id, args.campaignId as string)).get();
      return txt(updated);
    }

    // --- Idea Management ---
    case "create_idea": {
      const id = globalThis.crypto.randomUUID();
      await db.insert(ideas).values({
        id,
        clientId: args.clientId as string,
        title: args.title as string,
        body: (args.body as string) || null,
        column: (args.column as string) || "raw",
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      }).run();
      const created = await db.select().from(ideas).where(eq(ideas.id, id)).get();
      return txt(created);
    }
    case "list_ideas": {
      const rows = await db.select().from(ideas).where(eq(ideas.clientId, args.clientId as string)).all();
      return txt(rows);
    }
    case "update_idea": {
      const updates: Record<string, unknown> = { updatedAt: now };
      for (const key of ["title", "body", "column", "tags"]) {
        if (args[key] !== undefined) updates[key] = args[key];
      }
      await db.update(ideas).set(updates).where(eq(ideas.id, args.ideaId as string)).run();
      const updated = await db.select().from(ideas).where(eq(ideas.id, args.ideaId as string)).get();
      return txt(updated);
    }
    case "delete_idea": {
      await db.delete(ideas).where(eq(ideas.id, args.ideaId as string)).run();
      return txt({ success: true, deleted: args.ideaId });
    }
    case "move_idea": {
      await db.update(ideas).set({ column: args.column as string, updatedAt: now }).where(eq(ideas.id, args.ideaId as string)).run();
      const updated = await db.select().from(ideas).where(eq(ideas.id, args.ideaId as string)).get();
      return txt(updated);
    }

    // --- Invoice Management ---
    case "create_invoice": {
      const id = globalThis.crypto.randomUUID();
      await db.insert(invoices).values({
        id,
        clientId: args.clientId as string,
        number: args.number as string,
        amount: args.amount as number,
        currency: (args.currency as string) || "INR",
        status: (args.status as string) || "draft",
        dueDate: (args.dueDate as string) || null,
        description: (args.description as string) || null,
        createdAt: now,
        updatedAt: now,
      }).run();
      const created = await db.select().from(invoices).where(eq(invoices.id, id)).get();
      return txt(created);
    }
    case "list_invoices": {
      const conditions = [];
      if (args.clientId) conditions.push(eq(invoices.clientId, args.clientId as string));
      if (args.status) conditions.push(eq(invoices.status, args.status as string));
      const rows = conditions.length > 0
        ? await db.select().from(invoices).where(and(...conditions)).all()
        : await db.select().from(invoices).all();
      return txt(rows);
    }
    case "mark_invoice_paid": {
      await db.update(invoices).set({ status: "paid", paidAt: now, updatedAt: now }).where(eq(invoices.id, args.invoiceId as string)).run();
      const updated = await db.select().from(invoices).where(eq(invoices.id, args.invoiceId as string)).get();
      return txt(updated);
    }

    // --- Lead/Pipeline Management ---
    case "add_lead": {
      const id = globalThis.crypto.randomUUID();
      await db.insert(leads).values({
        id,
        name: args.name as string,
        company: (args.company as string) || null,
        email: (args.email as string) || null,
        phone: (args.phone as string) || null,
        source: (args.source as string) || null,
        notes: (args.notes as string) || null,
        status: "new",
        createdAt: now,
        updatedAt: now,
      }).run();
      const created = await db.select().from(leads).where(eq(leads.id, id)).get();
      return txt(created);
    }
    case "list_leads": {
      const rows = args.status
        ? await db.select().from(leads).where(eq(leads.status, args.status as string)).all()
        : await db.select().from(leads).all();
      return txt(rows);
    }
    case "update_lead_status": {
      const updates: Record<string, unknown> = { status: args.status, updatedAt: now };
      if (args.notes) updates.notes = args.notes;
      await db.update(leads).set(updates).where(eq(leads.id, args.leadId as string)).run();
      const updated = await db.select().from(leads).where(eq(leads.id, args.leadId as string)).get();
      return txt(updated);
    }

    // --- Task Management ---
    case "create_task": {
      const id = globalThis.crypto.randomUUID();
      await db.insert(tasks).values({
        id,
        clientId: (args.clientId as string) || null,
        title: args.title as string,
        description: (args.description as string) || null,
        priority: (args.priority as string) || "medium",
        dueDate: (args.dueDate as string) || null,
        assignedTo: (args.assignedTo as string) || null,
        status: "todo",
        createdAt: now,
        updatedAt: now,
      }).run();
      const created = await db.select().from(tasks).where(eq(tasks.id, id)).get();
      return txt(created);
    }
    case "list_tasks": {
      const conditions = [];
      if (args.clientId) conditions.push(eq(tasks.clientId, args.clientId as string));
      if (args.status) conditions.push(eq(tasks.status, args.status as string));
      const rows = conditions.length > 0
        ? await db.select().from(tasks).where(and(...conditions)).all()
        : await db.select().from(tasks).all();
      return txt(rows);
    }
    case "update_task": {
      const updates: Record<string, unknown> = { updatedAt: now };
      for (const key of ["title", "description", "status", "priority", "dueDate", "assignedTo"]) {
        if (args[key] !== undefined) updates[key] = args[key];
      }
      if (args.status === "done") updates.completedAt = now;
      await db.update(tasks).set(updates).where(eq(tasks.id, args.taskId as string)).run();
      const updated = await db.select().from(tasks).where(eq(tasks.id, args.taskId as string)).get();
      return txt(updated);
    }

    // --- Notes ---
    case "add_note": {
      const id = globalThis.crypto.randomUUID();
      await db.insert(notes).values({
        id,
        clientId: (args.clientId as string) || null,
        title: (args.title as string) || null,
        body: args.body as string,
        tags: (args.tags as string) || null,
        createdAt: now,
        updatedAt: now,
      }).run();
      const created = await db.select().from(notes).where(eq(notes.id, id)).get();
      return txt(created);
    }
    case "list_notes": {
      const rows = args.clientId
        ? await db.select().from(notes).where(eq(notes.clientId, args.clientId as string)).all()
        : await db.select().from(notes).all();
      return txt(rows);
    }

    // --- Deliverables ---
    case "log_deliverable": {
      const id = globalThis.crypto.randomUUID();
      await db.insert(deliverables).values({
        id,
        clientId: args.clientId as string,
        title: args.title as string,
        type: (args.type as string) || null,
        campaignId: (args.campaignId as string) || null,
        status: (args.status as string) || "pending",
        fileUrl: (args.fileUrl as string) || null,
        createdAt: now,
        updatedAt: now,
      }).run();
      const created = await db.select().from(deliverables).where(eq(deliverables.id, id)).get();
      return txt(created);
    }
    case "list_deliverables": {
      const conditions = [eq(deliverables.clientId, args.clientId as string)];
      if (args.status) conditions.push(eq(deliverables.status, args.status as string));
      const rows = await db.select().from(deliverables).where(and(...conditions)).all();
      return txt(rows);
    }

    // --- Dashboard ---
    case "get_agency_dashboard": {
      const [
        allClients,
        allCampaigns,
        allIdeas,
        allInvoices,
        allLeads,
        allTasks,
        allDeliverables,
      ] = await Promise.all([
        db.select().from(clients).all(),
        db.select().from(campaigns).all(),
        db.select().from(ideas).all(),
        db.select().from(invoices).all(),
        db.select().from(leads).all(),
        db.select().from(tasks).all(),
        db.select().from(deliverables).all(),
      ]);

      return txt({
        clients: {
          total: allClients.length,
          active: allClients.filter((c) => !c.archivedAt).length,
          archived: allClients.filter((c) => c.archivedAt).length,
        },
        campaigns: {
          total: allCampaigns.length,
          planned: allCampaigns.filter((c) => c.status === "planned").length,
          active: allCampaigns.filter((c) => c.status === "active").length,
          done: allCampaigns.filter((c) => c.status === "done").length,
        },
        ideas: {
          total: allIdeas.length,
          raw: allIdeas.filter((i) => i.column === "raw").length,
          cooking: allIdeas.filter((i) => i.column === "cooking").length,
          ready: allIdeas.filter((i) => i.column === "ready").length,
        },
        invoices: {
          total: allInvoices.length,
          draft: allInvoices.filter((i) => i.status === "draft").length,
          sent: allInvoices.filter((i) => i.status === "sent").length,
          paid: allInvoices.filter((i) => i.status === "paid").length,
          overdue: allInvoices.filter((i) => i.status === "overdue").length,
          totalAmount: allInvoices.reduce((sum, i) => sum + i.amount, 0),
          paidAmount: allInvoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.amount, 0),
        },
        leads: {
          total: allLeads.length,
          new: allLeads.filter((l) => l.status === "new").length,
          contacted: allLeads.filter((l) => l.status === "contacted").length,
          qualified: allLeads.filter((l) => l.status === "qualified").length,
          proposal: allLeads.filter((l) => l.status === "proposal").length,
          won: allLeads.filter((l) => l.status === "won").length,
          lost: allLeads.filter((l) => l.status === "lost").length,
        },
        tasks: {
          total: allTasks.length,
          todo: allTasks.filter((t) => t.status === "todo").length,
          inProgress: allTasks.filter((t) => t.status === "in_progress").length,
          done: allTasks.filter((t) => t.status === "done").length,
        },
        deliverables: {
          total: allDeliverables.length,
          pending: allDeliverables.filter((d) => d.status === "pending").length,
          inProgress: allDeliverables.filter((d) => d.status === "in_progress").length,
          review: allDeliverables.filter((d) => d.status === "review").length,
          delivered: allDeliverables.filter((d) => d.status === "delivered").length,
        },
      });
    }

    // --- Existing tools ---
    case "run_agent": {
      const agentName = args.agentName as string;
      const clientId = args.clientId as string;
      const input = args.input as string;

      const agent = getAgent(agentName);
      if (!agent) return err("Agent not found");

      const output = await callAI(agent.systemPrompt, input, { model: agent.model });
      const id = globalThis.crypto.randomUUID();
      await db.insert(agentRuns).values({
        id,
        clientId,
        agentName,
        inputJson: JSON.stringify({ input }),
        outputMd: output,
        createdAt: now,
      }).run();

      return txt(output);
    }
    case "search_history": {
      const results = await searchHistory(args.query as string, args.clientId as string);
      return txt(results);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function POST(request: Request) {
  let body: { jsonrpc: string; method: string; params?: Record<string, unknown>; id?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(jsonRpcError(0, -32700, "Parse error"));
  }

  if (body.jsonrpc !== "2.0" || !body.method) {
    return NextResponse.json(jsonRpcError(body.id ?? 0, -32600, "Invalid Request"));
  }

  const { method, params, id } = body;

  try {
    switch (method) {
      case "initialize": {
        return NextResponse.json(
          jsonRpcResult(id, {
            protocolVersion: "2024-11-05",
            serverInfo: SERVER_INFO,
            capabilities: CAPABILITIES,
          })
        );
      }

      case "tools/list": {
        return NextResponse.json(jsonRpcResult(id, { tools: TOOLS }));
      }

      case "tools/call": {
        const toolName = (params as { name: string }).name;
        const toolArgs = ((params as { arguments?: Record<string, unknown> }).arguments) || {};
        const result = await handleToolCall(toolName, toolArgs);
        return NextResponse.json(jsonRpcResult(id, result));
      }

      default:
        return NextResponse.json(jsonRpcError(id, -32601, `Method not found: ${method}`));
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json(jsonRpcError(id, -32603, msg));
  }
}
