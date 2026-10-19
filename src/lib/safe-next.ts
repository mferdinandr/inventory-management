/**
 * Returns `next` only when it is a same-origin path (a single leading '/'), else null.
 * Rejects '//host', '/\host', and anything with backslashes or control characters.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next?.startsWith("/") || next.startsWith("//")) return null;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return null;
  return next;
}
