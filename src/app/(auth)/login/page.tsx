"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";


export default function LoginPage() {
  const [mode, setMode] = useState<"loading" | "login" | "setup">("loading");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        setMode(data.migration ? "setup" : "login");
      })
      .catch(() => setMode("login"));
  }, [router]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Setup failed");
      } else {
        router.replace("/");
      }
    } catch {
      setError("Connection error");
    } finally {
      setSubmitting(false);
    }
  };

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

  if (mode === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[var(--accent-clay)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (mode === "setup") {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold mb-2 text-center">
            Welcome to Adchemy
          </h1>
          <p className="text-[var(--ink-muted)] mb-6 text-sm text-center">
            Set up your founder account with a name and PIN.
          </p>
          <form onSubmit={handleSetup} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1.5">
                Your name
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
                PIN (4-8 digits)
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                required
                minLength={4}
                maxLength={8}
                className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--rule)] bg-[var(--surface)] text-sm text-center tracking-[0.3em] focus:border-[var(--accent-clay)] transition-colors"
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
              {submitting ? "Setting up..." : "Get Started"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
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
      </div>
    </div>
  );
}
