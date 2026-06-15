"use client";

import { useState } from "react";
import Link from "next/link";

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0C0A09] relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#C96442]/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-[#C96442]/5 rounded-full blur-[80px]" />
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-[380px] mx-4 rounded-3xl bg-gradient-to-b from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 shadow-2xl p-8 flex flex-col items-center">
        {/* Logo mark */}
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#C96442]/20 border border-[#C96442]/30 mb-5 shadow-lg">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 3L3 20h18L12 3z" stroke="#C96442" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
            <path d="M7.5 15h9" stroke="#C96442" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>

        {submitted ? (
          <>
            {/* Confirmation */}
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#34D399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-1 text-center tracking-tight">
              Request submitted
            </h2>
            <p className="text-sm text-white/40 mb-7 text-center">
              Your registration is pending approval from a founder. You can sign
              in once approved.
            </p>
            <Link
              href="/login"
              className="w-full text-center bg-[#C96442] text-white font-medium px-4 py-3 rounded-full text-sm shadow hover:bg-[#B5583A] transition-all"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            {/* Heading */}
            <h2 className="text-xl font-semibold text-white mb-1 text-center tracking-tight">
              Request access
            </h2>
            <p className="text-sm text-white/40 mb-7 text-center">
              A founder will approve your account
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
              <input
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#C96442]/50 focus:bg-white/10 transition-all"
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#C96442]/50 focus:bg-white/10 transition-all"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#C96442]/50 focus:bg-white/10 transition-all"
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#C96442]/50 focus:bg-white/10 transition-all"
              />
              {error && (
                <p className="text-xs text-red-400 text-left">{error}</p>
              )}
              <div className="h-px bg-white/8 my-1" />
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#C96442] text-white font-medium px-4 py-3 rounded-full text-sm shadow hover:bg-[#B5583A] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting…" : "Request access"}
              </button>
              <p className="text-xs text-white/30 text-center mt-1">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-white/60 hover:text-white underline underline-offset-2 transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </form>
          </>
        )}
      </div>

      {/* Brand footer */}
      <p className="relative z-10 mt-8 text-xs text-white/20 tracking-wider uppercase">
        Adchemy OS
      </p>
    </div>
  );
}
