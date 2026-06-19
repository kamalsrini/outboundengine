"use client";

import { useEffect, useState } from "react";

type Step = {
  id: string;
  step_number: number;
  day_offset: number;
  subject: string;
  body: string;
  purpose: string | null;
  cta: string | null;
};

type Sequence = {
  id: string;
  status: string;
  model: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  company: string | null;
  step_count: number;
  steps?: Step[];
};

const card: React.CSSProperties = {
  padding: 18,
  border: "1px solid #1e2230",
  borderRadius: 12,
  background: "#11141c",
};
const input: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #2a2f40",
  background: "#0b0d12",
  color: "#e6e8ee",
  boxSizing: "border-box",
  fontSize: 13,
};
const btn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #2a2f40",
  background: "#1f6feb",
  color: "white",
  cursor: "pointer",
  fontSize: 13,
};

const statusColor: Record<string, string> = {
  draft: "#9aa0ad",
  approved: "#34d399",
  rejected: "#f87171",
};

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [open, setOpen] = useState<Record<string, Sequence>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const r = await fetch("/api/sequences");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to load");
      setSequences(j.sequences);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/sequences/generate", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Generation failed");
      await load();
      if (j.sequence) {
        setOpen((o) => ({ ...o, [j.sequence.id]: j.sequence }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string) {
    if (open[id]) {
      setOpen((o) => {
        const n = { ...o };
        delete n[id];
        return n;
      });
      return;
    }
    try {
      const r = await fetch(`/api/sequences/${id}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to load sequence");
      setOpen((o) => ({ ...o, [id]: j.sequence }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function editStep(seqId: string, stepId: string, field: keyof Step, value: string) {
    setOpen((o) => {
      const seq = o[seqId];
      if (!seq?.steps) return o;
      const steps = seq.steps.map((s) =>
        s.id === stepId
          ? { ...s, [field]: field === "day_offset" ? Number(value) : value }
          : s,
      );
      return { ...o, [seqId]: { ...seq, steps } };
    });
  }

  async function save(seqId: string, status?: string) {
    setError(null);
    try {
      const seq = open[seqId];
      const r = await fetch(`/api/sequences/${seqId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ steps: seq?.steps, status }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Save failed");
      setOpen((o) => ({ ...o, [seqId]: j.sequence }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main style={{ maxWidth: 820, margin: "6vh auto", padding: "0 24px" }}>
      <a href="/" style={{ color: "#6b7280", fontSize: 13, textDecoration: "none" }}>
        ← status
      </a>
      <h1 style={{ fontSize: 26, margin: "10px 0 4px" }}>Sequences</h1>
      <p style={{ color: "#9aa0ad", marginTop: 0 }}>
        Per-prospect 4-touch drafts grounded in your product context. Review,
        edit, and approve before anything is sent.
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

      <button
        onClick={generate}
        disabled={busy}
        style={{ ...btn, opacity: busy ? 0.6 : 1, marginBottom: 20 }}
      >
        {busy ? "Generating…" : "Generate next prospect"}
      </button>

      {sequences.length === 0 ? (
        <p style={{ color: "#6b7280" }}>
          No sequences yet. Add prospects, then generate.
        </p>
      ) : (
        sequences.map((s) => {
          const detail = open[s.id];
          const name = [s.first_name, s.last_name].filter(Boolean).join(" ");
          return (
            <div key={s.id} style={{ ...card, marginBottom: 12 }}>
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                onClick={() => toggle(s.id)}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {name || s.email}{" "}
                    <span style={{ color: "#6b7280", fontWeight: 400 }}>
                      · {[s.title, s.company].filter(Boolean).join(" @ ")}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
                    {s.step_count} touches · {s.model ?? "—"}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: statusColor[s.status] ?? "#9aa0ad",
                    border: `1px solid ${statusColor[s.status] ?? "#2a2f40"}`,
                    borderRadius: 20,
                    padding: "2px 10px",
                  }}
                >
                  {s.status}
                </span>
              </div>

              {detail?.steps && (
                <div style={{ marginTop: 14 }}>
                  {detail.steps.map((st) => (
                    <div
                      key={st.id}
                      style={{ borderTop: "1px solid #1e2230", paddingTop: 12, marginTop: 12 }}
                    >
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: "#6b7280", minWidth: 64 }}>
                          Touch {st.step_number}
                        </span>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>day</span>
                        <input
                          style={{ ...input, width: 56 }}
                          value={st.day_offset}
                          onChange={(e) => editStep(s.id, st.id, "day_offset", e.target.value)}
                        />
                        <span style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>
                          {st.purpose}
                        </span>
                      </div>
                      <input
                        style={{ ...input, marginBottom: 6, fontWeight: 600 }}
                        value={st.subject}
                        onChange={(e) => editStep(s.id, st.id, "subject", e.target.value)}
                      />
                      <textarea
                        style={{ ...input, minHeight: 96, resize: "vertical", marginBottom: 6 }}
                        value={st.body}
                        onChange={(e) => editStep(s.id, st.id, "body", e.target.value)}
                      />
                      <input
                        style={input}
                        value={st.cta ?? ""}
                        placeholder="CTA"
                        onChange={(e) => editStep(s.id, st.id, "cta", e.target.value)}
                      />
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                    <button style={btn} onClick={() => save(s.id)}>
                      Save edits
                    </button>
                    <button
                      style={{ ...btn, background: "#1a7f4b" }}
                      onClick={() => save(s.id, "approved")}
                    >
                      Approve
                    </button>
                    <button
                      style={{ ...btn, background: "transparent", color: "#f87171", borderColor: "#3a2530" }}
                      onClick={() => save(s.id, "rejected")}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </main>
  );
}
