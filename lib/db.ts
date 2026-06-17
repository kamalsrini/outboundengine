import postgres from "postgres";
import { env } from "./env";

/**
 * Serverless-safe Postgres client.
 *
 * On Vercel each invocation can spin up a fresh module context, so we
 * memoize the client on `globalThis` to avoid exhausting Supabase's
 * connection pool. Use the *pooled* (transaction mode) connection string
 * from Supabase for `DATABASE_URL`.
 *
 * The client is created lazily on first use — never at module load — so the
 * build (which runs with no env) doesn't try to read DATABASE_URL.
 */
type Sql = ReturnType<typeof postgres>;

declare global {
  // eslint-disable-next-line no-var
  var __sql: Sql | undefined;
}

function create(): Sql {
  return postgres(env().DATABASE_URL, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // required for Supabase transaction-mode pooling
  });
}

export function getSql(): Sql {
  if (globalThis.__sql) return globalThis.__sql;
  const client = create();
  if (env().NODE_ENV !== "production") globalThis.__sql = client;
  return client;
}

/** Lightweight connectivity probe used by /api/health and the home page. */
export async function pingDatabase(): Promise<{ ok: boolean; error?: string }> {
  try {
    const sql = getSql();
    await sql`select 1`;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
