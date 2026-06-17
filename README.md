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

1. Import the repo in Vercel (New Project → import `outboundengine`). Next.js is
   auto-detected.
2. Add the environment variables from `.env.example` under
   **Settings → Environment Variables** (at minimum `DATABASE_URL`).
3. Deploy, then hit `/api/health` — you want `"database": "ok"`.

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
