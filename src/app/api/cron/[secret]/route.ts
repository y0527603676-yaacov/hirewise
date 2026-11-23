import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { processPending } from "@/lib/evaluation";
import { closeStaleAttempts } from "@/lib/candidate";
import { dailyCleanup } from "@/lib/retention";

/** Called by the Worker's scheduler every 5 minutes */
export async function GET(_req: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const expected = (process.env.CRON_SECRET || process.env.PAYMENT_HOOK_SECRET || "").trim();
  const a = Buffer.from(decodeURIComponent(secret || ""));
  const b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ ok: false }, { status: 404 });
  await closeStaleAttempts().catch((e) => console.error("stale", e));
  const evals = await processPending().catch((e) => (console.error("pending", e), []));
  const cleanup = await dailyCleanup().catch((e) => (console.error("cleanup", e), null));
  return NextResponse.json({ ok: true, evals, cleanup });
}
