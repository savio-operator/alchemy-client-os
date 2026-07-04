/*
 * Always-on assistant watcher.
 * Periodically scans signals already surfaced elsewhere in the app — hot
 * industry news, high-scoring client discoveries, overdue tasks — and turns
 * them into proactive notifications instead of waiting for someone to go
 * looking. Mirrors the lazy-cron pattern in news-engine.ts: no standalone
 * worker process, just a cron registered once per server process and kicked
 * off the first time a frequently-polled route (notifications) is hit.
 *
 * Deliberately suggestion-only: it never sends messages, posts content, or
 * mutates client-facing data on its own. It only writes to the notifications
 * table (read-only elsewhere) and flips `surfacedAt` on discoveries already
 * meant to track "have we shown this yet."
 */

import cron from "node-cron";
import { db, initPromise } from "@/db";
import { newsItems, clientDiscoveries, discoveries, clients, tasks } from "@/db/schema";
import { and, eq, gt, gte, isNull, lt, ne, desc } from "drizzle-orm";
import { notifyFounders, notifyUser } from "@/lib/notifications";

const CHECK_INTERVAL_MINUTES = 20;
const NEWS_SCORE_THRESHOLD = 8;
const DISCOVERY_SCORE_THRESHOLD = 8;

let watcherStarted = false;
let lastNewsNotifyAt = new Date().toISOString();
const notifiedOverdueTaskIds = new Set<string>();

export function startAssistantWatcher() {
  if (watcherStarted) return;
  watcherStarted = true;

  cron.schedule(`*/${CHECK_INTERVAL_MINUTES} * * * *`, () => {
    runWatcherCycle().catch(() => {});
  });

  setTimeout(() => runWatcherCycle().catch(() => {}), 5000);
}

export async function runWatcherCycle(): Promise<void> {
  await initPromise;
  await Promise.allSettled([
    suggestHotNews(),
    suggestHotDiscoveries(),
    suggestOverdueTasks(),
  ]);
}

async function suggestHotNews() {
  const since = lastNewsNotifyAt;
  const cutoff = new Date().toISOString();
  lastNewsNotifyAt = cutoff;

  const hot = await db
    .select()
    .from(newsItems)
    .where(and(gte(newsItems.score, NEWS_SCORE_THRESHOLD), gt(newsItems.fetchedAt, since)))
    .orderBy(desc(newsItems.score))
    .limit(3)
    .all();

  for (const item of hot) {
    await notifyFounders(
      "assistant_suggestion",
      `Hot story: ${item.title}`,
      item.summary || undefined,
      "/news"
    );
  }
}

async function suggestHotDiscoveries() {
  const rows = await db
    .select({
      discoveryId: clientDiscoveries.discoveryId,
      score: clientDiscoveries.score,
      whyMd: clientDiscoveries.whyMd,
      clientId: clientDiscoveries.clientId,
      title: discoveries.title,
      clientName: clients.name,
      clientSlug: clients.slug,
    })
    .from(clientDiscoveries)
    .innerJoin(discoveries, eq(clientDiscoveries.discoveryId, discoveries.id))
    .innerJoin(clients, eq(clientDiscoveries.clientId, clients.id))
    .where(
      and(
        gte(clientDiscoveries.score, DISCOVERY_SCORE_THRESHOLD),
        isNull(clientDiscoveries.surfacedAt)
      )
    )
    .orderBy(desc(clientDiscoveries.score))
    .limit(5)
    .all();

  for (const row of rows) {
    await notifyFounders(
      "assistant_suggestion",
      `${row.clientName}: high-signal mention`,
      row.whyMd || row.title || undefined,
      `/clients/${row.clientSlug}/feed`
    );
  }

  if (rows.length > 0) {
    const now = new Date().toISOString();
    for (const row of rows) {
      await db
        .update(clientDiscoveries)
        .set({ surfacedAt: now })
        .where(eq(clientDiscoveries.discoveryId, row.discoveryId))
        .run();
    }
  }
}

async function suggestOverdueTasks() {
  const now = new Date().toISOString();
  const overdue = await db
    .select()
    .from(tasks)
    .where(and(lt(tasks.dueDate, now), ne(tasks.status, "done")))
    .all();

  for (const task of overdue) {
    if (notifiedOverdueTaskIds.has(task.id)) continue;
    notifiedOverdueTaskIds.add(task.id);

    const title = `Overdue: ${task.title}`;
    if (task.assignedTo) {
      await notifyUser(task.assignedTo, "assistant_suggestion", title, undefined, "/tasks");
    } else {
      await notifyFounders("assistant_suggestion", title, undefined, "/tasks");
    }
  }

  // Cap unbounded growth across a long-running process — tasks that get
  // completed or whose id ages out just get re-checked next cycle.
  if (notifiedOverdueTaskIds.size > 500) notifiedOverdueTaskIds.clear();
}
