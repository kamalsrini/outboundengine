import postgres from "postgres";
import { SCHEMA_SQL } from "../lib/schema";

/**
 * Applies the schema to the target database. The app also self-migrates at
 * runtime (see lib/schema.ts → ensureSchema), so this script is mainly for
 * local dev or CI. All DDL is idempotent.
 *
 * Resolves the connection string from the same env names Vercel's database
 * integrations inject, preferring a non-pooling URL for DDL.
 *
 * Usage: npm run db:migrate
 */
const CONNECTION_ENV_KEYS = [
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
];

function resolveConnectionString(): string | undefined {
  for (const key of CONNECTION_ENV_KEYS) {
    const v = process.env[key];
    if (v && v.trim().length > 0) return v;
  }
  return undefined;
}

const connectionString = resolveConnectionString();
if (!connectionString) {
  console.error(
    `No Postgres connection string found. Set one of: ${CONNECTION_ENV_KEYS.join(
      ", ",
    )}.`,
  );
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1, prepare: false });

async function main() {
  console.log("Applying schema ...");
  await sql.unsafe(SCHEMA_SQL);
  console.log("Schema is up to date.");
  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
