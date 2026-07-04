"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  User,
  Clock,
  Lightbulb,
  Megaphone,
  Share2,
  Bot,
  Rss,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ClientData {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  stage: string | null;
  createdAt: string;
  brief: {
    summaryMd: string | null;
    northStar: string | null;
  } | null;
}

const SECTIONS = [
  {
    key: "profile",
    label: "Profile",
    icon: User,
    stat: "Client brief",
    href: (slug: string) => `/clients/${slug}/profile`,
  },
  {
    key: "history",
    label: "History",
    icon: Clock,
    stat: "Timeline",
    href: (slug: string) => `/clients/${slug}/history`,
  },
  {
    key: "ideas",
    label: "Ideas",
    icon: Lightbulb,
    stat: "Kanban",
    href: (slug: string) => `/clients/${slug}/ideas`,
  },
  {
    key: "marketing",
    label: "Marketing",
    icon: Megaphone,
    stat: "Campaigns",
    href: (slug: string) => `/clients/${slug}/marketing`,
  },
  {
    key: "social",
    label: "Social",
    icon: Share2,
    stat: "Calendar",
    href: (slug: string) => `/clients/${slug}/social`,
  },
  {
    key: "feed",
    label: "Feed",
    icon: Rss,
    stat: "Discoveries",
    href: (slug: string) => `/clients/${slug}/feed`,
  },
  {
    key: "agents",
    label: "Agents",
    icon: Bot,
    stat: "Runners",
    href: (slug: string) => `/clients/${slug}/agents`,
  },
];

export default function ClientHomePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/clients/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        setClient(data);
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-[var(--accent-clay)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 text-center">
        <p className="text-sm text-[var(--ink-muted)]">Client not found.</p>
      </div>
    );
  }

  const timeAgo = getTimeAgo(client.createdAt);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Hero card */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-6 mb-8"
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold font-serif mb-1">
              {client.name}
            </h1>
            <p className="text-sm text-[var(--ink-muted)]">
              {client.industry || "No industry set"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {client.stage && (
              <Badge variant="secondary" className="capitalize text-xs">
                {client.stage}
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-[var(--ink-muted)] mt-3">
          Created {timeAgo}
        </p>
        {client.brief?.northStar && (
          <p className="text-sm mt-3 pt-3 border-t border-[var(--rule)] text-[var(--ink-muted)]">
            North star: {client.brief.northStar}
          </p>
        )}
      </motion.div>

      {/* Section tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {SECTIONS.map((section, i) => {
          const Icon = section.icon;
          return (
            <motion.div
              key={section.key}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: i * 0.03 }}
            >
              <Link
                href={section.href(slug)}
                className="block p-5 rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] hover:shadow-card transition-shadow duration-200 group"
              >
                <Icon
                  className="w-5 h-5 text-[var(--ink-muted)] mb-3 group-hover:text-[var(--accent-clay)] transition-colors duration-120"
                  strokeWidth={1.5}
                />
                <p className="text-sm font-medium">{section.label}</p>
                <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                  {section.stat}
                </p>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Recent activity placeholder */}
      <div>
        <h2 className="text-sm font-medium mb-3">Recent activity</h2>
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-6 text-center">
          <p className="text-sm text-[var(--ink-muted)]">
            No activity yet. Start by exploring the sections above.
          </p>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
}
