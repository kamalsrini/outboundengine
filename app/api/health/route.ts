import { NextResponse } from "next/server";
import { pingDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await pingDatabase();
  const body = {
    status: db.ok ? "ok" : "degraded",
    database: db.ok ? "ok" : "error",
    ...(db.error ? { detail: db.error } : {}),
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(body, { status: db.ok ? 200 : 503 });
}
