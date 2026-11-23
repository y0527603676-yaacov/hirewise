"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, putSetting } from "@/lib/db";
import { jobProfiles, users, candidateSubmissions } from "@/lib/schema";
import { adminAttempt, adminLocked, checkAdminPassword, createLoginToken, currentUser, logout, normEmail, requireUser, setAdminCookie, validEmail, isAdmin } from "@/lib/auth";
import { mailConfigured, mailHtml, sendMail } from "@/lib/mail";
import { LANG_COOKIE, visitorLocale } from "@/lib/locale";
import { appUrl } from "@/lib/constants";
import { getT, isLocale, type Locale } from "@/i18n";
import { createJob, regenerate, type JobFormResult } from "@/lib/jobs";
import { deleteSubmission, retryEvaluation, unlockSubmission, type UnlockResult } from "@/lib/evaluation";
import { createCheckout, type CheckoutResult } from "@/lib/payments";
import { isCurrency, isPack, mergePrices } from "@/lib/core/pricing";
import { isJurisdiction } from "@/lib/core/compliance";
import { startAssessment, type StartResult } from "@/lib/candidate";
import { deleteAccount } from "@/lib/retention";

// ---------- login ----------
export type LoginState = { status: "idle" | "sent" | "invalid" | "recent" | "mail_off" | "error"; email?: string; devLink?: string };

export async function requestLogin(_: LoginState, form: FormData): Promise<LoginState> {
  const email = normEmail(String(form.get("email") || ""));
  if (!validEmail(email)) return { status: "invalid" };
  const locale = await visitorLocale();
  const devShow = process.env.DEV_SHOW_LINKS === "1";
  if (!mailConfigured() && !devShow) return { status: "mail_off" };
  const token = await createLoginToken(email, locale);
  if (!token) return { status: "recent", email };
  const link = `${appUrl()}/auth/${token}`;
  if (mailConfigured()) {
    const t = getT(locale);
    const ok = await sendMail({ to: email, subject: t("mailLoginSubject"), html: mailHtml(locale, { lines: [t("mailLoginBody")], button: { label: t("mailLoginBtn"), href: link }, foot: t("mailIgnore") }) });
    if (!ok && !devShow) return { status: "error" };
  }
  return { status: "sent", email, devLink: devShow ? link : undefined };
}

export async function logoutAction() {
  await logout();
  redirect("/");
}

// ---------- settings ----------
export type SettingsState = { status: "idle" | "saved" | "invalid"; fields?: string[] };

export async function saveSettings(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const name = String(form.get("name") || "").trim().slice(0, 80);
  const company = String(form.get("company") || "").trim().slice(0, 100);
  const contactEmail = normEmail(String(form.get("contactEmail") || ""));
  const locale = String(form.get("locale"));
  const currency = String(form.get("currency"));
  const jurisdiction = String(form.get("jurisdiction"));
  const bad: string[] = [];
  if (contactEmail && !validEmail(contactEmail)) bad.push("contactEmail");
  if (bad.length) return { status: "invalid", fields: bad };
  const db = await getDb();
  await db
    .update(users)
    .set({
      name: name || null,
      company: company || null,
      contactEmail: contactEmail || null,
      locale: isLocale(locale) ? locale : user.locale,
      preferredCurrency: isCurrency(currency) ? currency : user.preferredCurrency,
      defaultJurisdiction: isJurisdiction(jurisdiction) ? jurisdiction : user.defaultJurisdiction,
    })
    .where(eq(users.id, user.id));
  if (isLocale(locale)) (await cookies()).set(LANG_COOKIE, locale, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
  revalidatePath("/app", "layout");
  return { status: "saved" };
}

export async function deleteAccountAction(form: FormData) {
  const user = await requireUser();
  if (String(form.get("confirm") || "").trim().toUpperCase() !== "DELETE") redirect("/app/settings?del=confirm");
  await deleteAccount(user.id);
  await logout();
  redirect("/");
}

// ---------- roles ----------
export async function createJobAction(raw: Record<string, string>): Promise<JobFormResult> {
  const user = await requireUser();
  const r = await createJob(user, raw);
  if (r.ok) revalidatePath("/app");
  return r;
}

export async function regenerateAction(jobId: string) {
  const user = await requireUser();
  const r = await regenerate(user, jobId);
  revalidatePath(`/app/jobs/${jobId}`);
  return r;
}

export async function toggleJobAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("id"));
  const db = await getDb();
  const [job] = await db.select().from(jobProfiles).where(eq(jobProfiles.id, id)).limit(1);
  if (job && job.userId === user.id && (job.status === "ACTIVE" || job.status === "CLOSED")) await db.update(jobProfiles).set({ status: job.status === "ACTIVE" ? "CLOSED" : "ACTIVE" }).where(eq(jobProfiles.id, id));
  revalidatePath(`/app/jobs/${id}`);
}

// ---------- reports ----------
export async function unlockAction(subId: string): Promise<UnlockResult> {
  const user = await requireUser();
  const r = await unlockSubmission(user, subId);
  revalidatePath(`/app/reports/${subId}`);
  return r;
}

export async function retryAction(subId: string) {
  const user = await requireUser();
  await retryEvaluation(user, subId);
  revalidatePath(`/app/reports/${subId}`);
}

export async function deleteCandidateAction(form: FormData) {
  const user = await requireUser();
  const subId = String(form.get("id"));
  const db = await getDb();
  const [row] = await db.select({ s: candidateSubmissions, j: jobProfiles }).from(candidateSubmissions).innerJoin(jobProfiles, eq(jobProfiles.id, candidateSubmissions.jobProfileId)).where(eq(candidateSubmissions.id, subId)).limit(1);
  if (!row || row.j.userId !== user.id) redirect("/app");
  await deleteSubmission(subId);
  redirect(`/app/jobs/${row.j.id}`);
}

