import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * Per-prospect sequence generation via Claude.
 *
 * Model defaults to Claude Opus 4.8 (the most capable Claude model). Override
 * with OUTBOUND_MODEL to trade quality for cost (e.g. claude-sonnet-4-6,
 * claude-haiku-4-5) — that's a deliberate choice, not a silent default.
 *
 * Structured output is forced via a single tool so every call returns a
 * validated sequence object; no free-text parsing, no thinking-mode latency.
 */
export const OUTBOUND_MODEL = process.env.OUTBOUND_MODEL || "claude-opus-4-8";

const StepSchema = z.object({
  day_offset: z.number().int(),
  subject: z.string().min(1),
  body: z.string().min(1),
  purpose: z.string().default(""),
  cta: z.string().default(""),
});
const SequenceSchema = z.object({ steps: z.array(StepSchema).min(1) });
export type GeneratedStep = z.infer<typeof StepSchema>;

export type ProspectInput = {
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  company: string | null;
  industry: string | null;
};

const TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    steps: {
      type: "array",
      description: "Exactly 4 emails, in send order.",
      items: {
        type: "object",
        properties: {
          day_offset: {
            type: "integer",
            description: "Days after the first email. Touch 1 = 0.",
          },
          subject: { type: "string", description: "Subject line, under 7 words." },
          body: {
            type: "string",
            description: "Plain-text email body, 50-120 words. No markdown.",
          },
          purpose: { type: "string", description: "What this touch accomplishes." },
          cta: { type: "string", description: "The call to action in this email." },
        },
        required: ["day_offset", "subject", "body", "purpose", "cta"],
      },
    },
  },
  required: ["steps"],
};

const SYSTEM = `You write cold outbound email sequences for UnitOne — a security platform that GENERATES and VALIDATES fixes for software vulnerabilities at machine speed, so teams stop drowning in findings they can't remediate fast enough.

You are writing to one prospect (details below). Most are Application Security or Platform Engineering leaders at mid-market and scaleup companies. The wedge: they already have detection tools producing validated findings, but fixing is still manual and slow — UnitOne generates the fix and validates it.

Write a 4-touch email sequence. Rules:
- Exactly 4 emails, roughly day 0, 3, 7, and 12 (set day_offset; first email = 0).
- Touch 1 is a relevance hook tied to their role and world — NOT a product pitch.
- Each body 50-120 words, plain text, no markdown, no images. No "I hope this finds you well", no filler openers.
- Subject lines under 7 words, specific or curiosity-driven; lowercase is fine.
- One clear CTA per email, and vary them: a 15-minute call, then a relevant resource/proof point, then a short graceful breakup on the last touch.
- Ground EVERY claim in the provided product context. Use only capabilities and proof points that appear there.
- NEVER invent statistics or company-specific numbers (no "save you $2M", no made-up percentages). You may cite defensible numbers only if they appear verbatim in the context.
- Personalize with the prospect's title, company, and industry where natural — do not stuff fields.
- Sign as "the UnitOne team" (no fabricated personal name).
Return the sequence via the submit_sequence tool only.`;

export async function generateSequence(args: {
  grounding: string;
  prospect: ProspectInput;
}): Promise<{ steps: GeneratedStep[]; model: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it in Vercel → Settings → Environment Variables (or .env.local) to enable generation.",
    );
  }

  const client = new Anthropic();
  const name = [args.prospect.first_name, args.prospect.last_name]
    .filter(Boolean)
    .join(" ");

  const userText = `Prospect:
- Name: ${name || "(unknown)"}
- Title: ${args.prospect.title || "(unknown)"}
- Company: ${args.prospect.company || "(unknown)"}
- Industry: ${args.prospect.industry || "(unknown)"}

Product context (ground all claims here; do not invent metrics):
"""
${args.grounding || "(no product context has been added yet — keep claims generic and defensible)"}
"""

Write the 4-touch sequence now.`;

  const message = await client.messages.create({
    model: OUTBOUND_MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    tools: [
      {
        name: "submit_sequence",
        description: "Submit the finished 4-touch email sequence.",
        input_schema: TOOL_INPUT_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: "submit_sequence" },
    messages: [{ role: "user", content: userText }],
  });

  const block = message.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("Model did not return a sequence.");
  }

  const parsed = SequenceSchema.parse(block.input);
  return { steps: parsed.steps, model: OUTBOUND_MODEL };
}
