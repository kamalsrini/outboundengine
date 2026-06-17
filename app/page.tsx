import { pingDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const db = await pingDatabase();

  return (
    <main style={{ maxWidth: 640, margin: "10vh auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>OutboundEngine</h1>
      <p style={{ color: "#9aa0ad", marginTop: 0 }}>
        Phase 1 — deploy skeleton. Personalization, sending, and optimization
        land in later phases.
      </p>

      <section
        style={{
          marginTop: 32,
          padding: 20,
          border: "1px solid #1e2230",
          borderRadius: 12,
          background: "#11141c",
        }}
      >
        <h2 style={{ fontSize: 15, margin: 0, color: "#9aa0ad" }}>System status</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
          <li>
            <StatusDot ok={true} /> Web app — running
          </li>
          <li style={{ marginTop: 8 }}>
            <StatusDot ok={db.ok} /> Database —{" "}
            {db.ok ? "connected" : `not connected${db.error ? ` (${db.error})` : ""}`}
          </li>
        </ul>
      </section>

      <p style={{ marginTop: 24, fontSize: 13, color: "#6b7280" }}>
        Health JSON at <code>/api/health</code>.
      </p>
    </main>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 9,
        height: 9,
        borderRadius: "50%",
        marginRight: 10,
        background: ok ? "#34d399" : "#f87171",
      }}
    />
  );
}
