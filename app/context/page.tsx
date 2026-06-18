"use client";

import { useEffect, useState } from "react";

const KINDS = [
  "positioning",
  "case_study",
  "pricing",
  "icp",
  "proof_point",
  "messaging",
  "other",
] as const;

type Doc = {
  id: string;
  title: string;
  kind: string;
  source_type: string;
  char_count: number;
  chunk_count: number;
  created_at: string;
};

type Hit = {
  id: string;
  title: string;
  kind: string;
  content: string;
  rank: number;
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

export default function ContextPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<string>("positioning");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);

  async function load() {
    setError(null);
    try {
      const r = await fetch("/api/context/documents");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to load");
      setDocs(j.documents);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/context/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, kind, text }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to add");
      setTitle("");
      setText("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      const r = await fetch(`/api/context/documents/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j.error || "Failed to delete");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await fetch(`/api/context/search?q=${encodeURIComponent(query)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Search failed");
      setHits(j.hits);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "6vh auto", padding: "0 24px" }}>
      <a href="/" style={{ color: "#6b7280", fontSize: 13, textDecoration: "none" }}>
        ← status
      </a>
      <h1 style={{ fontSize: 26, margin: "10px 0 4px" }}>Product context</h1>
      <p style={{ color: "#9aa0ad", marginTop: 0 }}>
        The knowledge the engine grounds every email in. Add positioning, proof
        points, case studies, pricing, ICP. Phase 4 retrieves from here.
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

      <form onSubmit={add} style={{ ...card, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <input
            style={{ ...input, flex: 2 }}
            placeholder="Title (e.g. UnitOne positioning)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <select
            style={{ ...input, flex: 1 }}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <textarea
          style={{ ...input, minHeight: 140, resize: "vertical", marginBottom: 10 }}
          placeholder="Paste the content…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />
        <button type="submit" style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={busy}>
          {busy ? "Adding…" : "Add context"}
        </button>
      </form>

      <h2 style={{ fontSize: 15, color: "#9aa0ad" }}>
        Ingested ({docs.length})
      </h2>
      {docs.length === 0 ? (
        <p style={{ color: "#6b7280" }}>Nothing yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {docs.map((d) => (
            <li
              key={d.id}
              style={{
                ...card,
                marginBottom: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{d.title}</div>
                <div style={{ color: "#6b7280", fontSize: 12, marginTop: 3 }}>
                  {d.kind} · {d.chunk_count} chunks · {d.char_count} chars
                </div>
              </div>
              <button
                onClick={() => remove(d.id)}
                style={{
                  ...btn,
                  background: "transparent",
                  color: "#f87171",
                  borderColor: "#3a2530",
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2 style={{ fontSize: 15, color: "#9aa0ad", marginTop: 32 }}>
        Test retrieval
      </h2>
      <form onSubmit={search} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <input
          style={input}
          placeholder="e.g. validated fix generation for AppSec"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" style={btn}>
          Search
        </button>
      </form>
      {hits && hits.length === 0 && (
        <p style={{ color: "#6b7280" }}>No matches.</p>
      )}
      {hits?.map((h) => (
        <div key={h.id} style={{ ...card, marginBottom: 10 }}>
          <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 6 }}>
            {h.title} · {h.kind} · score {h.rank.toFixed(3)}
          </div>
          <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{h.content}</div>
        </div>
      ))}
    </main>
  );
}
