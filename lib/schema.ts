import { getSql } from "./db";

/**
 * Single source of truth for the database schema.
 *
 * All statements are idempotent (`create ... if not exists`) so the app can
 * self-provision the connected database at runtime — important on Vercel,
 * where running a separate migration step against the managed DB is awkward.
 * `ensureSchema()` applies this under a transaction-level advisory lock so
 * concurrent cold starts can't race each other.
 *
 * `gen_random_uuid()` is core Postgres (>= 13) so we avoid extension-privilege
 * issues across Supabase / Neon / Vercel Postgres.
 */
export const SCHEMA_SQL = /* sql */ `
create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists prospects (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  first_name  text,
  last_name   text,
  title       text,
  company     text,
  industry    text,
  source      text not null default 'csv',
  status      text not null default 'new',
  raw         jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
-- Idempotent additions for databases created before these columns existed.
alter table prospects add column if not exists source text not null default 'csv';
alter table prospects add column if not exists status text not null default 'new';
alter table prospects add column if not exists raw jsonb not null default '{}'::jsonb;
create index if not exists prospects_status_idx on prospects (status);

create table if not exists context_documents (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references products(id) on delete cascade,
  title        text not null,
  kind         text not null default 'other',
  source_type  text not null default 'paste',
  raw_text     text not null,
  char_count   integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists context_documents_product_idx
  on context_documents (product_id);

create table if not exists context_chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references context_documents(id) on delete cascade,
  product_id   uuid not null references products(id) on delete cascade,
  chunk_index  integer not null,
  content      text not null,
  tsv          tsvector generated always as (to_tsvector('english', content)) stored,
  created_at   timestamptz not null default now()
);
create index if not exists context_chunks_document_idx
  on context_chunks (document_id);
create index if not exists context_chunks_tsv_idx
  on context_chunks using gin (tsv);

create table if not exists sequences (
  id          uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  product_id  uuid references products(id) on delete set null,
  status      text not null default 'draft', -- draft | approved | rejected
  model       text,
  created_at  timestamptz not null default now(),
  approved_at timestamptz
);
create index if not exists sequences_prospect_idx on sequences (prospect_id);
create index if not exists sequences_status_idx on sequences (status);

create table if not exists sequence_steps (
  id          uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references sequences(id) on delete cascade,
  step_number integer not null,
  day_offset  integer not null default 0,
  subject     text not null,
  body        text not null,
  purpose     text,
  cta         text,
  created_at  timestamptz not null default now()
);
create index if not exists sequence_steps_sequence_idx
  on sequence_steps (sequence_id);
`;

// Arbitrary fixed key for the advisory lock guarding schema application.
const SCHEMA_LOCK_KEY = 728193;

let ensured: Promise<void> | null = null;

/**
 * Ensure the schema exists. Memoized per warm instance; safe to call before
 * any query. Applies all DDL inside one transaction holding an advisory lock.
 */
export function ensureSchema(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      const sql = getSql();
      await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(${SCHEMA_LOCK_KEY})`;
        await tx.unsafe(SCHEMA_SQL);
      });
    })().catch((err) => {
      // Reset so a later call can retry rather than caching the failure.
      ensured = null;
      throw err;
    });
  }
  return ensured;
}
