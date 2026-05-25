"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  Unplug,
  ExternalLink,
  RefreshCw,
  Loader2,
  Moon,
  Sun,
  Rss,
  Zap,
  LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Integration {
  provider: string;
  connected: boolean;
}

const PROVIDER_INFO: Record<string, { label: string; description: string }> = {
  meta: {
    label: "Meta (Instagram + Facebook)",
    description: "Scheduled publishing and insights via Graph API",
  },
  x: {
    label: "X (Twitter)",
    description: "Post tweets and read mentions via X API v2",
  },
  linkedin: {
    label: "LinkedIn",
    description: "Marketing API for company page posts",
  },
  google: {
    label: "Google Analytics + Search Console",
    description: "Read-only analytics data to auto-fill campaign outcomes",
  },
  razorpay: {
    label: "Razorpay",
    description: "Track client billing and payment status",
  },
};

export default function SettingsPage() {
  const router = useRouter();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [pollResult, setPollResult] = useState<string | null>(null);
  const [scoreResult, setScoreResult] = useState<string | null>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((data) => {
        setIntegrations(data);
        setLoading(false);
      });
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const handleDisconnect = async (provider: string) => {
    await fetch("/api/integrations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    setIntegrations((prev) =>
      prev.map((i) => (i.provider === provider ? { ...i, connected: false } : i))
    );
  };

  const handleConnect = async (provider: string) => {
    window.location.href = `/api/integrations/${provider}/auth`;
  };

  const handlePoll = async () => {
    setPolling(true);
    setPollResult(null);
    try {
      const res = await fetch("/api/discovery/poll", { method: "POST" });
      const data = await res.json();
      setPollResult(`Fetched ${data.fetched} new items from ${data.sources} sources`);
    } catch {
      setPollResult("Polling failed");
    } finally {
      setPolling(false);
    }
  };

  const handleScore = async () => {
    setScoring(true);
    setScoreResult(null);
    try {
      const res = await fetch("/api/discovery/score", { method: "POST" });
      const data = await res.json();
      setScoreResult(`Scored ${data.scored} discoveries`);
    } catch {
      setScoreResult("Scoring failed");
    } finally {
      setScoring(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold font-serif mb-6">Settings</h1>

      {/* Appearance */}
      <section className="mb-8">
        <h2 className="text-sm font-medium mb-3">Appearance</h2>
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {dark ? (
                <Moon className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
              ) : (
                <Sun className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
              )}
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="text-xs text-[var(--ink-muted)]">
                  {dark ? "Dark mode" : "Light mode"}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={toggleDark}>
              Switch to {dark ? "light" : "dark"}
            </Button>
          </div>
        </div>
      </section>

      {/* Discovery Engine */}
      <section className="mb-8">
        <h2 className="text-sm font-medium mb-3">Discovery Engine</h2>
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Rss className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-medium">Poll sources now</p>
                <p className="text-xs text-[var(--ink-muted)]">
                  Fetch latest content from RSS feeds and other sources
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePoll}
              disabled={polling}
              className="gap-1"
            >
              {polling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
              )}
              Poll
            </Button>
          </div>
          {pollResult && (
            <p className="text-xs text-[var(--ink-muted)] bg-[var(--muted)] p-2 rounded-[var(--radius-sm)]">
              {pollResult}
            </p>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-medium">Score discoveries</p>
                <p className="text-xs text-[var(--ink-muted)]">
                  Run relevance scoring on unscored discoveries (uses AI)
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleScore}
              disabled={scoring}
              className="gap-1"
            >
              {scoring ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" strokeWidth={1.5} />
              )}
              Score
            </Button>
          </div>
          {scoreResult && (
            <p className="text-xs text-[var(--ink-muted)] bg-[var(--muted)] p-2 rounded-[var(--radius-sm)]">
              {scoreResult}
            </p>
          )}
        </div>
      </section>

      {/* Integrations */}
      <section className="mb-8">
        <h2 className="text-sm font-medium mb-3">Integrations</h2>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-[var(--accent-clay)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {integrations.map((integration) => {
              const info = PROVIDER_INFO[integration.provider];
              return (
                <motion.div
                  key={integration.provider}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-[var(--radius-sm)] bg-[var(--muted)] flex items-center justify-center">
                        <Settings className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{info?.label || integration.provider}</p>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${
                              integration.connected
                                ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                : ""
                            }`}
                          >
                            {integration.connected ? "Connected" : "Not connected"}
                          </Badge>
                        </div>
                        <p className="text-xs text-[var(--ink-muted)]">
                          {info?.description}
                        </p>
                      </div>
                    </div>

                    {integration.connected ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDisconnect(integration.provider)}
                        className="gap-1 text-destructive"
                      >
                        <Unplug className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConnect(integration.provider)}
                        className="gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Connect
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Sign Out */}
      <section>
        <h2 className="text-sm font-medium mb-3">Account</h2>
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LogOut className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-medium">Sign out</p>
                <p className="text-xs text-[var(--ink-muted)]">
                  End your current session
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-destructive"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                router.push("/login");
              }}
            >
              <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
              Sign out
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
