import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { jobProfiles } from "@/lib/schema";
import { accountView, findAccount, listJobs, partnerFrom, reportView, signInLink, upsertAccount } from "@/lib/partner";
import { createJobPending, retryGeneration } from "@/lib/jobs";
import { retryEvaluation, unlockSubmission } from "@/lib/evaluation";

/**
 * Partner API v1 (see src/lib/partner.ts). All bodies and answers are JSON; every call names the business by externalId.
 *   GET  account?externalId=            POST account {externalId, company, contactEmail, locale?, jurisdiction?}
 *   GET  jobs?externalId=               POST jobs {externalId, roleKey, title, responsibilities, requiredSkills, ..., notes?}
 *   POST jobs/<id>/status {status}      POST jobs/<id>/retry
 *   GET  reports/<subId>?externalId=    POST reports/<subId>/unlock     POST reports/<subId>/retry
 *   POST signin {externalId, next}      → one-time link into the full Hirewise account
 */
const j = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

async function handle(req: Request, path: string[], method: "GET" | "POST") {
  const partner = partnerFrom(req);
  if (!partner) return j({ error: "unauthorized" }, 401);
  const url = new URL(req.url);
  let body: Record<string, unknown> = {};
  if (method === "POST") {
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
  }
  const externalId = method === "GET" ? url.searchParams.get("externalId") : body.externalId;
  const [a, id, action] = path;

  if (a === "account" && method === "POST") {
    const u = await upsertAccount(partner, body);
    return u ? j({ account: accountView(u) }) : j({ error: "bad_external_id" }, 400);
  }

  const u = await findAccount(partner, externalId);
  if (a === "account" && method === "GET") return j({ account: u ? accountView(u) : null });
  if (!u) return j({ error: "no_account" }, 404);

  if (a === "jobs" && !id && method === "GET") return j({ account: accountView(u), jobs: await listJobs(u) });

  if (a === "jobs" && !id && method === "POST") {
    if (!u.company || !u.contactEmail) return j({ error: "setup" }, 409);
    const notes = String(body.notes || "").trim().slice(0, 1200);
    const fields: Record<string, unknown> = { ...body };
    if (notes) fields.criticalTraits = `${String(body.criticalTraits || "").trim()}\n${String(body.notesLabel || "Additional emphasis from the manager")}: ${notes}`.trim();
    const r = await createJobPending(u, fields, String(body.roleKey || ""));
    if (r.ok) return j({ jobId: r.jobId });
    return j(r, r.code === "compliance" || r.code === "missing" ? 422 : 503);
  }

  if (a === "jobs" && id) {
    const db = await getDb();
    const [job] = await db.select().from(jobProfiles).where(eq(jobProfiles.id, id)).limit(1);
    if (!job || job.userId !== u.id) return j({ error: "not_found" }, 404);
    if (action === "status" && method === "POST") {
      const next = body.status === "CLOSED" ? "CLOSED" : "ACTIVE";
      if (job.status === "ACTIVE" || job.status === "CLOSED") await db.update(jobProfiles).set({ status: next }).where(eq(jobProfiles.id, id));
      return j({ ok: true });
    }
    if (action === "retry" && method === "POST") return j({ result: await retryGeneration(id) });
  }

  if (a === "reports" && id) {
    if (!action && method === "GET") {
      const r = await reportView(u, id);
      return r ? j({ report: r, account: accountView(u) }) : j({ error: "not_found" }, 404);
    }
    if (action === "unlock" && method === "POST") return j({ result: await unlockSubmission(u, id) });
    if (action === "retry" && method === "POST") return j({ result: (await retryEvaluation(u, id)) ?? "skipped" });
  }

  if (a === "signin" && method === "POST") return j({ url: await signInLink(u, String(body.next || "/app")) });

  return j({ error: "not_found" }, 404);
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(req, (await params).path, "GET");
}
export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(req, (await params).path, "POST");
}
