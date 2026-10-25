"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { t } from "@/lib/strings";

/** Last resort when even the root layout fails; it has to render its own <html>. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="id">
      <body
        style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1rem", textAlign: "center" }}
      >
        <h1>{t.errorPage.title}</h1>
        <p>{t.errorPage.body}</p>
        {error.digest && (
          <p>
            {t.errorPage.reference}: <code>{error.digest}</code>
          </p>
        )}
        <a href="/">{t.errorPage.home}</a>
      </body>
    </html>
  );
}
