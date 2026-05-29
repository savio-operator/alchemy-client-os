"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ fontFamily: "system-ui", padding: "2rem" }}>
        <h2>Something went wrong</h2>
        <pre style={{ whiteSpace: "pre-wrap", color: "red" }}>
          {error.message}
        </pre>
        <pre style={{ whiteSpace: "pre-wrap", color: "#999", fontSize: "12px" }}>
          {error.stack}
        </pre>
        {error.digest && (
          <p style={{ color: "#666" }}>Digest: {error.digest}</p>
        )}
        <p style={{ color: "#666", fontSize: "12px" }}>
          Name: {error.name} | Constructor: {error.constructor?.name}
        </p>
        <button onClick={() => reset()} style={{ marginTop: "1rem" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
