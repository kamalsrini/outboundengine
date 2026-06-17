-- 0001_init.sql — baseline schema for OutboundEngine.
-- Idempotent: safe to run repeatedly.

create extension if not exists "uuid-ossp";

-- Tracks which migrations have been applied.
create table if not exists schema_migrations (
  version     text primary key,
  applied_at  timestamptz not null default now()
);

-- Minimal baseline tables so downstream phases have something to build on.
-- Product/context ingestion (Phase 2) and prospects (Phase 3) extend these.

create table if not exists products (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists prospects (
  id          uuid primary key default uuid_generate_v4(),
  email       text not null,
  first_name  text,
  last_name   text,
  title       text,
  company     text,
  industry    text,
  created_at  timestamptz not null default now(),
  unique (email)
);
