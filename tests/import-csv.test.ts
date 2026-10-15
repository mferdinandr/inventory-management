import { describe, expect, it } from "vitest";
import { detectDelimiter, parseCsv, readRecords } from "@/server/import/csv";

describe("parseCsv", () => {
  it("parses plain rows and ignores blank lines", () => {
    expect(parseCsv("a,b\n1,2\n\n3,4\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("handles CRLF and a missing final newline", () => {
    expect(parseCsv("a,b\r\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("strips a UTF-8 BOM", () => {
    expect(parseCsv("﻿ref,name\nx,y")[0]).toEqual(["ref", "name"]);
  });

  it("keeps commas, newlines and doubled quotes inside quoted fields", () => {
    expect(parseCsv('a,b\n"x, y","line1\nline2"\n"say ""hi""",z')).toEqual([
      ["a", "b"],
      ["x, y", "line1\nline2"],
      ['say "hi"', "z"],
    ]);
  });

  it("keeps empty fields and quoted empty fields", () => {
    expect(parseCsv('a,b,c\n,"",x')).toEqual([
      ["a", "b", "c"],
      ["", "", "x"],
    ]);
  });

  it("detects semicolons, but not those inside quotes", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter('a,b\n"x;y;z",1')).toBe(",");
    expect(detectDelimiter('"a;b;c",d,e\n')).toBe(",");
    expect(parseCsv("a;b\n1,5;2")).toEqual([
      ["a", "b"],
      ["1,5", "2"],
    ]);
  });

  it("rejects an unterminated quote", () => {
    expect(() => parseCsv('a,b\n"oops,1')).toThrow(/kutip/);
  });
});

describe("readRecords", () => {
  it("normalises headers and numbers rows from 2", () => {
    const { header, records } = readRecords("﻿ Ref ,NAME\nA1, Pean \n\nA2,Klem");
    expect(header).toEqual(["ref", "name"]);
    expect(records).toEqual([
      { row: 2, values: { ref: "A1", name: "Pean" } },
      { row: 3, values: { ref: "A2", name: "Klem" } },
    ]);
  });

  it("fills missing trailing fields with empty strings", () => {
    expect(readRecords("a,b,c\n1").records[0]?.values).toEqual({ a: "1", b: "", c: "" });
  });
});
