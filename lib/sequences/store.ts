import { getSql } from "../db";
import { ensureSchema } from "../schema";
import { searchContext } from "../context/store";
import { generateSequence, type ProspectInput } from "../llm/generate";

export type SequenceStep = {
  id: string;
  step_number: number;
  day_offset: number;
  subject: string;
  body: string;
  purpose: string | null;
  cta: string | null;
};

export type SequenceSummary = {
  id: string;
  status: string;
  model: string | null;
  created_at: string;
  prospect_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  company: string | null;
  step_count: number;
};

export type SequenceDetail = SequenceSummary & { steps: SequenceStep[] };

type ProspectRow = ProspectInput & { id: string };

async function buildGrounding(p: ProspectInput): Promise<string> {
  const query = [p.title, p.industry, p.company, "security remediation validated fixes machine speed"]
    .filter(Boolean)
    .join(" ");
  const hits = await searchContext(query, 8);
  let text = hits.map((h) => `# ${h.title} (${h.kind})\n${h.content}`).join("\n\n");
  if (text.length > 8000) text = text.slice(0, 8000);
  return text;
}

/** Generate a sequence for one prospect and persist it as a draft. */
export async function generateForProspect(prospectId: string): Promise<string> {
  await ensureSchema();
  const sql = getSql();

  const [prospect] = await sql<ProspectRow[]>`
    select id, first_name, last_name, title, company, industry
    from prospects where id = ${prospectId}
  `;
  if (!prospect) throw new Error("Prospect not found");

  const grounding = await buildGrounding(prospect);
  const { steps, model } = await generateSequence({ grounding, prospect });

  return sql.begin(async (tx) => {
    const [product] = await tx<{ id: string }[]>`select id from products limit 1`;
    const [seq] = await tx<{ id: string }[]>`
      insert into sequences (prospect_id, product_id, status, model)
      values (${prospectId}, ${product?.id ?? null}, 'draft', ${model})
      returning id
    `;
    const rows = steps.map((s, i) => ({
      sequence_id: seq.id,
      step_number: i + 1,
      day_offset: Number.isFinite(s.day_offset) ? s.day_offset : i * 3,
      subject: s.subject,
      body: s.body,
      purpose: s.purpose,
      cta: s.cta,
    }));
    await tx`insert into sequence_steps ${tx(
      rows,
      "sequence_id",
      "step_number",
      "day_offset",
      "subject",
      "body",
      "purpose",
      "cta",
    )}`;
    return seq.id;
  });
}

/** A prospect with no sequence yet, oldest first. */
export async function nextProspectWithoutSequence(): Promise<string | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<{ id: string }[]>`
    select p.id from prospects p
    left join sequences s on s.prospect_id = p.id
    where s.id is null
    order by p.created_at asc
    limit 1
  `;
  return rows[0]?.id ?? null;
}

export async function listSequences(status?: string): Promise<SequenceSummary[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = status
    ? await sql<SequenceSummary[]>`
        select s.id, s.status, s.model, s.created_at, s.prospect_id,
               p.email, p.first_name, p.last_name, p.title, p.company,
               count(st.id)::int as step_count
        from sequences s
        join prospects p on p.id = s.prospect_id
        left join sequence_steps st on st.sequence_id = s.id
        where s.status = ${status}
        group by s.id, p.email, p.first_name, p.last_name, p.title, p.company
        order by s.created_at desc`
    : await sql<SequenceSummary[]>`
        select s.id, s.status, s.model, s.created_at, s.prospect_id,
               p.email, p.first_name, p.last_name, p.title, p.company,
               count(st.id)::int as step_count
        from sequences s
        join prospects p on p.id = s.prospect_id
        left join sequence_steps st on st.sequence_id = s.id
        group by s.id, p.email, p.first_name, p.last_name, p.title, p.company
        order by s.created_at desc`;
  return rows;
}

export async function getSequence(id: string): Promise<SequenceDetail | null> {
  await ensureSchema();
  const sql = getSql();
  const [seq] = await sql<SequenceSummary[]>`
    select s.id, s.status, s.model, s.created_at, s.prospect_id,
           p.email, p.first_name, p.last_name, p.title, p.company,
           0 as step_count
    from sequences s
    join prospects p on p.id = s.prospect_id
    where s.id = ${id}
  `;
  if (!seq) return null;
  const steps = await sql<SequenceStep[]>`
    select id, step_number, day_offset, subject, body, purpose, cta
    from sequence_steps where sequence_id = ${id}
    order by step_number asc
  `;
  return { ...seq, step_count: steps.length, steps };
}

export async function setSequenceStatus(
  id: string,
  status: "draft" | "approved" | "rejected",
): Promise<boolean> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    update sequences
    set status = ${status},
        approved_at = ${status === "approved" ? sql`now()` : null}
    where id = ${id}
    returning id
  `;
  return rows.length > 0;
}

export async function updateStep(
  stepId: string,
  fields: Partial<Pick<SequenceStep, "subject" | "body" | "cta" | "day_offset">>,
): Promise<boolean> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    update sequence_steps set
      subject = coalesce(${fields.subject ?? null}, subject),
      body = coalesce(${fields.body ?? null}, body),
      cta = coalesce(${fields.cta ?? null}, cta),
      day_offset = coalesce(${fields.day_offset ?? null}, day_offset)
    where id = ${stepId}
    returning id
  `;
  return rows.length > 0;
}

export async function deleteSequence(id: string): Promise<boolean> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`delete from sequences where id = ${id} returning id`;
  return rows.length > 0;
}
