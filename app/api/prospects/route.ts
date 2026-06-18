import { NextResponse } from "next/server";
import { countProspects, listProspects } from "@/lib/prospects/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit")) || 50, 1),
      500,
    );
    const [prospects, total] = await Promise.all([
      listProspects(limit),
      countProspects(),
    ]);
    return NextResponse.json({ prospects, total });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
