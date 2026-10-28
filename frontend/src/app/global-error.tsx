"use client";

import { useEffect } from "react";
import { log } from "@/lib/logger";

/** Last-resort error boundary (replaces the root layout, so it cannot use translations). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    log.error("GLOBAL_RENDER_ERROR", error.message, { digest: error.digest });
  }, [error]);
  return (
    <html>
      <body style={{ fontFamily: "system-ui", display: "grid", placeItems: "center", minHeight: "100dvh", textAlign: "center" }}>
        <div>
          <h1>Something went wrong / Etwas ist schiefgelaufen</h1>
          <button onClick={reset} style={{ padding: "0.75rem 1.25rem", fontSize: "1rem" }}>
            OK
          </button>
        </div>
      </body>
    </html>
  );
}
