import { getSql } from "../db";
import { ensureSchema } from "../schema";
import { parseCsv } from "./csv";

export type Prospect = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  company: string | null;
  industry: string | null;
  source: string;
  status: string;
  created_at: string;
};

type CanonField =
  | "email"
  | "first_name"
  | "last_name"
  | "full_name"
  | "title"
  | "company"
  | "industry";

// Maps common header variants (normalized) to canonical fields.
const HEADER_MAP: Record<string, CanonField> = {
  email: "email",
  "email address": "email",
  "e mail": "email",
  "work email": "email",
  firstname: "first_name",
  "first name": "first_name",
  first: "first_name",
  "given name": "first_name",
  lastname: "last_name",
  "last name": "last_name",
  last: "last_name",
  surname: "last_name",
  "family name": "last_name",
  "full name": "full_name",
  name: "full_name",
  title: "title",
  "job title": "title",
  position: "title",
  role: "title",
  company: "company",
  "company name": "company",
  organization: "company",
  organisation: "company",
  employer: "company",
  account: "company",
  industry: "industry",
  sector: "industry",
  vertical: "industry",
};

function canonicalField(header: string): CanonField | null {
  const key = header
    .toLowerCase()
    .trim()
    .replace(/[_\-]/g, " ")
    .replace(/\s+/g, " ");
  return HEADER_MAP[key] ?? null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ImportSummary = {
  totalRows: number;
  inserted: number;
  duplicatesInFile: number;
  duplicatesExisting: number;
  invalid: number;
  mapping: Partial<Record<CanonField, string>>;
  unmappedHeaders: string[];
  sampleInvalid: string[];
  error?: string;
};

export async function importProspects(
  csvText: string,
  source = "csv",
): Promise<ImportSummary> {
  await ensureSchema();
  const sql = getSql();

  const rows = parseCsv(csvText);
  const empty: ImportSummary = {
    totalRows: 0,
    inserted: 0,
    duplicatesInFile: 0,
    duplicatesExisting: 0,
    invalid: 0,
    mapping: {},
    unmappedHeaders: [],
    sampleInvalid: [],
  };

  if (rows.length < 2) {
    return { ...empty, error: "CSV needs a header row and at least one data row." };
  }

  const header = rows[0];
  const fieldByIndex = header.map(canonicalField);

  const mapping: Partial<Record<CanonField, string>> = {};
  const unmappedHeaders: string[] = [];
  header.forEach((h, idx) => {
    const f = fieldByIndex[idx];
    if (f && f !== "full_name") {
      if (!mapping[f]) mapping[f] = h.trim();
    } else if (f === "full_name") {
      if (!mapping.full_name) mapping.full_name = h.trim();
    } else if (h.trim()) {
      unmappedHeaders.push(h.trim());
    }
  });

  if (!fieldByIndex.includes("email")) {
    return {
      ...empty,
      mapping,
      unmappedHeaders,
      error: `No email column detected. Headers seen: ${header
        .map((h) => h.trim())
        .filter(Boolean)
        .join(", ")}`,
    };
  }

  const dataRows = rows.slice(1);
  const seen = new Set<string>();
  const records: Array<Record<string, unknown>> = [];
  let invalid = 0;
  let duplicatesInFile = 0;
  const sampleInvalid: string[] = [];

  for (const r of dataRows) {
    const rec: Record<string, string> = {};
    const extra: Record<string, string> = {};
    let fullName = "";

    header.forEach((h, idx) => {
      const val = (r[idx] ?? "").trim();
      const field = fieldByIndex[idx];
      if (!field) {
        if (val) extra[h.trim()] = val;
      } else if (field === "full_name") {
        fullName = val;
      } else {
        rec[field] = val;
      }
    });

    if (!rec.first_name && !rec.last_name && fullName) {
      const parts = fullName.split(/\s+/);
      rec.first_name = parts.shift() ?? "";
      rec.last_name = parts.join(" ");
    }

    const email = (rec.email ?? "").toLowerCase().trim();
    if (!EMAIL_RE.test(email)) {
      invalid++;
      if (sampleInvalid.length < 5) sampleInvalid.push(email || "(blank)");
      continue;
    }
    if (seen.has(email)) {
      duplicatesInFile++;
      continue;
    }
    seen.add(email);

    records.push({
      email,
      first_name: rec.first_name || null,
      last_name: rec.last_name || null,
      title: rec.title || null,
      company: rec.company || null,
      industry: rec.industry || null,
      source,
      raw: extra,
    });
  }

  let inserted = 0;
  if (records.length > 0) {
    const result = await sql`
      insert into prospects ${sql(
        records,
        "email",
        "first_name",
        "last_name",
        "title",
        "company",
        "industry",
        "source",
        "raw",
      )}
      on conflict (email) do nothing
      returning email
    `;
    inserted = result.length;
  }

  return {
    totalRows: dataRows.length,
    inserted,
    duplicatesInFile,
    duplicatesExisting: records.length - inserted,
    invalid,
    mapping,
    unmappedHeaders,
    sampleInvalid,
  };
}

export async function listProspects(limit = 50): Promise<Prospect[]> {
  await ensureSchema();
  const sql = getSql();
  return sql<Prospect[]>`
    select id, email, first_name, last_name, title, company, industry,
           source, status, created_at
    from prospects
    order by created_at desc
    limit ${limit}
  `;
}

export async function countProspects(): Promise<number> {
  await ensureSchema();
  const sql = getSql();
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count from prospects
  `;
  return count;
}

export async function deleteProspect(id: string): Promise<boolean> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`delete from prospects where id = ${id} returning id`;
  return rows.length > 0;
}
