"use client";

import { useEffect, useRef, useState } from "react";

type Prospect = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  company: string | null;
  industry: string | null;
  source: string;
  status: string;
};

type Summary = {
  totalRows: number;
  inserted: number;
  duplicatesInFile: number;
  duplicatesExisting: number;
  invalid: number;
  mapping: Record<string, string>;
  unmappedHeaders: string[];
  sampleInvalid: string[];
  error?: string;
};

const card: React.CSSProperties = {
  padding: 20,
  border: "1px solid #1e2230",
  borderRadius: 12,
  background: "#11141c",
};
const input: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid #2a2f40",
  background: "#0b0d12",
  color: "#e6e8ee",
  boxSizing: "border-box",
  fontSize: 14,
};
const btn: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 8,
  border: "1px solid #2a2f40",
  background: "#1f6feb",
  color: "white",
  cursor: "pointer",
  fontSize: 14,
};

const SAMPLE_CSV =
  "email,first_name,last_name,title,company,industry\n" +
  "jane@acme.com,Jane,Doe,Head of AppSec,Acme,Software\n" +
  "sam@globex.io,Sam,Lee,Director of Product Security,Globex,Fintech\n";

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [total, setTotal] = useState(0);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setError(null);
    try {
      const r = await fetch("/api/prospects");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to load");
      setProspects(j.prospects);
      setTotal(j.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function send(body: BodyInit, headers?: HeadersInit) {
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const r = await fetch("/api/prospects/import", {
        method: "POST",
        body,
        headers,
      });
      const j = await r.json();
      if (!r.ok && !j.summary) throw new Error(j.error || "Import failed");
      setSummary(j.summary);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function importPaste(e: React.FormEvent) {
    e.preventDefault();
    if (!paste.trim()) return;
    send(JSON.stringify({ csv: paste }), { "content-type": "application/json" });
  }

  function importFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    send(fd);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function remove(id: string) {
    try {
      const r = await fetch(`/api/prospects/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j.error || "Delete failed");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const sampleHref =
    "data:text/csv;charset=utf-8," + encodeURIComponent(SAMPLE_CSV);

  return (
    <main style={{ maxWidth: 860, margin: "6vh auto", padding: "0 24px" }}>
      <a href="/" style={{ color: "#6b7280", fontSize: 13, textDecoration: "none" }}>
        ← status
      </a>
      <h1 style={{ fontSize: 26, margin: "10px 0 4px" }}>Prospects</h1>
      <p style={{ color: "#9aa0ad", marginTop: 0 }}>
        Upload a CSV of people to reach. Emails are validated and de-duplicated
        (in-file and against existing). Columns like email, first/last name,
        title, company, industry are auto-detected; extras are kept.
      </p>

      {error && (
        <div
          style={{
            ...card,
            borderColor: "#5b2230",
            background: "#1a1014",
            color: "#f8b4b4",
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ color: "#9aa0ad", fontSize: 13 }} />
          <button onClick={importFile} style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={busy}>
            {busy ? "Importing…" : "Import file"}
          </button>
          <a href={sampleHref} download="prospects-sample.csv" style={{ color: "#58a6ff", fontSize: 13 }}>
            download sample
          </a>
        </div>
        <form onSubmit={importPaste} style={{ marginTop: 14 }}>
          <textarea
            style={{ ...input, minHeight: 110, resize: "vertical", fontFamily: "monospace", fontSize: 13 }}
            placeholder={"…or paste CSV here\n" + SAMPLE_CSV}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <button type="submit" style={{ ...btn, marginTop: 10, opacity: busy ? 0.6 : 1 }} disabled={busy}>
            Import pasted
          </button>
        </form>
      </div>

      {summary && (
        <div style={{ ...card, marginBottom: 24 }}>
          {summary.error ? (
            <div style={{ color: "#f8b4b4" }}>{summary.error}</div>
          ) : (
            <>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                Imported {summary.inserted} new ·{" "}
                <span style={{ color: "#9aa0ad" }}>
                  {summary.duplicatesExisting} already existed,{" "}
                  {summary.duplicatesInFile} dupes in file, {summary.invalid} invalid
                </span>
              </div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>
                Detected columns:{" "}
                {Object.entries(summary.mapping)
                  .map(([f, h]) => `${f}=“${h}”`)
                  .join(", ") || "none"}
                {summary.unmappedHeaders.length > 0 && (
                  <> · kept extras: {summary.unmappedHeaders.join(", ")}</>
                )}
              </div>
              {summary.sampleInvalid.length > 0 && (
                <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
                  Invalid examples: {summary.sampleInvalid.join(", ")}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <h2 style={{ fontSize: 15, color: "#9aa0ad" }}>In database ({total})</h2>
      {prospects.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No prospects yet.</p>
      ) : (
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "#6b7280", textAlign: "left" }}>
                <th style={th}>Email</th>
                <th style={th}>Name</th>
                <th style={th}>Title</th>
                <th style={th}>Company</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {prospects.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid #1e2230" }}>
                  <td style={td}>{p.email}</td>
                  <td style={td}>{[p.first_name, p.last_name].filter(Boolean).join(" ") || "—"}</td>
                  <td style={td}>{p.title || "—"}</td>
                  <td style={td}>{p.company || "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button
                      onClick={() => remove(p.id)}
                      style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > prospects.length && (
            <div style={{ padding: "10px 14px", color: "#6b7280", fontSize: 12 }}>
              Showing {prospects.length} of {total}.
            </div>
          )}
        </div>
      )}
    </main>
  );
}

const th: React.CSSProperties = { padding: "10px 14px", fontWeight: 500 };
const td: React.CSSProperties = { padding: "10px 14px" };
