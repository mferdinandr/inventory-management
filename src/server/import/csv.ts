/**
 * A small CSV reader (RFC 4180 plus what spreadsheets export): UTF-8 BOM, comma or semicolon
 * delimiter, quoted fields with embedded delimiters, newlines and doubled quotes.
 * Written here instead of pulling in a library: the format is tiny, the input is a one-off
 * file, and the script then has no extra dependency to audit.
 */

export type Delimiter = "," | ";";

/** Picks `;` over `,` when the header line (outside quotes) has more of them. */
export function detectDelimiter(text: string): Delimiter {
  let commas = 0;
  let semicolons = 0;
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "\n" || ch === "\r")) break;
    else if (!quoted && ch === ",") commas++;
    else if (!quoted && ch === ";") semicolons++;
  }
  return semicolons > commas ? ";" : ",";
}

/** Splits text into rows of raw fields. Blank lines are dropped. */
export function parseCsv(input: string, delimiter?: Delimiter): string[][] {
  const text = input.startsWith("﻿") ? input.slice(1) : input;
  const sep = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let wasQuoted = false; // a quoted empty field ("") still counts as a field

  const endField = () => {
    row.push(field);
    field = "";
    wasQuoted = false;
  };
  const endRow = () => {
    endField();
    if (row.length > 1 || row[0] !== "" || wasQuoted) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") {
      quoted = true;
      wasQuoted = true;
    } else if (ch === sep) {
      endField();
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else field += ch;
  }
  if (quoted) throw new Error("Tanda kutip tidak ditutup di akhir berkas");
  if (field !== "" || row.length > 0 || wasQuoted) endRow();
  return rows;
}

export type CsvRecord = {
  /** Row number as a spreadsheet shows it: the header is row 1, the first data row is 2. */
  row: number;
  values: Record<string, string>;
};

/** Header names are lower-cased and trimmed; fields are trimmed. */
export function readRecords(text: string): { header: string[]; records: CsvRecord[] } {
  const [head, ...body] = parseCsv(text);
  if (!head) return { header: [], records: [] };
  const header = head.map((h) => h.trim().toLowerCase());
  const records = body.map((fields, i) => ({
    row: i + 2,
    values: Object.fromEntries(header.map((h, c) => [h, (fields[c] ?? "").trim()])),
  }));
  return { header, records };
}
