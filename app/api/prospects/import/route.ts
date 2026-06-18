import { NextResponse } from "next/server";
import { importProspects } from "@/lib/prospects/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 5_000_000; // ~5MB of CSV text

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let csv: string;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!file || typeof file === "string") {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      csv = await file.text();
    } else {
      const body = await req.json();
      csv = typeof body?.csv === "string" ? body.csv : "";
    }

    if (!csv.trim()) {
      return NextResponse.json({ error: "Empty CSV" }, { status: 400 });
    }
    if (csv.length > MAX_CHARS) {
      return NextResponse.json(
        { error: `CSV too large (max ${MAX_CHARS} chars)` },
        { status: 400 },
      );
    }

    const summary = await importProspects(csv);
    const status = summary.error ? 400 : 200;
    return NextResponse.json({ summary }, { status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
