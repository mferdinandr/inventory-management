import * as Sentry from "@sentry/nextjs";

/**
 * Server-side error reporting. Silent unless NEXT_PUBLIC_SENTRY_DSN is set, so local development
 * and previews send nothing. Cookies, headers, request bodies and user info are not collected (dataCollection).
 */
export function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Send the error and its stack, nothing about the person: no user info, cookies, headers,
    // request bodies (login and password forms) or query strings (search terms).
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
    },
    tracesSampleRate: 0,
  });
}

/** Next calls this for every uncaught error in a request, including server actions. */
export const onRequestError = Sentry.captureRequestError;
