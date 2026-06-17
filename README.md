# OutboundEngine

Personalized, multi-step outbound that connects to a sending layer (Instantly /
Lemlist), grounds every email in real product context, and measures its way to
more booked meetings.

This repo is being built in dependency order. **Phase 1 (this commit) is the
deploy skeleton** — a Next.js app that builds clean on Vercel, reports live
database connectivity, and has the migration + env scaffolding later phases
build on. No personalization, sending, or optimization yet.

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Supabase Postgres** via the `postgres` driver (serverless-safe pooled client)
- **Zod** for fail-loud env validation
- Deploy target: **Vercel**

## Local setup

```bash
npm install
cp .env.example .env.local      # then fill in DATABASE_URL + Supabase keys
npm run db:migrate              # applies migrations/*.sql
npm run dev                     # http://localhost:3000
```

Visit `/` for a status page or `/api/health` for JSON. A healthy response:

```json
{ "status": "ok", "database": "ok", "timestamp": "..." }
```

### Where to get the values

- `DATABASE_URL` — Supabase → Project Settings → Database → Connection string →
  **URI**. Use the **pooled (transaction mode)** string for serverless.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase →
  Project Settings → API.

Later-phase keys (LLM, Instantly/Lemlist, Apollo) are listed in `.env.example`
and can stay empty until those phases land.

## Deploy to Vercel

1. **Import the repo** — Vercel → Add New → Project → import `outboundengine`.
   Next.js is auto-detected; no build settings to change.
2. **Attach a database (one click, no copy-paste)** — in the project, open the
   **Storage** tab → **Create Database** → choose **Supabase** (or Neon /
   Vercel Postgres) → connect it to this project. Vercel injects the connection
   env vars (`POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`,
   …) automatically. The app resolves any of these — **you do not need to set
   `DATABASE_URL` by hand.**
   - Prefer to use an existing Supabase project instead? Add `DATABASE_URL`
     manually under Settings → Environment Variables with the pooled
     (transaction mode, port 6543) connection string.
3. **Deploy**, then hit `/api/health` — you want `{ "database": "ok" }`. The
   `/` page shows the same as a status dot.

> The Phase 1 health check only runs `select 1`, so it goes green as soon as a
> connection string is present — migrations are not required for the deploy to
> be healthy. Run `npm run db:migrate` (locally, against the same DB) when a
> later phase needs the tables.

## Security

- No secret ever belongs in git. `.gitignore` blocks `.env*` (except
  `.env.example`) and anything matching `*secret*`, `*token*`, `*credentials*`,
  `*.key`, `*.pem`.
- Configure real credentials only as Vercel env vars or local `.env.local`.

## Roadmap

| Phase | Scope |
| ----- | ----- |
| 1 ✅ | Deploy skeleton: app, DB layer, migrations, health check, env scaffold |
| 2 | Product/context ingestion (uploads → retrievable store) |
| 3 | Prospect ingestion (CSV → validated, deduped `prospects`) |
| 4 | Personalization & multi-step sequence generation (+ review queue) |
| 5 | Sending integration (Instantly/Lemlist, webhooks, reply classification) |
| 6 | A/B testing & optimization loop |
| 7 | Dashboard, budget ledger, deliverability + compliance hardening |
| 8 | Apollo automation (live sourcing → scoring → queue) |
