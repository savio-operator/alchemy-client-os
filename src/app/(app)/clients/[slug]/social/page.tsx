"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Calendar,
  X,
  Image,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { SocialPost } from "@/db/schema";

const PLATFORMS = ["Instagram", "YouTube", "X", "LinkedIn", "Facebook"] as const;

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-[var(--muted)] text-[var(--ink-muted)]",
  queued: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  posted: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function SocialPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showComposer, setShowComposer] = useState(false);
  const [composerDate, setComposerDate] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    const res = await fetch(`/api/clients/${slug}/social`);
    const data = await res.json();
    setPosts(data);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const getWeekDates = (): Date[] => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return date;
    });
  };

  const getMonthDates = (): Date[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const dates: Date[] = [];

    // Pad to start on Monday
    const startDay = first.getDay() || 7;
    for (let i = startDay - 1; i > 0; i--) {
      const d = new Date(first);
      d.setDate(d.getDate() - i);
      dates.push(d);
    }
    for (let i = 1; i <= last.getDate(); i++) {
      dates.push(new Date(year, month, i));
    }
    // Pad to complete the week
    while (dates.length % 7 !== 0) {
      const d = new Date(dates[dates.length - 1]);
      d.setDate(d.getDate() + 1);
      dates.push(d);
    }
    return dates;
  };

  const getPostsForDate = (date: Date): SocialPost[] => {
    const dateStr = date.toISOString().split("T")[0];
    return posts.filter(
      (p) => p.scheduledFor && p.scheduledFor.startsWith(dateStr)
    );
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/clients/${slug}/social/${id}`, { method: "DELETE" });
    fetchPosts();
  };

  const handleStatusCycle = async (post: SocialPost) => {
    const next = post.status === "draft" ? "queued" : post.status === "queued" ? "posted" : "draft";
    await fetch(`/api/clients/${slug}/social/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    fetchPosts();
  };

  const dates = view === "week" ? getWeekDates() : getMonthDates();
  const isCurrentMonth = (d: Date) => d.getMonth() === currentDate.getMonth();

  return (
    <div className="px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold font-serif">Social</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-[var(--radius-sm)] border border-[var(--rule)] overflow-hidden">
            <button
              onClick={() => setView("week")}
              className={`px-3 py-1 text-xs ${view === "week" ? "bg-[var(--ink)] text-[var(--bg)]" : "bg-[var(--surface)]"}`}
            >
              Week
            </button>
            <button
              onClick={() => setView("month")}
              className={`px-3 py-1 text-xs ${view === "month" ? "bg-[var(--ink)] text-[var(--bg)]" : "bg-[var(--surface)]"}`}
            >
              Month
            </button>
          </div>
          <Button
            size="sm"
            onClick={() => { setShowComposer(true); setComposerDate(null); }}
            className="gap-1 bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} />
            New post
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)]">
          <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <span className="text-sm font-medium">
          {currentDate.toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
            ...(view === "week" && { day: "numeric" }),
          })}
        </span>
        <button onClick={() => navigate(1)} className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)]">
          <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-5 h-5 border-2 border-[var(--accent-clay)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Calendar grid */}
          <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-[var(--rule)]">
              {DAYS.map((day) => (
                <div key={day} className="px-2 py-2 text-xs font-medium text-[var(--ink-muted)] text-center">
                  {day}
                </div>
              ))}
            </div>

            {/* Date cells */}
            <div className="grid grid-cols-7">
              {dates.map((date, i) => {
                const datePosts = getPostsForDate(date);
                const isToday = date.toDateString() === new Date().toDateString();
                const inMonth = view === "month" ? isCurrentMonth(date) : true;

                return (
                  <div
                    key={i}
                    className={`min-h-[${view === "week" ? "120" : "80"}px] border-b border-r border-[var(--rule)] p-1.5 ${
                      !inMonth ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs ${
                          isToday
                            ? "w-5 h-5 bg-[var(--accent-clay)] text-white rounded-full flex items-center justify-center"
                            : "text-[var(--ink-muted)]"
                        }`}
                      >
                        {date.getDate()}
                      </span>
                      <button
                        onClick={() => {
                          setComposerDate(date.toISOString().split("T")[0]);
                          setShowComposer(true);
                        }}
                        className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-[var(--muted)] opacity-0 hover:opacity-100"
                      >
                        <Plus className="w-2.5 h-2.5 text-[var(--ink-muted)]" strokeWidth={2} />
                      </button>
                    </div>

                    <div className="space-y-0.5">
                      {datePosts.slice(0, 3).map((post) => (
                        <button
                          key={post.id}
                          onClick={() => handleStatusCycle(post)}
                          className="w-full text-left px-1 py-0.5 rounded text-[10px] truncate hover:bg-[var(--muted)] transition-colors"
                        >
                          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${
                            post.status === "posted" ? "bg-green-500" :
                            post.status === "queued" ? "bg-blue-500" : "bg-[var(--ink-muted)]"
                          }`} />
                          {post.platform}
                        </button>
                      ))}
                      {datePosts.length > 3 && (
                        <p className="text-[10px] text-[var(--ink-muted)] px-1">
                          +{datePosts.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming posts list */}
          <div className="mt-6">
            <h2 className="text-sm font-medium mb-3">All posts</h2>
            {posts.length === 0 ? (
              <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-6 text-center">
                <p className="text-sm text-[var(--ink-muted)]">
                  No posts scheduled. Create your first post above.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="group flex items-center gap-3 p-3 rounded-[var(--radius-sm)] border border-[var(--rule)] bg-[var(--surface)]"
                  >
                    <Badge className={`text-[10px] shrink-0 ${STATUS_COLORS[post.status]}`}>
                      {post.status}
                    </Badge>
                    <span className="text-xs font-medium shrink-0">{post.platform}</span>
                    <p className="text-xs text-[var(--ink-muted)] truncate flex-1">
                      {post.copy || "No copy yet"}
                    </p>
                    {post.scheduledFor && (
                      <span className="text-xs text-[var(--ink-muted)] shrink-0">
                        {new Date(post.scheduledFor).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    )}
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)]"
                    >
                      <Trash2 className="w-3 h-3 text-[var(--ink-muted)]" strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Composer modal */}
      <AnimatePresence>
        {showComposer && (
          <PostComposer
            slug={slug}
            defaultDate={composerDate}
            onClose={() => setShowComposer(false)}
            onCreated={() => { setShowComposer(false); fetchPosts(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PostComposer({
  slug,
  defaultDate,
  onClose,
  onCreated,
}: {
  slug: string;
  defaultDate: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [platform, setPlatform] = useState("Instagram");
  const [copy, setCopy] = useState("");
  const [scheduledFor, setScheduledFor] = useState(defaultDate || "");
  const [status, setStatus] = useState("draft");

  const handleCreate = async () => {
    await fetch(`/api/clients/${slug}/social`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        copy: copy || null,
        scheduledFor: scheduledFor || null,
        status,
      }),
    });
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20 dark:bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        className="relative w-full max-w-md bg-[var(--surface)] rounded-[var(--radius-lg)] shadow-card border border-[var(--rule)] p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold font-serif">New post</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)]">
            <X className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--ink-muted)] mb-1 block">Platform</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`px-3 py-1 rounded-full text-xs transition-colors duration-120 ${
                    platform === p
                      ? "bg-[var(--accent-clay)]/10 text-[var(--accent-clay)] border border-[var(--accent-clay)]"
                      : "bg-[var(--muted)] text-[var(--ink-muted)] border border-transparent"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--ink-muted)] mb-1 block">Copy (you write this)</label>
            <Textarea
              value={copy}
              onChange={(e) => setCopy(e.target.value)}
              placeholder="Write your post copy here..."
              rows={4}
              className="text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-[var(--ink-muted)] mb-1 block">Scheduled for</label>
            <Input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-[var(--ink-muted)] mb-1 block">Status</label>
            <div className="flex gap-1.5">
              {["draft", "queued", "posted"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1 rounded-full text-xs capitalize transition-colors duration-120 ${
                    status === s
                      ? "bg-[var(--ink)] text-[var(--bg)]"
                      : "bg-[var(--muted)] text-[var(--ink-muted)]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Reference shelf placeholder */}
          <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--rule)] p-3 text-center">
            <p className="text-xs text-[var(--ink-muted)]">
              Reference shelf: relevant discoveries will appear here once the discovery engine is running.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} className="bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white">
            Create post
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
