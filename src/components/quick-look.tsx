"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X, Loader2, BookOpen } from "lucide-react";

interface QuickLookProps {
  url: string;
  title?: string | null;
  source?: string | null;
  onClose: () => void;
}

interface Article {
  title: string;
  byline: string | null;
  heroImage: string | null;
  html: string;
}

/**
 * macOS Quick Look–style reader overlay: fetches the linked page through
 * /api/preview and renders a sanitized, readable version in a modal so the
 * article can be read fully without leaving the app.
 */
export function QuickLook({ url, title, source, onClose }: QuickLookProps) {
  const [article, setArticle] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (e.key === "Escape" || (e.key === " " && !typing)) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/preview?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Preview unavailable");
        const extracted = extractArticle(data.html, data.finalUrl || url);
        if (!extracted) throw new Error("Couldn't extract a readable version");
        setArticle(extracted);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Preview unavailable");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Panel — presented like a macOS sheet */}
      <div className="relative w-full max-w-3xl max-h-full flex flex-col rounded-2xl border border-[var(--rule)] bg-[var(--surface)] shadow-elevated overflow-hidden animate-sheet-in">
        {/* Header — frosted so content scrolls beneath it */}
        <div className="flex items-center gap-3 px-4 sm:px-6 h-12 border-b border-[var(--rule)] shrink-0 material">
          <BookOpen className="w-4 h-4 text-[var(--ink-muted)] shrink-0" strokeWidth={1.8} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {article?.title || title || "Preview"}
            </p>
          </div>
          {source && (
            <span className="hidden sm:block text-xs text-[var(--ink-muted)] shrink-0">
              {source}
            </span>
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-sheen flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium hover:bg-[var(--muted)] transition-colors shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.8} />
            <span className="hidden sm:inline">Open</span>
          </a>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="glass-sheen w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors shrink-0"
          >
            <X className="w-4 h-4 text-[var(--ink-muted)]" strokeWidth={1.8} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--ink-muted)]" strokeWidth={1.8} />
              <p className="text-xs text-[var(--ink-muted)]">Fetching article…</p>
            </div>
          ) : error || !article ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-2">
              <p className="text-sm font-medium">Preview unavailable</p>
              <p className="text-xs text-[var(--ink-muted)] max-w-sm">
                {error || "This site can't be previewed."} You can still read it on the
                original site.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[var(--ink)] text-[var(--bg)] text-xs font-medium"
              >
                Open original <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.8} />
              </a>
            </div>
          ) : (
            <article className="px-5 sm:px-10 py-8">
              <h1 className="text-2xl font-bold leading-tight mb-2">{article.title}</h1>
              {article.byline && (
                <p className="text-sm text-[var(--ink-muted)] mb-4">{article.byline}</p>
              )}
              {article.heroImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={article.heroImage}
                  alt=""
                  className="w-full rounded-lg mb-6 max-h-96 object-cover"
                />
              )}
              <div
                className="quick-look-content text-[15px] leading-relaxed [&_p]:mb-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_li]:mb-1 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--rule)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4 [&_img]:rounded-lg [&_img]:my-4 [&_img]:max-w-full [&_a]:underline [&_a]:underline-offset-2 [&_pre]:bg-[var(--muted)] [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:text-xs [&_pre]:overflow-x-auto [&_pre]:my-4 [&_hr]:my-6 [&_hr]:border-[var(--rule)] [&_figcaption]:text-xs [&_figcaption]:text-[var(--ink-muted)] [&_figcaption]:text-center [&_figcaption]:-mt-2 [&_figcaption]:mb-4"
                dangerouslySetInnerHTML={{ __html: article.html }}
              />
            </article>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// --- Article extraction + sanitization (runs on the already-inert DOMParser
// document; scripts never execute, and only whitelisted nodes are copied out) ---

