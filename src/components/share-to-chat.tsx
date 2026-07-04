"use client";

import { useEffect, useRef, useState } from "react";
import { Share2, Check, Loader2, MessageSquare } from "lucide-react";

interface ChannelOption {
  id: string;
  name: string | null;
  type: string;
}

/**
 * Share button for news/discovery items: picks any group channel or DM the
 * user is a member of and drops a formatted link into it via the existing
 * team-chat message API.
 */
export function ShareToChatButton({
  title,
  url,
  source,
  className,
}: {
  title: string;
  url: string;
  source?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState<ChannelOption[] | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || channels) return;
    fetch("/api/team-chat/channels")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setChannels(data.filter((c: ChannelOption) => c.type !== "voice"));
        }
      })
      .catch(() => setChannels([]));
  }, [open, channels]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const share = async (channel: ChannelOption) => {
    setSendingId(channel.id);
    try {
      const content = `📰 **${title}**${source ? ` — ${source}` : ""}\n${url}`;
      await fetch(`/api/team-chat/channels/${channel.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setSentId(channel.id);
      setTimeout(() => {
        setOpen(false);
        setSentId(null);
      }, 900);
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Share to chat"
        title="Share to chat"
        className={
          className ??
          "w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        }
      >
        <Share2 className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.8} />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-1 z-30 w-56 max-h-72 overflow-y-auto rounded-lg border border-[var(--rule)] bg-[var(--bg)] shadow-xl py-1"
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            Share to…
          </p>
          {channels === null ? (
            <div className="px-3 py-4 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--ink-muted)]" />
            </div>
          ) : channels.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--ink-muted)]">No chats available</p>
          ) : (
            channels.map((c) => (
              <button
                key={c.id}
                onClick={() => share(c)}
                disabled={sendingId === c.id}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--muted)] transition-colors disabled:opacity-60"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[var(--ink-muted)] shrink-0" strokeWidth={1.8} />
                <span className="flex-1 truncate">
                  {c.type === "direct" ? c.name || "Direct message" : `#${c.name}`}
                </span>
                {sendingId === c.id && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
                {sentId === c.id && <Check className="w-3.5 h-3.5 text-[var(--theme-accent)] shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
