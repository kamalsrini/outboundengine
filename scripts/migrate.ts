import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

/**
 * Idempotent migration runner.
 * Applies every *.sql in /migrations (lexical order) that hasn't been
 * recorded in schema_migrations, each in its own transaction.
 *
 * Usage: npm run db:migrate
 *
 * Prefers a NON-pooling connection for DDL (transaction pooling can choke
 * on some DDL). Resolves from the same env names Vercel's database
 * integrations inject, so this works both locally and against a Vercel DB.
 */
const CONNECTION_ENV_KEYS = [
  "POSTGRES_URL_NON_POOLING", // direct — best for DDL
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "migrations");

const sql = postgres(connectionString, { max: 1, prepare: false });

async function ensureRegistry() {
  await sql`
    create table if not exists schema_migrations (
      version    text primary key,
      applied_at timestamptz not null default now()
    )
  `;
}

async function applied(): Promise<Set<string>> {
  const rows = await sql<{ version: string }[]>`select version from schema_migrations`;
  return new Set(rows.map((r) => r.version));
}

async function main() {
  await ensureRegistry();
  const done = await applied();

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let ran = 0;
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (done.has(version)) continue;

    const contents = await readFile(join(migrationsDir, file), "utf8");
    console.log(`Applying ${file} ...`);
    await sql.begin(async (tx) => {
      await tx.unsafe(contents);
      await tx`insert into schema_migrations (version) values (${version})`;
    });
    ran++;
  }

  console.log(ran === 0 ? "Already up to date." : `Applied ${ran} migration(s).`);
  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
