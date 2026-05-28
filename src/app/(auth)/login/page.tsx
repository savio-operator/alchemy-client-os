"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";

export default function LoginPage() {
  const [mode, setMode] = useState<"loading" | "login" | "migrate">("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          router.replace("/");
          return;
        }
        setMode(data.migration ? "migrate" : "login");
      });
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
      } else {
        router.replace("/");
      }
    } catch {
      setError("Connection error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMigrate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Migration failed");
      } else {
        router.replace("/");
      }
    } catch {
      setError("Connection error");
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[var(--accent-clay)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        {mode === "migrate" ? (
          <>
            <h1 className="text-2xl font-semibold mb-2 text-center">
              Create Founder Account
            </h1>
            <p className="text-[var(--ink-muted)] mb-6 text-sm text-center">
              Migrating from PIN to multi-user. Set up your founder account.
            </p>
            <form onSubmit={handleMigrate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1.5">
                  Full name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--rule)] bg-[var(--surface)] text-sm focus:border-[var(--accent-clay)] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--rule)] bg-[var(--surface)] text-sm focus:border-[var(--accent-clay)] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--rule)] bg-[var(--surface)] text-sm focus:border-[var(--accent-clay)] transition-colors"
                />
              </div>
              {error && (
                <p className="text-sm text-[var(--destructive)]">{error}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-10 rounded-[var(--radius-sm)] bg-[var(--accent-clay)] text-white text-sm font-medium hover:bg-[var(--accent-clay)]/90 transition-colors disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Founder Account"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold mb-2 text-center">
              Welcome back
            </h1>
            <p className="text-[var(--ink-muted)] mb-6 text-sm text-center">
              Sign in to Adchemy
            </p>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--rule)] bg-[var(--surface)] text-sm focus:border-[var(--accent-clay)] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--rule)] bg-[var(--surface)] text-sm focus:border-[var(--accent-clay)] transition-colors"
                />
              </div>
              {error && (
                <p className="text-sm text-[var(--destructive)]">{error}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-10 rounded-[var(--radius-sm)] bg-[var(--accent-clay)] text-white text-sm font-medium hover:bg-[var(--accent-clay)]/90 transition-colors disabled:opacity-50"
              >
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </form>
            <p className="text-xs text-[var(--ink-muted)] text-center mt-4">
              New to Adchemy?{" "}
              <Link
                href="/register"
                className="text-[var(--accent-clay)] hover:underline"
              >
                Request access
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
