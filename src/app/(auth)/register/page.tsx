"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Connection error");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center animate-panel-in">
          <CheckCircle
            className="w-12 h-12 text-green-500 mx-auto mb-4"
            strokeWidth={1.5}
          />
          <h1 className="text-2xl font-semibold mb-2">Request submitted</h1>
          <p className="text-sm text-[var(--ink-muted)] mb-6">
            Your registration is pending approval from a founder. You will be
            able to log in once approved.
          </p>
          <Link
            href="/login"
            className="text-sm text-[var(--accent-clay)] hover:underline"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-panel-in">
        <h1 className="text-2xl font-semibold mb-2 text-center">
          Request access
        </h1>
        <p className="text-[var(--ink-muted)] mb-6 text-sm text-center">
          Register to join Adchemy. A founder will approve your account.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div>
            <label className="block text-xs font-medium text-[var(--ink-muted)] mb-1.5">
              Confirm password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            {submitting ? "Submitting..." : "Request access"}
          </button>
        </form>
        <p className="text-xs text-[var(--ink-muted)] text-center mt-4">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[var(--accent-clay)] hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
