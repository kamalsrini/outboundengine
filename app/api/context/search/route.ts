import { NextResponse } from "next/server";
import { searchContext } from "@/lib/context/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? "";
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit")) || 8, 1),
      25,
    );
    const hits = await searchContext(q, limit);
    return NextResponse.json({ query: q, hits });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
