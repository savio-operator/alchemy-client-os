import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import dns from "dns/promises";
import net from "net";

export const dynamic = "force-dynamic";

const MAX_REDIRECTS = 3;
const MAX_BYTES = 2_000_000; // 2 MB of HTML is plenty for any article
const FETCH_TIMEOUT_MS = 12_000;

/**
 * Quick Look preview proxy.
 * Fetches an external article's HTML server-side (the browser can't, due to
 * CORS) so the client can render a readable preview without leaving the app.
 * Extraction and sanitization happen client-side with DOMParser; this route
 * only guards the fetch itself.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = rateLimit(`preview:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
  if (!limit.success) {
    return NextResponse.json({ error: "Too many preview requests" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");
  if (!rawUrl) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  try {
    const result = await fetchWithGuards(rawUrl);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Preview failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

async function fetchWithGuards(
  rawUrl: string
): Promise<{ html: string; finalUrl: string }> {
  let url = await validateUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 AdchemyPreview/1.0",
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } finally {
      clearTimeout(timer);
    }

    // Follow redirects manually so every hop is re-validated against SSRF rules
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("Redirect without location");
      url = await validateUrl(new URL(location, url).toString());
      continue;
    }

    if (!res.ok) throw new Error(`Site responded with ${res.status}`);

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("html")) {
      throw new Error("Link is not a web page");
    }

    const html = await readCapped(res, MAX_BYTES);
    return { html, finalUrl: url.toString() };
  }

  throw new Error("Too many redirects");
}

async function validateUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) links can be previewed");
  }
  if (url.username || url.password) throw new Error("Invalid URL");

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Address not allowed");
  }

  // Resolve and reject private / loopback / link-local ranges (SSRF guard)
  const addresses = net.isIP(host)
    ? [host]
    : (await dns.lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0) throw new Error("Could not resolve host");
  for (const addr of addresses) {
    if (isPrivateAddress(addr)) throw new Error("Address not allowed");
  }

  return url;
}

function isPrivateAddress(addr: string): boolean {
  if (net.isIP(addr) === 6) {
    const a = addr.toLowerCase();
    // Normalize IPv4-mapped addresses (::ffff:10.0.0.1)
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      a === "::" ||
      a === "::1" ||
      a.startsWith("fe80:") || // link-local
      a.startsWith("fc") || a.startsWith("fd") // unique local
    );
  }

  const parts = addr.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast + reserved
  );
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    chunks.push(value);
    if (received >= maxBytes) {
      reader.cancel().catch(() => {});
      break;
    }
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}
