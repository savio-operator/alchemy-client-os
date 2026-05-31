"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Compass,
  Plus,
  X,
  Loader2,
  Building2,
  Mail,
  Phone,
  Globe,
  Trash2,
  ArrowRightCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Lead {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUSES = ["new", "contacted", "qualified", "proposal", "won", "lost"] as const;
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  qualified: "bg-purple-100 text-purple-700",
  proposal: "bg-orange-100 text-orange-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-[var(--muted)] text-[var(--ink-muted)]",
};
const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};
const SOURCE_OPTIONS = [
  { value: "referral", label: "Referral" },
  { value: "inbound", label: "Inbound" },
  { value: "outbound", label: "Outbound" },
  { value: "social", label: "Social" },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editState, setEditState] = useState<Partial<Lead>>({});
  const [saving, setSaving] = useState(false);

  // New form state
  const [newLead, setNewLead] = useState({ name: "", company: "", email: "", phone: "", source: "", notes: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/leads")
      .then((r) => r.json())
      .then((data) => { setLeads(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = activeFilter === "all" ? leads : leads.filter((l) => l.status === activeFilter);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.name.trim()) return;
    setCreating(true);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newLead),
    });
    if (res.ok) {
      const lead = await res.json();
      setLeads((prev) => [lead, ...prev]);
      setNewLead({ name: "", company: "", email: "", phone: "", source: "", notes: "" });
      setShowNewForm(false);
    }
    setCreating(false);
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    const res = await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...editState }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
      setEditState({});
    }
    setSaving(false);
  };

  const handleStatusChange = async (id: string, status: string) => {
    const res = await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this lead? This cannot be undone.")) return;
    const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (res.ok) {
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setExpandedId(null);
    }
  };

  const handleConvert = async (id: string) => {
    if (!window.confirm("Convert this lead to a client?")) return;
    const res = await fetch(`/api/leads/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "convert" }),
    });
    if (res.ok) {
      const client = await res.json();
      router.push(`/clients/${client.slug}`);
    }
  };

  const expandLead = (lead: Lead) => {
    if (expandedId === lead.id) {
      setExpandedId(null);
      setEditState({});
    } else {
      setExpandedId(lead.id);
      setEditState({
        name: lead.name,
        company: lead.company || "",
        email: lead.email || "",
        phone: lead.phone || "",
        source: lead.source || "",
        notes: lead.notes || "",
      });
    }
  };

  const statusCounts = STATUSES.reduce((acc, s) => {
    acc[s] = leads.filter((l) => l.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 sm:gap-3">
          <Compass className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--ink-muted)]" strokeWidth={1.5} />
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold">Leads</h1>
          <span className="text-sm text-[var(--ink-muted)]">({leads.length})</span>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-sm font-medium border border-[var(--rule)] bg-[var(--surface)] hover:bg-[var(--muted)] text-[var(--ink)] transition-colors duration-120"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          New lead
        </button>
      </div>
      <p className="text-[var(--ink-muted)] mb-6">
        Track and manage potential clients through your pipeline.
      </p>

      {/* New lead form */}
      {showNewForm && (
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">New lead</span>
            <button onClick={() => setShowNewForm(false)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--muted)]">
              <X className="w-3.5 h-3.5 text-[var(--ink-muted)]" strokeWidth={1.5} />
            </button>
          </div>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--ink-muted)] mb-1">Name <span className="text-[var(--accent-clay)]">*</span></label>
                <input type="text" value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} required placeholder="Contact name" className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]" />
              </div>
              <div>
                <label className="block text-xs text-[var(--ink-muted)] mb-1">Company</label>
                <input type="text" value={newLead.company} onChange={(e) => setNewLead({ ...newLead, company: e.target.value })} placeholder="Company name" className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]" />
              </div>
              <div>
                <label className="block text-xs text-[var(--ink-muted)] mb-1">Email</label>
                <input type="email" value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} placeholder="email@example.com" className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]" />
              </div>
              <div>
                <label className="block text-xs text-[var(--ink-muted)] mb-1">Phone</label>
                <input type="text" value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} placeholder="+91 99999 99999" className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]" />
              </div>
              <div>
                <label className="block text-xs text-[var(--ink-muted)] mb-1">Source</label>
                <select value={newLead.source} onChange={(e) => setNewLead({ ...newLead, source: e.target.value })} className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]">
                  <option value="">Select...</option>
                  {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-[var(--ink-muted)] mb-1">Notes</label>
                <textarea value={newLead.notes} onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })} rows={2} placeholder="Any notes about this lead..." className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent resize-none outline-none focus:border-[var(--accent-clay)]" />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button type="submit" disabled={creating} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white transition-colors disabled:opacity-60">
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {creating ? "Creating..." : "Create"}
              </button>
              <button type="button" onClick={() => setShowNewForm(false)} className="h-8 px-3 text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Pipeline tabs */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveFilter("all")}
          className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium whitespace-nowrap transition-colors ${
            activeFilter === "all" ? "bg-[var(--accent-clay)] text-white" : "text-[var(--ink-muted)] hover:bg-[var(--muted)]"
          }`}
        >
          All ({leads.length})
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setActiveFilter(s)}
            className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium whitespace-nowrap transition-colors ${
              activeFilter === s ? "bg-[var(--accent-clay)] text-white" : "text-[var(--ink-muted)] hover:bg-[var(--muted)]"
            }`}
          >
            {STATUS_LABELS[s]} ({statusCounts[s] || 0})
          </button>
        ))}
      </div>

      {/* Leads list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--ink-muted)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] p-12 text-center">
          <div className="w-12 h-12 rounded-[var(--radius)] bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
            <Compass className="w-5 h-5 text-[var(--ink-muted)]" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium mb-1">No leads found</p>
          <p className="text-xs text-[var(--ink-muted)]">
            {activeFilter === "all" ? "Add your first lead to get started." : `No leads with status "${STATUS_LABELS[activeFilter]}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((lead) => {
            const isExpanded = expandedId === lead.id;
            return (
              <div key={lead.id} className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] overflow-hidden">
                {/* Collapsed row */}
                <button
                  onClick={() => expandLead(lead)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[var(--muted)] transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lead.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {lead.company && (
                        <span className="flex items-center gap-1 text-xs text-[var(--ink-muted)]">
                          <Building2 className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                          {lead.company}
                        </span>
                      )}
                      {lead.email && (
                        <span className="flex items-center gap-1 text-xs text-[var(--ink-muted)]">
                          <Mail className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                          {lead.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {lead.source && (
                      <span className="hidden sm:flex items-center gap-1 text-xs text-[var(--ink-muted)]">
                        <Globe className="w-3 h-3" strokeWidth={1.5} />
                        {SOURCE_OPTIONS.find((o) => o.value === lead.source)?.label || lead.source}
                      </span>
                    )}
                    <span className="hidden sm:inline text-xs text-[var(--ink-muted)]">{formatDate(lead.createdAt)}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lead.status] || ""}`}>
                      {STATUS_LABELS[lead.status] || lead.status}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
                    )}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-[var(--rule)] px-4 py-4 bg-[var(--bg)]">
                    {/* Status pipeline */}
                    <div className="mb-5">
                      <label className="block text-xs text-[var(--ink-muted)] mb-2">Pipeline stage</label>
                      <div className="flex items-center gap-1 overflow-x-auto pb-1">
                        {STATUSES.map((s) => (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(lead.id, s)}
                            className={`flex-1 min-w-[60px] py-1.5 rounded-[var(--radius-sm)] text-xs font-medium text-center transition-colors whitespace-nowrap ${
                              lead.status === s
                                ? STATUS_COLORS[s]
                                : "bg-[var(--muted)] text-[var(--ink-muted)] hover:bg-[var(--rule)]"
                            }`}
                          >
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Editable fields */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="block text-xs text-[var(--ink-muted)] mb-1">Name</label>
                        <input
                          type="text"
                          value={(editState.name as string) ?? lead.name}
                          onChange={(e) => setEditState({ ...editState, name: e.target.value })}
                          className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--ink-muted)] mb-1">Company</label>
                        <input
                          type="text"
                          value={(editState.company as string) ?? lead.company ?? ""}
                          onChange={(e) => setEditState({ ...editState, company: e.target.value })}
                          className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--ink-muted)] mb-1">Email</label>
                        <input
                          type="email"
                          value={(editState.email as string) ?? lead.email ?? ""}
                          onChange={(e) => setEditState({ ...editState, email: e.target.value })}
                          className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--ink-muted)] mb-1">Phone</label>
                        <input
                          type="text"
                          value={(editState.phone as string) ?? lead.phone ?? ""}
                          onChange={(e) => setEditState({ ...editState, phone: e.target.value })}
                          className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--ink-muted)] mb-1">Source</label>
                        <select
                          value={(editState.source as string) ?? lead.source ?? ""}
                          onChange={(e) => setEditState({ ...editState, source: e.target.value })}
                          className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent outline-none focus:border-[var(--accent-clay)]"
                        >
                          <option value="">Select...</option>
                          {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-xs text-[var(--ink-muted)] mb-1">Notes</label>
                      <textarea
                        value={(editState.notes as string) ?? lead.notes ?? ""}
                        onChange={(e) => setEditState({ ...editState, notes: e.target.value })}
                        rows={3}
                        placeholder="Notes about this lead..."
                        className="w-full text-sm border border-[var(--rule)] rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-transparent resize-none outline-none focus:border-[var(--accent-clay)]"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--rule)]">
                      <button
                        onClick={() => handleSave(lead.id)}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white transition-colors disabled:opacity-60"
                      >
                        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Save changes
                      </button>
                      {(lead.status === "qualified" || lead.status === "won") && (
                        <button
                          onClick={() => handleConvert(lead.id)}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors"
                        >
                          <ArrowRightCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                          Convert to Client
                        </button>
                      )}
                      <div className="flex-1" />
                      <button
                        onClick={() => handleDelete(lead.id)}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <a href="/" className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors">
          &larr; Back to home
        </a>
      </div>
    </div>
  );
}
