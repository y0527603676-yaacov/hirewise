/**
 * Employer accounts: passwordless login by email link.
 * - The link token is random, stored only as a hash, valid 30 minutes and single-use.
 * - A session cookie (random, stored hashed) lasts 30 days.
 * - Free reports are granted once per email address, even if the account is deleted and created again.
 * Admin: password from ADMIN_KEY, cookie derived from it, lock after 5 wrong attempts.
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { delSetting, getDb, getSetting, newId, putSetting } from "./db";
import { loginTokens, sessions, users, type User } from "./schema";
import { FREE_REPORTS } from "./core/credits";
import { isLocale, type Locale } from "@/i18n";

export const SESSION_COOKIE = "hw_session";
export const ADMIN_COOKIE = "hw_admin";
const COOKIE = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
export const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export const normEmail = (e: string) => String(e || "").trim().toLowerCase();
export const validEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e) && e.length <= 160;

/** Creates a login token. Returns null when a token was issued for this email in the last minute. */
export async function createLoginToken(email: string, locale: Locale): Promise<string | null> {
  const db = await getDb();
  const recent = await db
    .select()
    .from(loginTokens)
    .where(and(eq(loginTokens.email, email), gt(loginTokens.createdAt, new Date(Date.now() - 60_000))))
    .limit(1);
  if (recent.length) return null;
  const token = randomBytes(24).toString("hex");
  await db.insert(loginTokens).values({ id: sha(token), email, locale, expiresAt: new Date(Date.now() + 30 * 60_000), createdAt: new Date() });
  return token;
}

/** Consumes a login token, creates the account on first login, and starts a session */
export async function consumeLoginToken(token: string): Promise<User | null> {
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(loginTokens)
    .where(and(eq(loginTokens.id, sha(token)), isNull(loginTokens.usedAt), gt(loginTokens.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  await db.update(loginTokens).set({ usedAt: new Date() }).where(eq(loginTokens.id, row.id));
  let [user] = await db.select().from(users).where(eq(users.email, row.email)).limit(1);
  if (!user) {
    // Free reports only once per email address
    const grantKey = `free.granted.${sha(row.email)}`;
    const already = Boolean(await getSetting(grantKey));
    const locale = isLocale(row.locale) ? row.locale : "en";
    const id = newId();
    await db.insert(users).values({
      id,
      email: row.email,
      locale,
      preferredCurrency: locale === "he" ? "ILS" : locale === "en" ? "USD" : locale === "ar" ? "USD" : "EUR",
      defaultJurisdiction: locale === "he" ? "IL" : locale === "en" ? "GLOBAL" : locale === "ar" ? "GLOBAL" : "EU",
      freeCredits: already ? 0 : FREE_REPORTS,
      createdAt: new Date(),
    });
    if (!already) await putSetting(grantKey, "1");
    [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  }
  const sid = randomBytes(32).toString("hex");
  await db.insert(sessions).values({ id: sha(sid), userId: user.id, expiresAt: new Date(Date.now() + 30 * 86400_000) });
  (await cookies()).set(SESSION_COOKIE, sid, { ...COOKIE, maxAge: 30 * 86400 });
  return user;
}

export async function currentUser(): Promise<User | null> {
  const sid = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  const db = await getDb();
  const [s] = await db.select().from(sessions).where(and(eq(sessions.id, sha(sid)), gt(sessions.expiresAt, new Date()))).limit(1);
  if (!s) return null;
  const [u] = await db.select().from(users).where(eq(users.id, s.userId)).limit(1);
  if (u && (!u.lastSeenAt || Date.now() - u.lastSeenAt.getTime() > 3600_000)) {
    await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, u.id)).catch(() => {});
  }
  return u ?? null;
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export async function logout() {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (sid) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.id, sha(sid)));
  }
  jar.delete(SESSION_COOKIE);
}

// ---------- admin ----------

export function checkAdminPassword(pw: string): boolean {
  const key = (process.env.ADMIN_KEY || "").trim();
  if (!key || !pw) return false;
  const a = Buffer.from(sha(pw));
  const b = Buffer.from(sha(key));
  return timingSafeEqual(a, b);
}
const adminCookieValue = () => sha(`hw-admin|${process.env.ADMIN_KEY || ""}`);

export async function isAdmin(): Promise<boolean> {
  if (!process.env.ADMIN_KEY) return false;
  return (await cookies()).get(ADMIN_COOKIE)?.value === adminCookieValue();
}
export async function setAdminCookie() {
  (await cookies()).set(ADMIN_COOKIE, adminCookieValue(), { ...COOKIE, maxAge: 7 * 86400 });
}
export async function adminLocked(): Promise<boolean> {
  try {
    const cur = JSON.parse((await getSetting("admin.fail")) || "null");
    return Boolean(cur && cur.n >= 5 && Date.now() - cur.last < 15 * 60_000);
  } catch {
    return false;
  }
}
export async function adminAttempt(ok: boolean) {
  if (ok) return delSetting("admin.fail");
  let n = 0;
  try {
    const cur = JSON.parse((await getSetting("admin.fail")) || "null");
    if (cur && Date.now() - cur.last < 15 * 60_000) n = cur.n;
  } catch {}
  await putSetting("admin.fail", JSON.stringify({ n: n + 1, last: Date.now() }));
}
