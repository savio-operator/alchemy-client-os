"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Save, Loader2, RefreshCw, TrendingUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Brief {
  summaryMd: string | null;
  northStar: string | null;
  audience: string | null;
  voice: string | null;
  constraints: string | null;
}

interface ClientData {
  id: string;
  name: string;
  industry: string | null;
  stage: string | null;
  brief: Brief | null;
}

export default function ProfilePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [draft, setDraft] = useState<Brief>({
    summaryMd: "",
    northStar: "",
    audience: "",
    voice: "",
    constraints: "",
  });
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/clients/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        setClient(data);
        if (data.brief) {
          setDraft(data.brief);
        }
        setLoading(false);
      });
  }, [slug]);

  const doSave = useCallback(async (briefData: Brief) => {
    setSaving(true);
    await fetch(`/api/clients/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief: briefData }),
    });
    setClient((prev) => (prev ? { ...prev, brief: briefData } : null));
    setSaving(false);
    setAutoSaved(true);
    setTimeout(() => setAutoSaved(false), 2000);
  }, [slug]);

  // Auto-save: debounce 2 seconds after typing stops
  const updateDraft = useCallback((newDraft: Brief) => {
    setDraft(newDraft);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => doSave(newDraft), 2000);
  }, [doSave]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, []);

  const handleSave = async () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    await doSave(draft);
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-[var(--accent-clay)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!client) return null;

  const brief = client.brief;
  const hasNoBrief =
    !brief || (!brief.summaryMd && !brief.northStar && !brief.audience);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold font-serif">Profile</h1>
          <p className="text-sm text-[var(--ink-muted)]">
            {client.name}'s synthesized brief
          </p>
        </div>
        <div className="flex items-center gap-2">
          {autoSaved && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="w-3.5 h-3.5" strokeWidth={2} />
              Saved
            </span>
          )}
          <Button
            variant={editing ? "default" : "outline"}
            size="sm"
            onClick={editing ? handleSave : () => setEditing(true)}
            disabled={saving}
            className={editing ? "bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white" : ""}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : editing ? (
              <Save className="w-4 h-4 mr-1" strokeWidth={1.5} />
            ) : null}
            {editing ? "Save" : "Edit brief"}
          </Button>
        </div>
      </div>

      {hasNoBrief && !editing ? (
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-10 text-center">
          <p className="text-sm font-medium mb-1">No brief yet</p>
          <p className="text-xs text-[var(--ink-muted)] mb-4">
            Edit to add the client brief manually.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
          >
            Add brief
          </Button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="space-y-6"
        >
          <BriefField
            label="Summary"
            value={editing ? draft.summaryMd : brief?.summaryMd}
            editing={editing}
            multiline
            onChange={(v) => updateDraft({ ...draft, summaryMd: v })}
          />
          <BriefField
            label="North Star"
            value={editing ? draft.northStar : brief?.northStar}
            editing={editing}
            onChange={(v) => updateDraft({ ...draft, northStar: v })}
          />
          <BriefField
            label="Audience"
            value={editing ? draft.audience : brief?.audience}
            editing={editing}
            multiline
            onChange={(v) => updateDraft({ ...draft, audience: v })}
          />
          <BriefField
            label="Voice"
            value={editing ? draft.voice : brief?.voice}
            editing={editing}
            multiline
            onChange={(v) => updateDraft({ ...draft, voice: v })}
          />
          <BriefField
            label="Constraints"
            value={editing ? draft.constraints : brief?.constraints}
            editing={editing}
            multiline
            onChange={(v) => updateDraft({ ...draft, constraints: v })}
          />

          {editing && (
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  if (brief) setDraft(brief);
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </motion.div>
      )}

      {/* Predictions / Forecast card */}
      <div className="mt-8">
        <ForecastCard slug={slug} />
      </div>
    </div>
  );
}

function ForecastCard({ slug }: { slug: string }) {
  const [forecast, setForecast] = useState<{ forecastMd: string; createdAt: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch(`/api/clients/${slug}/predictions`)
      .then((r) => r.json())
      .then((data) => {
        setForecast(data);
        setLoading(false);
      });
  }, [slug]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/clients/${slug}/predictions`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setForecast(data);
      }
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return null;

  return (
    <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
          <h3 className="text-sm font-medium">90-Day Forecast</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGenerate}
          disabled={generating}
          className="h-7 text-xs gap-1"
        >
          {generating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
          )}
          {forecast ? "Regenerate" : "Generate"}
        </Button>
      </div>

      {forecast?.forecastMd ? (
        <div>
          <div className="text-sm whitespace-pre-wrap prose-measure [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4">
            {forecast.forecastMd}
          </div>
          <p className="text-[10px] text-[var(--ink-muted)] mt-3">
            Generated {new Date(forecast.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
      ) : (
        <p className="text-sm text-[var(--ink-muted)]">
          Generate a forecast based on the client brief, history, and campaign outcomes.
        </p>
      )}
    </div>
  );
}

function BriefField({
  label,
  value,
  editing,
  multiline,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  editing: boolean;
  multiline?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-5">
      <label className="text-xs font-medium text-[var(--ink-muted)] uppercase tracking-wider mb-2 block">
        {label}
      </label>
      {editing ? (
        multiline ? (
          <Textarea
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className="text-sm"
          />
        ) : (
          <Input
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="text-sm"
          />
        )
      ) : (
        <div className="text-sm whitespace-pre-wrap prose-measure">
          {value || (
            <span className="text-[var(--ink-muted)] italic">Not set</span>
          )}
        </div>
      )}
    </div>
  );
}
