/*
 * Spotlight-style global search — one keyword query fanned out across every
 * content table in the app (clients, tasks, ideas, leads, campaigns,
 * invoices, news, client feed discoveries) instead of just clients. Shared
 * by the Cmd+K command palette and the in-app AI chat's search_app tool so
 * both surfaces answer from the same index.
 */

import { db, initPromise } from "@/db";
import {
  clients,
  tasks,
  ideas,
  leads,
  campaigns,
  invoices,
  newsItems,
  clientDiscoveries,
  discoveries,
} from "@/db/schema";
import { or, like, eq, desc } from "drizzle-orm";

export interface SearchResult {
  type:
    | "client"
    | "task"
    | "idea"
    | "lead"
    | "campaign"
    | "invoice"
    | "news"
    | "feed";
  id: string;
  title: string;
  subtitle?: string;
  link: string;
}

export interface GroupedSearchResults {
  clients: SearchResult[];
  tasks: SearchResult[];
  ideas: SearchResult[];
  leads: SearchResult[];
  campaigns: SearchResult[];
  invoices: SearchResult[];
  news: SearchResult[];
  feed: SearchResult[];
}

const PER_TYPE = 5;

export async function searchEverything(query: string): Promise<GroupedSearchResults> {
  const empty: GroupedSearchResults = {
    clients: [],
    tasks: [],
    ideas: [],
    leads: [],
    campaigns: [],
    invoices: [],
    news: [],
    feed: [],
  };
  const q = query.trim();
  if (q.length < 2) return empty;

  await initPromise;
  const pattern = `%${q}%`;

  const [clientRows, taskRows, ideaRows, leadRows, campaignRows, invoiceRows, newsRows, feedRows] =
    await Promise.all([
      db
        .select()
        .from(clients)
        .where(or(like(clients.name, pattern), like(clients.industry, pattern)))
        .limit(PER_TYPE)
        .all(),
      db
        .select()
        .from(tasks)
        .where(or(like(tasks.title, pattern), like(tasks.description, pattern)))
        .limit(PER_TYPE)
        .all(),
      db
        .select({ id: ideas.id, title: ideas.title, clientId: ideas.clientId })
        .from(ideas)
        .where(or(like(ideas.title, pattern), like(ideas.body, pattern)))
        .limit(PER_TYPE)
        .all(),
      db
        .select()
        .from(leads)
        .where(
          or(
            like(leads.name, pattern),
            like(leads.company, pattern),
            like(leads.email, pattern)
          )
        )
        .limit(PER_TYPE)
        .all(),
      db
        .select({ id: campaigns.id, clientId: campaigns.clientId, objective: campaigns.objective, channel: campaigns.channel })
        .from(campaigns)
        .where(
          or(
            like(campaigns.objective, pattern),
            like(campaigns.channel, pattern),
            like(campaigns.hypothesis, pattern)
          )
        )
        .limit(PER_TYPE)
        .all(),
      db
        .select()
        .from(invoices)
        .where(or(like(invoices.number, pattern), like(invoices.description, pattern)))
        .limit(PER_TYPE)
        .all(),
      db
        .select()
        .from(newsItems)
        .where(or(like(newsItems.title, pattern), like(newsItems.summary, pattern)))
        .orderBy(desc(newsItems.publishedAt))
        .limit(PER_TYPE)
        .all(),
      db
        .select({
          discoveryId: clientDiscoveries.discoveryId,
          clientId: clientDiscoveries.clientId,
          title: discoveries.title,
          body: discoveries.body,
        })
        .from(clientDiscoveries)
        .innerJoin(discoveries, eq(clientDiscoveries.discoveryId, discoveries.id))
        .where(or(like(discoveries.title, pattern), like(discoveries.body, pattern)))
        .limit(PER_TYPE)
        .all(),
    ]);

  // Resolve client names/slugs once for every client-scoped row above.
  const clientIds = new Set<string>();
  for (const t of taskRows) if (t.clientId) clientIds.add(t.clientId);
  for (const i of ideaRows) clientIds.add(i.clientId);
  for (const c of campaignRows) clientIds.add(c.clientId);
  for (const inv of invoiceRows) clientIds.add(inv.clientId);
  for (const f of feedRows) clientIds.add(f.clientId);

  const clientLookup = new Map<string, { name: string; slug: string }>();
  if (clientIds.size > 0) {
    const rows = await db.select().from(clients).all();
    for (const c of rows) {
      if (clientIds.has(c.id)) clientLookup.set(c.id, { name: c.name, slug: c.slug });
    }
  }
  const clientOf = (id: string | null) => (id ? clientLookup.get(id) : undefined);

  return {
    clients: clientRows.map((c) => ({
      type: "client",
      id: c.id,
      title: c.name,
      subtitle: c.industry || undefined,
      link: `/clients/${c.slug}`,
    })),
    tasks: taskRows.map((t) => ({
      type: "task",
      id: t.id,
      title: t.title,
      subtitle: clientOf(t.clientId)?.name,
      link: "/tasks",
    })),
    ideas: ideaRows.map((i) => ({
      type: "idea",
      id: i.id,
      title: i.title,
      subtitle: clientOf(i.clientId)?.name,
      link: "/ideas",
    })),
    leads: leadRows.map((l) => ({
      type: "lead",
      id: l.id,
      title: l.name,
      subtitle: l.company || undefined,
      link: "/leads",
    })),
    campaigns: campaignRows.map((c) => ({
      type: "campaign",
      id: c.id,
      title: c.objective || c.channel || "Campaign",
      subtitle: clientOf(c.clientId)?.name,
      link: clientOf(c.clientId) ? `/clients/${clientOf(c.clientId)!.slug}` : "/campaigns",
    })),
    invoices: invoiceRows.map((inv) => ({
      type: "invoice",
      id: inv.id,
      title: `Invoice ${inv.number}`,
      subtitle: clientOf(inv.clientId)?.name,
      link: `/invoices/${inv.id}`,
    })),
    news: newsRows.map((n) => ({
      type: "news",
      id: n.id,
      title: n.title,
      subtitle: n.source,
      link: "/news",
    })),
    feed: feedRows.map((f) => ({
      type: "feed",
      id: f.discoveryId,
      title: f.title || "Discovery",
      subtitle: clientOf(f.clientId)?.name,
      link: clientOf(f.clientId) ? `/clients/${clientOf(f.clientId)!.slug}/feed` : "/",
    })),
  };
}

export function flattenResults(grouped: GroupedSearchResults): SearchResult[] {
  return [
    ...grouped.clients,
    ...grouped.tasks,
    ...grouped.ideas,
    ...grouped.leads,
    ...grouped.campaigns,
    ...grouped.invoices,
    ...grouped.news,
    ...grouped.feed,
  ];
}
