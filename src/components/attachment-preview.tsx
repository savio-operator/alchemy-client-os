"use client";

import { createPortal } from "react-dom";
import { X, Send, Upload as FileIcon } from "lucide-react";

const RADIUS = 15;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function UploadRing({ progress }: { progress: number }) {
  const offset = CIRCUMFERENCE - (progress / 100) * CIRCUMFERENCE;
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" className="-rotate-90">
      <circle cx="17" cy="17" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
      <circle
        cx="17"
        cy="17"
        r={RADIUS}
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 120ms linear" }}
      />
    </svg>
  );
}

/**
 * WhatsApp-style "confirm before sending" sheet: shown after picking a file
 * in chat, before it actually uploads. Send swaps to a circular progress
 * ring (driven by XHR upload progress in the caller) instead of navigating
 * away, so slow uploads are visibly still moving.
 */
export function AttachmentPreviewModal({
  file,
  previewUrl,
  caption,
  onCaptionChange,
  onCancel,
  onSend,
  uploadProgress,
  channelLabel,
}: {
  file: File;
  previewUrl: string;
  caption: string;
  onCaptionChange: (v: string) => void;
  onCancel: () => void;
  onSend: () => void;
  uploadProgress: number | null;
  channelLabel?: string;
}) {
  if (typeof document === "undefined") return null;

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  const isAudio = file.type.startsWith("audio/");
  const uploading = uploadProgress !== null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" />

      <div className="relative w-full max-w-lg flex flex-col rounded-2xl border border-[var(--rule)] bg-[var(--surface)] shadow-elevated overflow-hidden animate-sheet-in">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 h-12 border-b border-[var(--rule)] shrink-0">
          <p className="text-sm font-medium truncate">
            Send to {channelLabel || "chat"}
          </p>
          {!uploading && (
            <button
              onClick={onCancel}
              aria-label="Cancel"
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors shrink-0"
            >
              <X className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.8} />
            </button>
          )}
        </div>

        {/* Preview */}
        <div className="flex items-center justify-center bg-black/5 dark:bg-black/40 min-h-[240px] max-h-[50vh] overflow-hidden">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="max-w-full max-h-[50vh] object-contain" />
          ) : isVideo ? (
            <video src={previewUrl} controls className="max-w-full max-h-[50vh]" />
          ) : isAudio ? (
            <div className="w-full px-6 py-10 flex flex-col items-center gap-3">
              <FileIcon className="w-10 h-10 text-[var(--ink-muted)]" strokeWidth={1.5} />
              <audio src={previewUrl} controls className="w-full" />
            </div>
          ) : (
            <div className="w-full px-6 py-10 flex flex-col items-center gap-2">
              <FileIcon className="w-10 h-10 text-[var(--ink-muted)]" strokeWidth={1.5} />
              <p className="text-sm font-medium truncate max-w-full">{file.name}</p>
              <p className="text-xs text-[var(--ink-muted)]">
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
          )}
        </div>

        {/* Caption + send */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-[var(--rule)]">
          <input
            type="text"
            value={caption}
            onChange={(e) => onCaptionChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !uploading) {
                e.preventDefault();
                onSend();
              }
            }}
            disabled={uploading}
            placeholder="Add a caption…"
            className="flex-1 h-9 px-3 rounded-md border border-[var(--rule)] bg-[var(--bg)] text-sm outline-none focus:border-[var(--theme-accent)] disabled:opacity-60"
          />
          <button
            onClick={uploading ? onCancel : onSend}
            aria-label={uploading ? `Uploading ${uploadProgress}% — cancel` : "Send"}
            title={uploading ? `Uploading ${uploadProgress}%` : "Send"}
            className="w-9 h-9 flex items-center justify-center rounded-full shrink-0 relative"
            style={{ background: "var(--accent-clay)", color: "#fff" }}
          >
            {uploading ? (
              <>
                <UploadRing progress={uploadProgress ?? 0} />
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold">
                  {uploadProgress}
                </span>
              </>
            ) : (
              <Send className="w-4 h-4" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
