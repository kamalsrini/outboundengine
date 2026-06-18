import { getSql } from "../db";
import { ensureSchema } from "../schema";
import { chunkText } from "./chunk";

export const CONTEXT_KINDS = [
  "positioning",
  "case_study",
  "pricing",
  "icp",
  "proof_point",
  "messaging",
  "other",
] as const;

export type ContextKind = (typeof CONTEXT_KINDS)[number];

export type ContextDocument = {
  id: string;
  product_id: string;
  title: string;
  kind: ContextKind;
  source_type: string;
  char_count: number;
  chunk_count: number;
  created_at: string;
};

export type ContextHit = {
  id: string;
  document_id: string;
  title: string;
  kind: ContextKind;
  content: string;
  rank: number;
};

const DEFAULT_PRODUCT_NAME = "UnitOne";

async function getOrCreateDefaultProduct(): Promise<{ id: string }> {
  const sql = getSql();
  const rows = await sql<{ id: string }[]>`
    insert into products (name) values (${DEFAULT_PRODUCT_NAME})
    on conflict (name) do update set name = excluded.name
    returning id
  `;
  return rows[0];
}

export async function createDocument(input: {
  title: string;
  kind: ContextKind;
  sourceType: "paste" | "file";
  rawText: string;
}): Promise<ContextDocument> {
  await ensureSchema();
  const sql = getSql();
  const product = await getOrCreateDefaultProduct();
  const chunks = chunkText(input.rawText);

  return sql.begin(async (tx) => {
    const [doc] = await tx<ContextDocument[]>`
      insert into context_documents
        (product_id, title, kind, source_type, raw_text, char_count)
      values
        (${product.id}, ${input.title}, ${input.kind}, ${input.sourceType},
         ${input.rawText}, ${input.rawText.length})
      returning id, product_id, title, kind, source_type, char_count, created_at
    `;

    if (chunks.length > 0) {
      const rows = chunks.map((content, i) => ({
        document_id: doc.id,
        product_id: product.id,
        chunk_index: i,
        content,
      }));
      await tx`insert into context_chunks ${tx(
        rows,
        "document_id",
        "product_id",
        "chunk_index",
        "content",
      )}`;
    }

    return { ...doc, chunk_count: chunks.length };
  });
}

export async function listDocuments(): Promise<ContextDocument[]> {
  await ensureSchema();
  const sql = getSql();
  return sql<ContextDocument[]>`
    select d.id, d.product_id, d.title, d.kind, d.source_type, d.char_count,
           d.created_at, count(c.id)::int as chunk_count
    from context_documents d
    left join context_chunks c on c.document_id = d.id
    group by d.id
    order by d.created_at desc
  `;
}

export async function deleteDocument(id: string): Promise<boolean> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`delete from context_documents where id = ${id} returning id`;
  return rows.length > 0;
}

/**
 * Full-text retrieval over context chunks. This is the seam Phase 4 calls to
 * ground per-prospect personalization; a vector retriever can replace the
 * implementation without changing callers.
 */
export async function searchContext(
  query: string,
  limit = 8,
): Promise<ContextHit[]> {
  await ensureSchema();
  const q = query.trim();
  if (!q) return [];
  const sql = getSql();
  return sql<ContextHit[]>`
    select c.id, c.document_id, d.title, d.kind, c.content,
           ts_rank(c.tsv, websearch_to_tsquery('english', ${q})) as rank
    from context_chunks c
    join context_documents d on d.id = c.document_id
    where c.tsv @@ websearch_to_tsquery('english', ${q})
    order by rank desc
    limit ${limit}
  `;
}
