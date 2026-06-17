import { z } from "zod";

/**
 * Validated environment access. Fails loud at startup if a required
 * variable is missing or malformed, rather than failing silently at
 * request time.
 *
 * The Postgres connection string is resolved from several possible env
 * names so the app works with ZERO manual configuration when you attach a
 * database through Vercel's Storage / Marketplace integrations (Supabase,
 * Neon, Vercel Postgres) — those inject `POSTGRES_URL` & friends, not
 * `DATABASE_URL`. Set `DATABASE_URL` yourself only for local dev or a
 * non-Vercel host.
 */
const CONNECTION_ENV_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL", // Vercel Postgres / Supabase / Neon integration (pooled)
  "POSTGRES_PRISMA_URL", // pooled, with pgbouncer params
  "POSTGRES_URL_NON_POOLING", // direct connection
] as const;

function resolveConnectionString(): string | undefined {
  for (const key of CONNECTION_ENV_KEYS) {
    const v = process.env[key];
    if (v && v.trim().length > 0) return v;
  }
  return undefined;
}

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z
    .string()
    .min(
      1,
      `No Postgres connection string found. Set one of: ${CONNECTION_ENV_KEYS.join(
        ", ",
      )}. On Vercel, attach a database via Storage → Create Database and these are injected automatically.`,
    ),
});

let cached: z.infer<typeof schema> | null = null;

export function env(): z.infer<typeof schema> {
  if (cached) return cached;

  const parsed = schema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: resolveConnectionString(),
  });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}
