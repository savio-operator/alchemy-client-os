import Link from "next/link";
import { Lightbulb, ArrowRight } from "lucide-react";
import { db, initPromise } from "@/db";
import { ideas, clients } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InlineCreateForm } from "@/components/inline-create-form";

const COLUMN_LABELS: Record<string, string> = {
  raw: "Raw",
  cooking: "Cooking",
  ready: "Ready",
};

const COLUMN_COLORS: Record<string, string> = {
  raw: "bg-[var(--muted)] text-[var(--ink-muted)]",
  cooking: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  ready: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

export default async function IdeasPage() {
  await initPromise;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [allIdeas, allClients] = await Promise.all([
    db.select().from(ideas).orderBy(desc(ideas.createdAt)),
    db.select().from(clients),
  ]);

  const clientMap = new Map(allClients.map((c) => [c.id, c]));

  const clientOptions = allClients
    .filter((c) => !c.archivedAt)
    .map((c) => ({ value: c.id, label: c.name }));

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <Lightbulb className="w-6 h-6 text-[var(--ink-muted)]" strokeWidth={1.5} />
          <h1 className="text-3xl font-serif font-semibold">Ideas</h1>
        </div>
        <InlineCreateForm
          buttonLabel="New idea"
          apiEndpoint="/api/ideas"
          fields={[
            { name: "clientId", label: "Client", type: "select", required: true, options: clientOptions },
            { name: "title", label: "Title", type: "text", required: true, placeholder: "Idea title" },
            {
              name: "column",
              label: "Stage",
              type: "select",
              options: [
                { value: "raw", label: "Raw" },
                { value: "cooking", label: "Cooking" },
                { value: "ready", label: "Ready" },
              ],
            },
          ]}
        />
      </div>
      <p className="text-[var(--ink-muted)] mb-8">
        All creative ideas across your clients.
      </p>

      {allIdeas.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-12 text-center">
          <div className="w-12 h-12 rounded-[var(--radius)] bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
            <Lightbulb className="w-5 h-5 text-[var(--ink-muted)]" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium mb-1">No ideas yet</p>
          <p className="text-xs text-[var(--ink-muted)]">
            Ideas added to client boards will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] divide-y divide-[var(--rule)]">
          {allIdeas.map((idea) => {
            const client = clientMap.get(idea.clientId);
            let parsedTags: string[] = [];
            try {
              if (idea.tags) parsedTags = JSON.parse(idea.tags);
            } catch {
              // ignore
            }

            return (
              <Link
                key={idea.id}
                href={client ? `/clients/${client.slug}` : "#"}
                className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--muted)] transition-colors duration-150 group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{idea.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {client && (
                      <span className="text-xs text-[var(--ink-muted)] truncate">
                        {client.name}
                      </span>
                    )}
                    {parsedTags.length > 0 && (
                      <>
                        {client && (
                          <span className="text-xs text-[var(--ink-muted)]">·</span>
                        )}
                        <span className="text-xs text-[var(--ink-muted)] truncate">
                          {parsedTags.slice(0, 3).join(", ")}
                          {parsedTags.length > 3 && ` +${parsedTags.length - 3}`}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      COLUMN_COLORS[idea.column] ?? "bg-[var(--muted)] text-[var(--ink-muted)]"
                    }`}
                  >
                    {COLUMN_LABELS[idea.column] ?? idea.column}
                  </span>

                  <ArrowRight
                    className="w-4 h-4 text-[var(--ink-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    strokeWidth={1.5}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <Link
          href="/"
          className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
