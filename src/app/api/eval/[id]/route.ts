import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { candidateSubmissions, jobProfiles } from "@/lib/schema";
import { runEvaluation } from "@/lib/evaluation";

/** The employer is looking at a pending report: run its evaluation now (the request stays open while the AI works) */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const db = await getDb();
  const [row] = await db.select({ s: candidateSubmissions, j: jobProfiles }).from(candidateSubmissions).innerJoin(jobProfiles, eq(jobProfiles.id, candidateSubmissions.jobProfileId)).where(eq(candidateSubmissions.id, id)).limit(1);
  if (!row || row.j.userId !== user.id) return NextResponse.json({ ok: false }, { status: 404 });
  const result = row.s.evalStatus === "PENDING" || (row.s.evalStatus === "FAILED" && row.s.evalAttempts < 3) ? await runEvaluation(id) : "skipped";
  return NextResponse.json({ ok: true, result });
}
