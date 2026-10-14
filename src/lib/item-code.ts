const CODE = /^BRG-?(\d{1,})$/i;

/** Normalises manual input ("brg-1", " BRG0001 ") to a canonical item code, or null. */
export function normalizeItemCode(input: string): string | null {
  const match = CODE.exec(input.trim());
  if (!match) return null;
  return `BRG-${match[1].padStart(4, "0")}`;
}

/** Pulls the item code out of a scanned QR payload (our /i/{code} URL or a bare code). */
export function codeFromScan(text: string): string | null {
  const trimmed = text.trim();
  const bare = normalizeItemCode(trimmed);
  if (bare) return bare;
  try {
    const match = /^\/i\/([^/]+)\/?$/.exec(new URL(trimmed).pathname);
    return match ? normalizeItemCode(decodeURIComponent(match[1])) : null;
  } catch {
    return null;
  }
}
