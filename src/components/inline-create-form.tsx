"use client";

import { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";

interface FieldOption {
  value: string;
  label: string;
}

interface Field {
  name: string;
  label: string;
  type: "text" | "select" | "number" | "date" | "textarea";
  required?: boolean;
  options?: FieldOption[];
  placeholder?: string;
}

interface InlineCreateFormProps {
  buttonLabel?: string;
  fields: Field[];
  apiEndpoint: string;
  onCreated?: () => void;
}

export function InlineCreateForm({
  buttonLabel = "New",
  fields,
  apiEndpoint,
  onCreated,
}: InlineCreateFormProps) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setOpen(false);
    setValues({});
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to create. Please try again.");
        setSubmitting(false);
        return;
      }

      reset();
      if (onCreated) {
        onCreated();
      } else {
        window.location.reload();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-sm font-medium border border-[var(--rule)] bg-[var(--surface)] hover:bg-[var(--muted)] text-[var(--ink)] transition-colors duration-120"
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        {buttonLabel}
      </button>
    );
  }

  return (
    <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">{buttonLabel}</span>
        <button
          onClick={reset}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--muted)] transition-colors"
        >
          <X className="w-3.5 h-3.5 text-[var(--ink-muted)]" strokeWidth={1.5} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {fields.map((field) => (
            <div key={field.name} className={field.type === "textarea" ? "col-span-2" : ""}>
              <label className="block text-xs text-[var(--ink-muted)] mb-1">
                {field.label}
                {field.required && <span className="text-[var(--accent-clay)] ml-0.5">*</span>}
              </label>
              {field.type === "select" ? (
                <select
                  value={values[field.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  required={field.required}
                  className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)] transition-colors"
                >
                  <option value="">Select…</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  value={values[field.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  required={field.required}
                  placeholder={field.placeholder}
                  rows={2}
                  className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent resize-none outline-none focus:border-[var(--accent-clay)] transition-colors"
                />
              ) : (
                <input
                  type={field.type}
                  value={values[field.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  required={field.required}
                  placeholder={field.placeholder}
                  className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)] transition-colors"
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white transition-colors disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? "Creating…" : "Create"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="h-8 px-3 text-sm text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
