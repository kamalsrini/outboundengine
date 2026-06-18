import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CONTEXT_KINDS,
  createDocument,
  listDocuments,
  type ContextKind,
} from "@/lib/context/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 200_000;

const jsonSchema = z.object({
  title: z.string().trim().min(1).max(200),
  kind: z.enum(CONTEXT_KINDS).default("other"),
  text: z.string().trim().min(1).max(MAX_CHARS),
});

export async function GET() {
  try {
    const documents = await listDocuments();
    return NextResponse.json({ documents });
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let title: string;
    let kind: ContextKind;
    let text: string;
    let sourceType: "paste" | "file" = "paste";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const formTitle = (form.get("title") as string | null)?.trim() ?? "";
      kind = parseKind(form.get("kind"));
      if (file && typeof file !== "string") {
        text = (await file.text()).trim();
        title = formTitle || file.name;
        sourceType = "file";
      } else {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      if (!text) {
        return NextResponse.json({ error: "Uploaded file is empty" }, { status: 400 });
      }
      if (text.length > MAX_CHARS) {
        return NextResponse.json(
          { error: `File too large (max ${MAX_CHARS} chars)` },
          { status: 400 },
        );
      }
    } else {
      const parsed = jsonSchema.safeParse(await req.json());
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues.map((i) => i.message).join("; ") },
          { status: 400 },
        );
      }
      title = parsed.data.title;
      kind = parsed.data.kind;
      text = parsed.data.text;
    }

    const doc = await createDocument({ title, kind, sourceType, rawText: text });
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 });
  }
}

function parseKind(value: FormDataEntryValue | null): ContextKind {
  const v = typeof value === "string" ? value : "";
  return (CONTEXT_KINDS as readonly string[]).includes(v)
    ? (v as ContextKind)
    : "other";
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