// ---------- payments ----------
export async function checkoutAction(raw: { pack: string; fullName?: string; phone?: string }): Promise<CheckoutResult> {
  const user = await requireUser();
  if (!isPack(raw.pack)) return { ok: false, code: "provider_failed" };
  const cur = isCurrency(user.preferredCurrency) ? user.preferredCurrency : "USD";
  return createCheckout(user, raw.pack, cur, { fullName: raw.fullName || "", phone: raw.phone || "" });
}

// ---------- candidate ----------
export async function startAssessmentAction(slug: string, raw: { fullName: string; email: string; phone: string; locale: string; accommodation: boolean; consent: boolean; address?: string }): Promise<StartResult> {
  const r = await startAssessment(slug, raw);
  if (r.ok && isLocale(raw.locale)) (await cookies()).set(LANG_COOKIE, raw.locale, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
  return r;
}

// ---------- admin ----------
export async function adminLogin(form: FormData) {
  if (await adminLocked()) redirect("/admin?e=locked");
  const ok = checkAdminPassword(String(form.get("pw") || ""));
  await adminAttempt(ok);
  if (!ok) redirect("/admin?e=wrong");
  await setAdminCookie();
  redirect("/admin");
}

export async function adminSavePrices(form: FormData) {
  if (!(await isAdmin())) redirect("/admin");
  const raw: Record<string, Record<string, number>> = {};
  for (const [k, v] of form.entries()) {
    const m = String(k).match(/^p_(USD|EUR|GBP|ILS)_(s|m|l)$/);
    if (m) (raw[m[1]] ||= {})[m[2]] = Number(v);
  }
  await putSetting("prices", JSON.stringify(mergePrices(raw)));
  redirect("/admin?ok=prices");
}

export async function adminGrant(form: FormData) {
  if (!(await isAdmin())) redirect("/admin");
  const email = normEmail(String(form.get("email") || ""));
  const n = Math.max(-1000, Math.min(1000, Math.round(Number(form.get("n")) || 0)));
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!u || !n) redirect("/admin?e=grant");
  await db.update(users).set({ purchasedCredits: Math.max(0, u.purchasedCredits + n) }).where(eq(users.id, u.id));
  redirect("/admin?ok=grant");
}

export async function adminSeed() {
  if (!(await isAdmin())) redirect("/admin");
  const { seedDemo } = await import("@/lib/seed");
  await seedDemo();
  redirect("/admin?ok=seed");
}

export async function currentLocale(): Promise<Locale> {
  const u = await currentUser();
  return (u && isLocale(u.locale) ? u.locale : await visitorLocale()) as Locale;
}

// ---------- wizard assistant ----------
export type SuggestResult = { ok: true; text: string } | { ok: false; code: "limit" | "ai_off" | "ai_failed" | "bad_file" };

/** Phrases one wizard field from the employer's speech or notes (optionally a document). Up to 80 a day per employer. */
export async function suggestFieldAction(input: {
  field: string; raw: string; context: Record<string, string>; previous: string[]; jurisdiction: string;
  document?: { mediaType: string; data: string; name: string };
}): Promise<SuggestResult> {
  const user = await requireUser();
  const { aiEnabled, suggestField } = await import("@/lib/ai");
  if (!aiEnabled()) return { ok: false, code: "ai_off" };
  const { TEXT_FIELDS } = await import("@/lib/jobs");
  if (!(TEXT_FIELDS as readonly string[]).includes(input.field)) return { ok: false, code: "ai_failed" };
  const { getSetting } = await import("@/lib/db");
  const day = new Date().toISOString().slice(0, 10);
  const key = `assist.${user.id}.${day}`;
  const used = Number(await getSetting(key)) || 0;
  if (used >= 80) return { ok: false, code: "limit" };
  await putSetting(key, String(used + 1));

  let document: { kind: "pdf" | "image" | "text"; mediaType: string; data: string; name: string } | undefined;
  if (input.document) {
    const mt = String(input.document.mediaType || "");
    const data = String(input.document.data || "");
    if (data.length > 7_000_000) return { ok: false, code: "bad_file" };
    if (mt === "application/pdf") document = { kind: "pdf", mediaType: mt, data, name: input.document.name };
    else if (/^image\/(jpeg|png|webp|gif)$/.test(mt)) document = { kind: "image", mediaType: mt, data, name: input.document.name };
    else if (mt.startsWith("text/")) document = { kind: "text", mediaType: mt, data: data.slice(0, 40000), name: input.document.name };
    else return { ok: false, code: "bad_file" };
  }
  const context: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.context || {})) if ((TEXT_FIELDS as readonly string[]).includes(k) && k !== input.field) context[k] = String(v).slice(0, 1500);
  try {
    const text = await suggestField({
      field: input.field,
      raw: String(input.raw || "").slice(0, 4000),
      context,
      previous: (input.previous || []).slice(-3).map((x) => String(x).slice(0, 1500)),
      jurisdiction: (isJurisdiction(input.jurisdiction) ? input.jurisdiction : user.defaultJurisdiction) as never,
      locale: (isLocale(user.locale) ? user.locale : "en") as Locale,
      document,
    });
    return { ok: true, text };
  } catch {
    return { ok: false, code: "ai_failed" };
  }
}

export async function retryGenerationAction(form: FormData) {
  const user = await requireUser();
  const id = String(form.get("id"));
  const { getOwnedJob, retryGeneration } = await import("@/lib/jobs");
  if (await getOwnedJob(user, id)) await retryGeneration(id);
  revalidatePath(`/app/jobs/${id}`);
}
