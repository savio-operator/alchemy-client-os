"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function LoginPage() {
  const [pin, setPin] = useState<string[]>(["", "", "", "", "", ""]);
  const [isSetup, setIsSetup] = useState(false);
  const [confirmPin, setConfirmPin] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          router.replace("/");
          return;
        }
        setIsSetup(!data.pinSet);
        setLoading(false);
      });
  }, [router]);

  const handleInput = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    setError("");

    const target = confirmPin !== null ? [...confirmPin] : [...pin];
    target[index] = value;

    if (confirmPin !== null) {
      setConfirmPin(target);
    } else {
      setPin(target);
    }

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullPin = target.join("");
    if (fullPin.length === 6 && target.every((d) => d !== "")) {
      if (isSetup && confirmPin === null) {
        // First entry done, ask to confirm
        setTimeout(() => {
          setConfirmPin(["", "", "", "", "", ""]);
          inputRefs.current[0]?.focus();
        }, 150);
        return;
      }

      if (isSetup && confirmPin !== null) {
        const firstPin = pin.join("");
        if (fullPin !== firstPin) {
          setError("PINs don't match. Try again.");
          setConfirmPin(null);
          setPin(["", "", "", "", "", ""]);
          setTimeout(() => inputRefs.current[0]?.focus(), 100);
          return;
        }
      }

      submitPin(fullPin);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const submitPin = async (fullPin: string) => {
    setSubmitting(true);
    setError("");
    const endpoint = isSetup ? "/api/auth/setup" : "/api/auth/login";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: fullPin }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setPin(["", "", "", "", "", ""]);
        setConfirmPin(null);
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      } else {
        router.replace("/");
      }
    } catch {
      setError("Connection error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[var(--accent-clay)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentPin = confirmPin !== null ? confirmPin : pin;
  const title = isSetup
    ? confirmPin !== null
      ? "Confirm your PIN"
      : "Set up your PIN"
    : "Enter your PIN";
  const subtitle = isSetup
    ? confirmPin !== null
      ? "Enter the same 6-digit PIN again"
      : "Choose a 6-digit PIN to secure your workspace"
    : "Welcome back to Adchemy";

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="w-full max-w-sm text-center"
      >
        <h1 className="text-2xl font-semibold mb-2">{title}</h1>
        <p className="text-[var(--ink-muted)] mb-8 text-sm">{subtitle}</p>

        <div className="flex justify-center gap-3 mb-6">
          {currentPin.map((digit, i) => (
            <input
              key={`${confirmPin !== null ? "confirm" : "pin"}-${i}`}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleInput(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={submitting}
              autoFocus={i === 0}
              className="w-12 h-14 text-center text-xl font-mono rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--surface)] focus:border-[var(--accent-clay)] transition-colors duration-120 disabled:opacity-50"
            />
          ))}
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-[var(--destructive)] mb-4"
          >
            {error}
          </motion.p>
        )}

        {submitting && (
          <div className="flex justify-center">
            <div className="w-5 h-5 border-2 border-[var(--accent-clay)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </motion.div>
    </div>
  );
}
