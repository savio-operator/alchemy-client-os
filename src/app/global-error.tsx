"use client";

import { useEffect, useState } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [reported, setReported] = useState(false);

  useEffect(() => {
    // Report error to server so it appears in Render logs
    fetch("/api/error-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        name: error.name,
        url: typeof window !== "undefined" ? window.location.href : "unknown",
      }),
    }).then(() => setReported(true)).catch(() => {});
  }, [error]);

  return (
    <html>
      <body style={{ fontFamily: "system-ui", padding: "2rem" }}>
        <h2>Something went wrong</h2>
        <pre style={{ whiteSpace: "pre-wrap", color: "red", fontSize: "13px" }}>
          {error.message}
        </pre>
        <pre style={{ whiteSpace: "pre-wrap", color: "#888", fontSize: "11px", maxHeight: "300px", overflow: "auto" }}>
          {error.stack}
        </pre>
        {error.digest && (
          <p style={{ color: "#666", fontSize: "12px" }}>Digest: {error.digest}</p>
        )}
        <p style={{ color: "#666", fontSize: "12px" }}>
          {reported ? "Error reported to server logs." : "Reporting error..."}
        </p>
        <button onClick={() => reset()} style={{ marginTop: "1rem", padding: "8px 16px", cursor: "pointer" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
