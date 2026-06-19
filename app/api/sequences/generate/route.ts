import { NextResponse } from "next/server";
import {
  generateForProspect,
  getSequence,
  nextProspectWithoutSequence,
} from "@/lib/sequences/store";

export const runtime = "nodejs";
export const maxDuration = 60; // generation can take a while; allow headroom
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    let prospectId: string | undefined;
    try {
      const body = await req.json();
      prospectId = typeof body?.prospectId === "string" ? body.prospectId : undefined;
    } catch {
      // empty body is fine — fall back to next pending prospect
    }

    if (!prospectId) {
      prospectId = (await nextProspectWithoutSequence()) ?? undefined;
      if (!prospectId) {
        return NextResponse.json(
          { error: "No prospects without a sequence. Add prospects first." },
          { status: 400 },
        );
      }
    }

    const sequenceId = await generateForProspect(prospectId);
    const sequence = await getSequence(sequenceId);
    return NextResponse.json({ sequence }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