const ALLOWED_TAGS = new Set([
  "P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "BLOCKQUOTE",
  "PRE", "CODE", "EM", "STRONG", "B", "I", "U", "S", "A", "IMG", "FIGURE",
  "FIGCAPTION", "BR", "HR", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH",
  "SPAN", "DIV", "SECTION", "PICTURE", "SOURCE", "TIME", "MARK", "SUB", "SUP",
]);

const STRIP_SELECTOR =
  "script, style, noscript, iframe, form, nav, aside, footer, header, svg, button, input, select, textarea, " +
  "[class*='share'], [class*='related'], [class*='newsletter-signup'], [class*='comment'], [class*='advert'], [id*='advert'], [class*='promo'], [class*='sidebar'], [aria-hidden='true']";

function extractArticle(rawHtml: string, baseUrl: string): Article | null {
  const doc = new DOMParser().parseFromString(rawHtml, "text/html");

  const meta = (name: string) =>
    doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute("content") || null;

  const title =
    meta("og:title") || doc.querySelector("title")?.textContent?.trim() || "Untitled";
  const byline = meta("author") || meta("article:author");
  const heroImage = absolutize(meta("og:image"), baseUrl);

  doc.querySelectorAll(STRIP_SELECTOR).forEach((el) => el.remove());

  // Pick the densest content container
  const candidates = [
    ...doc.querySelectorAll(
      "article, [role='main'], main, .post-content, .entry-content, .article-body, .article-content, .story-body"
    ),
    doc.body,
  ];
  let best: Element | null = null;
  let bestScore = 0;
  for (const el of candidates) {
    const paragraphs = el.querySelectorAll("p");
    let score = 0;
    paragraphs.forEach((p) => {
      score += (p.textContent || "").trim().length;
    });
    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (!best || bestScore < 250) return null; // not enough readable text

  const container = document.createElement("div");
  for (const child of Array.from(best.childNodes)) {
    const clean = sanitizeNode(child, baseUrl);
    if (clean) container.appendChild(clean);
  }
  if ((container.textContent || "").trim().length < 250) return null;

  return { title, byline, heroImage, html: container.innerHTML };
}

function sanitizeNode(node: Node, baseUrl: string): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent || "");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as Element;
  if (!ALLOWED_TAGS.has(el.tagName)) return null;

  const clean = document.createElement(el.tagName);

  if (el.tagName === "A") {
    const href = absolutize(el.getAttribute("href"), baseUrl);
    if (href) {
      clean.setAttribute("href", href);
      clean.setAttribute("target", "_blank");
      clean.setAttribute("rel", "noopener noreferrer");
    }
  } else if (el.tagName === "IMG") {
    const src = absolutize(
      el.getAttribute("src") || el.getAttribute("data-src") || firstSrcset(el.getAttribute("srcset") || el.getAttribute("data-srcset")),
      baseUrl
    );
    if (!src) return null;
    clean.setAttribute("src", src);
    clean.setAttribute("alt", el.getAttribute("alt") || "");
    clean.setAttribute("loading", "lazy");
  } else if (el.tagName === "SOURCE" || el.tagName === "TIME") {
    // keep tag, no attributes needed
  }

  for (const child of Array.from(el.childNodes)) {
    const cleanChild = sanitizeNode(child, baseUrl);
    if (cleanChild) clean.appendChild(cleanChild);
  }

  // Drop containers that end up with nothing readable in them
  if (
    !["IMG", "BR", "HR"].includes(el.tagName) &&
    (clean.textContent || "").trim() === "" &&
    !clean.querySelector("img")
  ) {
    return null;
  }

  return clean;
}

function firstSrcset(srcset: string | null): string | null {
  if (!srcset) return null;
  return srcset.split(",")[0]?.trim().split(/\s+/)[0] || null;
}

function absolutize(src: string | null, baseUrl: string): string | null {
  if (!src) return null;
  try {
    const abs = new URL(src, baseUrl);
    if (abs.protocol !== "http:" && abs.protocol !== "https:") return null;
    return abs.toString();
  } catch {
    return null;
  }
}
