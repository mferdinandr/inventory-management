"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button } from "@/components/ui";
import { t } from "@/lib/strings";

/** Shown inside the app layout when a page or action throws something unexpected. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <section className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-2xl font-bold">{t.errorPage.title}</h1>
      <p className="text-ink-600">{t.errorPage.body}</p>
      {error.digest && (
        <p className="text-sm text-ink-500">
          {t.errorPage.reference}: <code>{error.digest}</code>
        </p>
      )}
      <Button onClick={reset}>{t.errorPage.retry}</Button>
    </section>
  );
}
