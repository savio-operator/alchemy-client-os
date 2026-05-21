"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const STAGES = ["idle", "pre-launch", "scaling", "mature", "pivoting"] as const;
const CHANNELS = [
  "Instagram",
  "YouTube",
  "X",
  "LinkedIn",
  "Ground events",
  "Influencers",
  "Paid search",
  "None",
] as const;

const BUDGET_MARKS = [0, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];

interface Answers {
  name: string;
  industry: string;
  description: string;
  stage: string;
  customer: string;
  winning: string;
  budget: number;
  adSpend: string;
  channels: string[];
  handles: Record<string, string>;
  notWorking: string;
}

interface OnboardingWizardProps {
  onClose: () => void;
  onCreated: (slug: string) => void;
}

export function OnboardingWizard({ onClose, onCreated }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    name: "",
    industry: "",
    description: "",
    stage: "",
    customer: "",
    winning: "",
    budget: 50000,
    adSpend: "Moderate",
    channels: [],
    handles: {},
    notWorking: "",
  });
  const [synthesizing, setSynthesizing] = useState(false);
  const [brief, setBrief] = useState<{
    summaryMd: string;
    northStar: string;
    audience: string;
    voice: string;
    constraints: string;
  } | null>(null);
  const [editingBrief, setEditingBrief] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totalSteps = 7;

  const update = <K extends keyof Answers>(key: K, value: Answers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const canContinue = (): boolean => {
    switch (step) {
      case 0:
        return answers.name.trim().length > 0;
      case 1:
        return answers.stage !== "";
      case 2:
        return answers.customer.trim().length > 0;
      case 3:
        return answers.winning.trim().length > 0;
      case 4:
        return true;
      case 5:
        return true;
      case 6:
        return answers.notWorking.trim().length > 0;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      // Last step — synthesize brief
      setSynthesizing(true);
      setError("");
      try {
        const res = await fetch("/api/clients/synthesize-brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Synthesis failed");
        }

        const briefData = await res.json();
        setBrief(briefData);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        setError(msg);
        // Allow manual brief creation as fallback
        setBrief({
          summaryMd: `# ${answers.name}\n\n${answers.description}\n\nCustomer: ${answers.customer}\n\nGoal: ${answers.winning}`,
          northStar: answers.winning,
          audience: answers.customer,
          voice: "To be defined",
          constraints: `Budget: ${formatBudget(answers.budget)}. Ad spend appetite: ${answers.adSpend}.`,
        });
      } finally {
        setSynthesizing(false);
      }
    }
  };

  const handleSave = async () => {
    if (!brief) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: answers.name,
          industry: answers.industry,
          stage: answers.stage,
          profile: answers,
          brief,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create client");
      }

      const client = await res.json();
      onCreated(client.slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Brief review screen
  if (brief) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/20 dark:bg-black/40" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="relative w-full max-w-2xl max-h-[85vh] bg-[var(--surface)] rounded-[var(--radius-lg)] shadow-card border border-[var(--rule)] flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--rule)]">
            <h2 className="text-lg font-semibold font-serif">Review client brief</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)]">
              <X className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {error && (
              <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-[var(--radius-sm)]">
                AI synthesis failed — showing manual fallback. You can edit below.
              </p>
            )}

            <div>
              <label className="text-xs font-medium text-[var(--ink-muted)] uppercase tracking-wider mb-1.5 block">Summary</label>
              {editingBrief ? (
                <Textarea
                  value={brief.summaryMd}
                  onChange={(e) => setBrief({ ...brief, summaryMd: e.target.value })}
                  rows={6}
                  className="font-mono text-sm"
                />
              ) : (
                <div className="text-sm whitespace-pre-wrap prose-measure">{brief.summaryMd}</div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--ink-muted)] uppercase tracking-wider mb-1.5 block">North Star</label>
              {editingBrief ? (
                <Input value={brief.northStar} onChange={(e) => setBrief({ ...brief, northStar: e.target.value })} />
              ) : (
                <p className="text-sm">{brief.northStar}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--ink-muted)] uppercase tracking-wider mb-1.5 block">Audience</label>
              {editingBrief ? (
                <Textarea value={brief.audience} onChange={(e) => setBrief({ ...brief, audience: e.target.value })} rows={2} />
              ) : (
                <p className="text-sm">{brief.audience}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--ink-muted)] uppercase tracking-wider mb-1.5 block">Voice</label>
              {editingBrief ? (
                <Textarea value={brief.voice} onChange={(e) => setBrief({ ...brief, voice: e.target.value })} rows={2} />
              ) : (
                <p className="text-sm">{brief.voice}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--ink-muted)] uppercase tracking-wider mb-1.5 block">Constraints</label>
              {editingBrief ? (
                <Textarea value={brief.constraints} onChange={(e) => setBrief({ ...brief, constraints: e.target.value })} rows={2} />
              ) : (
                <p className="text-sm">{brief.constraints}</p>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-[var(--rule)] flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setEditingBrief(!editingBrief)}>
              {editingBrief ? "Preview" : "Edit"}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : null}
              Save and open project
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Synthesizing screen
  if (synthesizing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/20 dark:bg-black/40" />
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-[var(--surface)] rounded-[var(--radius-lg)] shadow-card border border-[var(--rule)] p-10 text-center"
        >
          <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-clay)] mx-auto mb-4" />
          <p className="text-sm font-medium">Synthesizing client brief</p>
          <p className="text-xs text-[var(--ink-muted)] mt-1">Analyzing your answers...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20 dark:bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="relative w-full max-w-lg bg-[var(--surface)] rounded-[var(--radius-lg)] shadow-card border border-[var(--rule)] overflow-hidden"
      >
        {/* Progress bar */}
        <div className="h-0.5 bg-[var(--muted)]">
          <motion.div
            className="h-full bg-[var(--accent-clay)]"
            initial={false}
            animate={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)]"
        >
          <X className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
        </button>

        {/* Content */}
        <div className="px-8 pt-8 pb-6">
          <p className="text-xs text-[var(--ink-muted)] mb-6">
            Step {step + 1} of {totalSteps}
          </p>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 && (
                <StepBasics
                  name={answers.name}
                  industry={answers.industry}
                  description={answers.description}
                  onUpdate={update}
                />
              )}
              {step === 1 && (
                <StepStage stage={answers.stage} onUpdate={update} />
              )}
              {step === 2 && (
                <StepCustomer customer={answers.customer} onUpdate={update} />
              )}
              {step === 3 && (
                <StepWinning winning={answers.winning} onUpdate={update} />
              )}
              {step === 4 && (
                <StepBudget
                  budget={answers.budget}
                  adSpend={answers.adSpend}
                  onUpdate={update}
                />
              )}
              {step === 5 && (
                <StepChannels
                  channels={answers.channels}
                  handles={answers.handles}
                  onUpdate={update}
                />
              )}
              {step === 6 && (
                <StepNotWorking notWorking={answers.notWorking} onUpdate={update} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="px-8 pb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep(step - 1)}
            disabled={step === 0}
            className="gap-1"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            Back
          </Button>
          <Button
            size="sm"
            onClick={handleNext}
            disabled={!canContinue()}
            className="gap-1 bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white"
          >
            {step === totalSteps - 1 ? "Create brief" : "Continue"}
            {step < totalSteps - 1 && <ArrowRight className="w-4 h-4" strokeWidth={1.5} />}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// --- Step components ---

function StepBasics({
  name,
  industry,
  description,
  onUpdate,
}: {
  name: string;
  industry: string;
  description: string;
  onUpdate: <K extends keyof Answers>(key: K, value: Answers[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold font-serif">Tell me about your client</h2>
      <div>
        <label className="text-sm text-[var(--ink-muted)] mb-1.5 block">Client name</label>
        <Input
          value={name}
          onChange={(e) => onUpdate("name", e.target.value)}
          placeholder="e.g. Skyesports"
          autoFocus
        />
      </div>
      <div>
        <label className="text-sm text-[var(--ink-muted)] mb-1.5 block">Industry</label>
        <Input
          value={industry}
          onChange={(e) => onUpdate("industry", e.target.value)}
          placeholder="e.g. Esports, Fashion, FMCG"
        />
      </div>
      <div>
        <label className="text-sm text-[var(--ink-muted)] mb-1.5 block">One-line description</label>
        <Input
          value={description}
          onChange={(e) => onUpdate("description", e.target.value)}
          placeholder="What does this client do?"
        />
      </div>
    </div>
  );
}

function StepStage({
  stage,
  onUpdate,
}: {
  stage: string;
  onUpdate: <K extends keyof Answers>(key: K, value: Answers[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold font-serif">Where is the business right now?</h2>
      <div className="grid gap-2">
        {STAGES.map((s) => (
          <button
            key={s}
            onClick={() => onUpdate("stage", s)}
            className={`text-left px-4 py-3 rounded-[var(--radius-sm)] border text-sm transition-colors duration-120 ${
              stage === s
                ? "border-[var(--accent-clay)] bg-[var(--accent-clay)]/5"
                : "border-[var(--rule)] hover:bg-[var(--muted)]"
            }`}
          >
            <span className="font-medium capitalize">{s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepCustomer({
  customer,
  onUpdate,
}: {
  customer: string;
  onUpdate: <K extends keyof Answers>(key: K, value: Answers[K]) => void;
}) {
  const [showHelper, setShowHelper] = useState(false);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold font-serif">Who exactly is the customer?</h2>
      <Textarea
        value={customer}
        onChange={(e) => onUpdate("customer", e.target.value)}
        placeholder="Describe the ideal customer — demographics, psychographics, behavior..."
        rows={4}
        autoFocus
      />
      <button
        onClick={() => setShowHelper(!showHelper)}
        className="text-xs text-[var(--accent-clay)] hover:underline"
      >
        {showHelper ? "Hide" : "Show"} common mistakes
      </button>
      {showHelper && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="text-xs text-[var(--ink-muted)] bg-[var(--muted)] p-3 rounded-[var(--radius-sm)] space-y-1"
        >
          <p>Avoid: "Everyone aged 18-35"</p>
          <p>Avoid: "People who like gaming" (too broad)</p>
          <p>Better: "Male, 18-24, metro India, plays Valorant daily, follows esports tournaments, spends on gaming peripherals"</p>
        </motion.div>
      )}
    </div>
  );
}

function StepWinning({
  winning,
  onUpdate,
}: {
  winning: string;
  onUpdate: <K extends keyof Answers>(key: K, value: Answers[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold font-serif">What does winning look like in 12 months?</h2>
      <Textarea
        value={winning}
        onChange={(e) => onUpdate("winning", e.target.value)}
        placeholder="Describe the ideal outcome — specific metrics, milestones, or achievements..."
        rows={4}
        autoFocus
      />
    </div>
  );
}

function StepBudget({
  budget,
  adSpend,
  onUpdate,
}: {
  budget: number;
  adSpend: string;
  onUpdate: <K extends keyof Answers>(key: K, value: Answers[K]) => void;
}) {
  const logValue = Math.log10(Math.max(budget, 1));
  const minLog = 0;
  const maxLog = Math.log10(1000000);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold font-serif">Monthly marketing budget</h2>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[var(--ink-muted)]">Budget</span>
          <span className="text-sm font-medium font-mono">{formatBudget(budget)}</span>
        </div>
        <input
          type="range"
          min={minLog}
          max={maxLog}
          step={0.01}
          value={logValue}
          onChange={(e) => {
            const val = Math.round(Math.pow(10, parseFloat(e.target.value)));
            onUpdate("budget", val);
          }}
          className="w-full accent-[var(--accent-clay)]"
        />
        <div className="flex justify-between text-xs text-[var(--ink-muted)] mt-1">
          <span>0</span>
          <span>10L</span>
        </div>
      </div>

      <div>
        <label className="text-sm text-[var(--ink-muted)] mb-2 block">Ad-spend appetite</label>
        <div className="grid grid-cols-3 gap-2">
          {["Conservative", "Moderate", "Aggressive"].map((level) => (
            <button
              key={level}
              onClick={() => onUpdate("adSpend", level)}
              className={`px-3 py-2 rounded-[var(--radius-sm)] border text-sm transition-colors duration-120 ${
                adSpend === level
                  ? "border-[var(--accent-clay)] bg-[var(--accent-clay)]/5 font-medium"
                  : "border-[var(--rule)] hover:bg-[var(--muted)]"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepChannels({
  channels,
  handles,
  onUpdate,
}: {
  channels: string[];
  handles: Record<string, string>;
  onUpdate: <K extends keyof Answers>(key: K, value: Answers[K]) => void;
}) {
  const toggleChannel = (ch: string) => {
    const updated = channels.includes(ch)
      ? channels.filter((c) => c !== ch)
      : [...channels, ch];
    onUpdate("channels", updated);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold font-serif">Existing channels</h2>
      <div className="flex flex-wrap gap-2">
        {CHANNELS.map((ch) => (
          <button
            key={ch}
            onClick={() => toggleChannel(ch)}
            className={`px-3 py-1.5 rounded-full border text-sm transition-colors duration-120 ${
              channels.includes(ch)
                ? "border-[var(--accent-clay)] bg-[var(--accent-clay)]/5 text-[var(--accent-clay)]"
                : "border-[var(--rule)] hover:bg-[var(--muted)] text-[var(--ink-muted)]"
            }`}
          >
            {ch}
          </button>
        ))}
      </div>

      {channels.filter((c) => c !== "None").length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs text-[var(--ink-muted)]">Handles (optional)</p>
          {channels
            .filter((c) => c !== "None")
            .map((ch) => (
              <div key={ch} className="flex items-center gap-2">
                <span className="text-xs text-[var(--ink-muted)] w-20 shrink-0">{ch}</span>
                <Input
                  value={handles[ch] || ""}
                  onChange={(e) =>
                    onUpdate("handles", { ...handles, [ch]: e.target.value })
                  }
                  placeholder={`@handle`}
                  className="h-8 text-sm"
                />
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function StepNotWorking({
  notWorking,
  onUpdate,
}: {
  notWorking: string;
  onUpdate: <K extends keyof Answers>(key: K, value: Answers[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold font-serif">What's NOT working right now?</h2>
      <p className="text-sm text-[var(--ink-muted)]">
        This becomes the first entry in the client's History timeline.
      </p>
      <Textarea
        value={notWorking}
        onChange={(e) => onUpdate("notWorking", e.target.value)}
        placeholder="What marketing efforts have failed? What's the biggest frustration?"
        rows={4}
        autoFocus
      />
    </div>
  );
}

function formatBudget(amount: number): string {
  if (amount >= 100000) {
    return `\u20B9${(amount / 100000).toFixed(1)}L`;
  }
  if (amount >= 1000) {
    return `\u20B9${(amount / 1000).toFixed(0)}K`;
  }
  return `\u20B9${amount}`;
}
