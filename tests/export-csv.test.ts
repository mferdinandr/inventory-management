import { describe, expect, it } from "vitest";
import { dateCell, toCsv } from "@/server/export/csv";
import { parseCsv } from "@/server/import/csv";

describe("toCsv", () => {
  it("starts with a BOM, uses semicolons and CRLF", () => {
    const out = toCsv(["a", "b"], [["x", 1]]);
    expect(out).toBe("﻿a;b\r\nx;1\r\n");
  });

  it("quotes cells with delimiters, quotes and newlines", () => {
    const out = toCsv(["v"], [["a;b"], ['say "hi"'], ["line1\nline2"]]);
    expect(out).toContain('"a;b"');
    expect(out).toContain('"say ""hi"""');
    expect(out).toContain('"line1\nline2"');
  });

  it("writes null and undefined as empty cells and numbers unquoted", () => {
    expect(toCsv(["a", "b", "c"], [[null, undefined, 1500000]])).toBe("﻿a;b;c\r\n;;1500000\r\n");
  });

  it.each(["=SUM(A1)", "+1", "-1", "@cmd", "\tx"])(
    "neutralises the formula trigger in %j",
    (value) => {
      const cell = parseCsv(toCsv(["v"], [[value]]))[1]?.[0];
      expect(cell).toBe(`'${value}`);
    },
  );

  it("is read back unchanged by the importer's parser", () => {
    const rows = [
      ["BRG-0001", 'Set "MAYOR"; besar', "Kamar 101", 4],
      ["BRG-0002", "Meja", "", 1],
    ];
    const parsed = parseCsv(toCsv(["code", "name", "room", "quantity"], rows));
    expect(parsed).toEqual([
      ["code", "name", "room", "quantity"],
      ["BRG-0001", 'Set "MAYOR"; besar', "Kamar 101", "4"],
      ["BRG-0002", "Meja", "", "1"],
    ]);
  });
});

describe("dateCell", () => {
  it("formats as YYYY-MM-DD and blanks missing dates", () => {
    expect(dateCell(new Date("2026-03-04T00:00:00Z"))).toBe("2026-03-04");
    expect(dateCell(null)).toBe("");
    expect(dateCell(undefined)).toBe("");
  });
});
