/**
 * CSV writer for the item exports. Semicolon-separated with a UTF-8 BOM and CRLF line ends,
 * which is what Excel in Indonesian regional settings opens correctly (the importer reads the
 * same format back, docs/14).
 */
export type Cell = string | number | null | undefined;

const DELIMITER = ";";

/**
 * Text that starts with = + - @ (or a control character) is run as a formula by spreadsheets,
 * so it gets a leading apostrophe. Numbers are written as they are.
 */
function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(header: readonly string[], rows: readonly (readonly Cell[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(escapeCell).join(DELIMITER));
  return `﻿${lines.join("\r\n")}\r\n`;
}

export const dateCell = (d: Date | null | undefined): string =>
  d ? d.toISOString().slice(0, 10) : "";
