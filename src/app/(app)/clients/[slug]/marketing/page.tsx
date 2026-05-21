"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Globe,
  MapPin,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { Campaign } from "@/db/schema";

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  active: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  done: "bg-[var(--muted)] text-[var(--ink-muted)]",
};

export default function MarketingPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingType, setAddingType] = useState<string | null>(null);
  const [expandedOnline, setExpandedOnline] = useState(true);
  const [expandedOffline, setExpandedOffline] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    const res = await fetch(`/api/clients/${slug}/campaigns`);
    const data = await res.json();
    setCampaigns(data);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const onlineCampaigns = campaigns.filter((c) => c.type === "online");
  const offlineCampaigns = campaigns.filter((c) => c.type === "offline");

  const totalBudget = campaigns.reduce((sum, c) => sum + (c.budget || 0), 0);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold font-serif">Marketing</h1>
          {totalBudget > 0 && (
            <p className="text-sm text-[var(--ink-muted)]">
              Total allocated: {"\u20B9"}{totalBudget.toLocaleString("en-IN")}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-5 h-5 border-2 border-[var(--accent-clay)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Online section */}
          <CampaignSection
            title="Online"
            icon={Globe}
            campaigns={onlineCampaigns}
            expanded={expandedOnline}
            onToggle={() => setExpandedOnline(!expandedOnline)}
            onAdd={() => setAddingType(addingType === "online" ? null : "online")}
            adding={addingType === "online"}
            slug={slug}
            type="online"
            onCreated={() => { setAddingType(null); fetchCampaigns(); }}
            onDelete={(id) => handleDelete(id, slug, fetchCampaigns)}
          />

          {/* Offline section */}
          <CampaignSection
            title="Offline"
            icon={MapPin}
            campaigns={offlineCampaigns}
            expanded={expandedOffline}
            onToggle={() => setExpandedOffline(!expandedOffline)}
            onAdd={() => setAddingType(addingType === "offline" ? null : "offline")}
            adding={addingType === "offline"}
            slug={slug}
            type="offline"
            onCreated={() => { setAddingType(null); fetchCampaigns(); }}
            onDelete={(id) => handleDelete(id, slug, fetchCampaigns)}
          />
        </div>
      )}
    </div>
  );
}

async function handleDelete(id: string, slug: string, refresh: () => void) {
  await fetch(`/api/clients/${slug}/campaigns/${id}`, { method: "DELETE" });
  refresh();
}

function CampaignSection({
  title,
  icon: Icon,
  campaigns,
  expanded,
  onToggle,
  onAdd,
  adding,
  slug,
  type,
  onCreated,
  onDelete,
}: {
  title: string;
  icon: React.ElementType;
  campaigns: Campaign[];
  expanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
  adding: boolean;
  slug: string;
  type: string;
  onCreated: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--surface)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--rule)]">
        <button onClick={onToggle} className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
          )}
          <Icon className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.5} />
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-[var(--ink-muted)] bg-[var(--muted)] px-1.5 py-0.5 rounded-full">
            {campaigns.length}
          </span>
        </button>
        <Button variant="ghost" size="sm" onClick={onAdd} className="h-7 text-xs gap-1">
          <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
          Add
        </Button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            {adding && (
              <CampaignForm
                slug={slug}
                type={type}
                onCreated={onCreated}
                onCancel={() => onCreated()}
              />
            )}

            {campaigns.length === 0 && !adding ? (
              <div className="p-6 text-center">
                <p className="text-sm text-[var(--ink-muted)]">
                  No {title.toLowerCase()} campaigns yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--rule)]">
                {campaigns.map((campaign) => (
                  <CampaignRow
                    key={campaign.id}
                    campaign={campaign}
                    slug={slug}
                    onDelete={() => onDelete(campaign.id)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CampaignForm({
  slug,
  type,
  onCreated,
  onCancel,
}: {
  slug: string;
  type: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [objective, setObjective] = useState("");
  const [channel, setChannel] = useState("");
  const [budget, setBudget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleSubmit = async () => {
    await fetch(`/api/clients/${slug}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        objective: objective || null,
        channel: channel || null,
        budget: budget ? parseFloat(budget) : null,
        startDate: startDate || null,
        endDate: endDate || null,
      }),
    });
    onCreated();
  };

  return (
    <div className="p-4 border-b border-[var(--rule)] bg-[var(--bg)]">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-[var(--ink-muted)] mb-1 block">Objective</label>
          <Input value={objective} onChange={(e) => setObjective(e.target.value)} className="text-sm" autoFocus />
        </div>
        <div>
          <label className="text-xs text-[var(--ink-muted)] mb-1 block">Channel</label>
          <Input value={channel} onChange={(e) => setChannel(e.target.value)} className="text-sm" />
        </div>
        <div>
          <label className="text-xs text-[var(--ink-muted)] mb-1 block">Budget (INR)</label>
          <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-[var(--ink-muted)] mb-1 block">Start</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm" />
          </div>
          <div>
            <label className="text-xs text-[var(--ink-muted)] mb-1 block">End</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm" />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} className="bg-[var(--accent-clay)] hover:bg-[var(--accent-clay)]/90 text-white">
          Create
        </Button>
      </div>
    </div>
  );
}

function CampaignRow({
  campaign,
  slug,
  onDelete,
}: {
  campaign: Campaign;
  slug: string;
  onDelete: () => void;
}) {
  const handleStatusChange = async (status: string) => {
    await fetch(`/api/clients/${slug}/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    window.location.reload();
  };

  return (
    <div className="group flex items-center gap-4 px-5 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-medium truncate">
            {campaign.objective || "Untitled campaign"}
          </p>
          <Badge className={`text-[10px] ${STATUS_COLORS[campaign.status]}`}>
            {campaign.status}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--ink-muted)]">
          {campaign.channel && <span>{campaign.channel}</span>}
          {campaign.budget !== null && campaign.budget !== undefined && (
            <span>{"\u20B9"}{campaign.budget.toLocaleString("en-IN")}</span>
          )}
          {campaign.startDate && (
            <span>
              {campaign.startDate}
              {campaign.endDate && ` \u2192 ${campaign.endDate}`}
            </span>
          )}
        </div>
      </div>

      {/* Budget bar */}
      {campaign.budget !== null && campaign.budget !== undefined && campaign.budget > 0 && (
        <div className="w-24 h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              campaign.status === "done" ? "bg-green-500" : "bg-[var(--accent-clay)]"
            }`}
            style={{
              width: `${campaign.status === "done" ? 100 : campaign.status === "active" ? 60 : 0}%`,
            }}
          />
        </div>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-120">
        {campaign.status === "planned" && (
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleStatusChange("active")}>
            Start
          </Button>
        )}
        {campaign.status === "active" && (
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleStatusChange("done")}>
            Done
          </Button>
        )}
        <button
          onClick={onDelete}
          className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--muted)]"
        >
          <Trash2 className="w-3 h-3 text-[var(--ink-muted)]" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
