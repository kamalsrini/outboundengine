/**
 * Minimal RFC 4180 CSV parser: handles quoted fields, escaped quotes (""),
 * and commas / newlines inside quotes. Returns rows of string cells.
 * Dependency-free so the deploy stays lean.
 */
export function parseCsv(input: string): string[][] {
  // Strip BOM and normalize line endings.
  const text = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  // Trailing field/row (file not ending in newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop rows that are entirely empty.
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
