import { NextResponse } from "next/server";
import {
  deleteSequence,
  getSequence,
  setSequenceStatus,
  updateStep,
} from "@/lib/sequences/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const sequence = await getSequence(params.id);
    if (!sequence) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ sequence });
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json();

    if (Array.isArray(body?.steps)) {
      for (const s of body.steps) {
        if (s && typeof s.id === "string") {
          await updateStep(s.id, {
            subject: s.subject,
            body: s.body,
            cta: s.cta,
            day_offset: typeof s.day_offset === "number" ? s.day_offset : undefined,
          });
        }
      }
    }

    if (typeof body?.status === "string") {
      if (!["draft", "approved", "rejected"].includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      await setSequenceStatus(params.id, body.status);
    }

    const sequence = await getSequence(params.id);
    if (!sequence) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ sequence });
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const ok = await deleteSequence(params.id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 500 });
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
