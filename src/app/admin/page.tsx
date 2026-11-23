import { desc } from "drizzle-orm";
import { isAdmin } from "@/lib/auth";
import { getDb, getSetting, rawDb } from "@/lib/db";
import { transactions, users } from "@/lib/schema";
import { getPrices, providerFor } from "@/lib/payments";
import { aiEnabled } from "@/lib/ai";
import { mailConfigured } from "@/lib/mail";
import { CURRENCIES, PACKS, PACK_CREDITS } from "@/lib/core/pricing";
import { adminGrant, adminLogin, adminSavePrices, adminSeed } from "../actions";
import { CopySecret } from "@/components/copy-secret";

export const dynamic = "force-dynamic";

/** מסך ניהול (בעברית בלבד, ליעקב) */
export default async function Admin({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string }> }) {
  const { e, ok } = await searchParams;
  if (!(await isAdmin())) {
    return (
      <main dir="rtl" className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5">
        <form action={adminLogin} className="card space-y-3">
          <h1 className="h2">כניסה לניהול Hirewise</h1>
          <input name="pw" type="password" className="input" placeholder="סיסמה" dir="ltr" autoFocus />
          {e === "wrong" && <p className="err">סיסמה שגויה.</p>}
          {e === "locked" && <p className="err">יותר מדי ניסיונות. נסו שוב בעוד רבע שעה.</p>}
          {!process.env.ADMIN_KEY && <p className="err">ADMIN_KEY לא הוגדר ב-Cloudflare.</p>}
          <button className="btn-primary w-full">כניסה</button>
        </form>
      </main>
    );
  }
  const DB = await rawDb();
  const one = async (sql: string) => Number(((await DB.prepare(sql).first<{ n: number }>()) || { n: 0 }).n) || 0;
  const stats = {
    users: await one("SELECT COUNT(*) n FROM users"),
    jobs: await one("SELECT COUNT(*) n FROM job_profiles"),
    subs: await one("SELECT COUNT(*) n FROM candidate_submissions"),
    done: await one("SELECT COUNT(*) n FROM candidate_submissions WHERE status = 'COMPLETED'"),
    reports: await one("SELECT COUNT(*) n FROM evaluation_reports"),
    unlocked: await one("SELECT COUNT(*) n FROM evaluation_reports WHERE is_unlocked = 1 AND unlock_source = 'CREDIT'"),
    pending: await one("SELECT COUNT(*) n FROM candidate_submissions WHERE eval_status IN ('PENDING','RUNNING','FAILED')"),
  };
  const revenue = (await DB.prepare("SELECT currency, SUM(amount) s, COUNT(*) n FROM transactions WHERE status = 'PAID' GROUP BY currency").all<{ currency: string; s: number; n: number }>()).results;
  const db = await getDb();
  const recentTx = await db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(15);
  const recentUsers = await db.select().from(users).orderBy(desc(users.createdAt)).limit(15);
  const prices = await getPrices();
  const ops = JSON.parse((await getSetting("ops.log")) || "[]") as { at: number; kind: string; text: string }[];
  const fmt = (d: number | Date | null) => (d ? new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(d) : "");
  const health = [
    ["בינה מלאכותית (ANTHROPIC_API_KEY)", aiEnabled()],
    ["מיילים (RESEND_API_KEY + MAIL_FROM)", mailConfigured()],
    ["תשלום בשקלים (Grow / Make)", Boolean(providerFor("ILS"))],
    ["תשלום בחו״ל (Paddle)", Boolean(providerFor("USD"))],
    ["מתזמן (CRON_SECRET)", Boolean(process.env.CRON_SECRET || process.env.PAYMENT_HOOK_SECRET)],
    ["מצב הדגמה כבוי (DEMO_PAYMENTS)", process.env.DEMO_PAYMENTS !== "1"],
  ] as const;
  return (
    <main dir="rtl" className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <h1 className="h1">ניהול Hirewise</h1>
      {ok && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">נשמר.</p>}
      {e === "grant" && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">לא נמצא משתמש עם המייל הזה.</p>}

      <section className="card">
        <h2 className="h2">מצב החיבורים</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {health.map(([k, v]) => (
            <li key={k} className="flex items-center justify-between rounded-lg bg-mist px-3 py-2 text-sm">
              {k}<span className={`badge ${v ? "bg-mint/10 text-mint" : "bg-red-50 text-red-700"}`}>{v ? "תקין" : "חסר"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[["מעסיקים", stats.users], ["משרות", stats.jobs], ["מועמדים", stats.subs], ["סיימו", stats.done], ["דו״חות", stats.reports], ["נפתחו בתשלום", stats.unlocked], ["ממתינים להערכה", stats.pending]].map(([k, v]) => (
          <div key={String(k)} className="card text-center"><div className="text-2xl font-extrabold">{v}</div><div className="text-xs text-ink/55">{k}</div></div>
        ))}
      </section>

      <section className="card">
        <h2 className="h2">הכנסות</h2>
        <p className="mt-2 text-sm">{revenue.length ? revenue.map((r) => `${(r.s / 100).toLocaleString("he-IL")} ${r.currency} (${r.n} רכישות)`).join(" · ") : "עוד אין רכישות."}</p>
      </section>

      <section className="card">
        <h2 className="h2">חיבור TileVision</h2>
        {process.env.PARTNER_KEY_TILEVISION ? (
          <div className="mt-2 space-y-2 text-sm">
            <p>זה מפתח החיבור. ב-Vercel, בפרויקט tilevision, מוסיפים משתנה בשם <b dir="ltr">HIREWISE_PARTNER_KEY</b> ומדביקים בו את המפתח הזה, ואז עושים Redeploy.</p>
            <CopySecret value={process.env.PARTNER_KEY_TILEVISION} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink/60">המפתח עוד לא הוגדר.</p>
        )}
      </section>

      <section className="card">
        <h2 className="h2">מחירי חבילות</h2>
        <form action={adminSavePrices} className="mt-3 overflow-x-auto">
          <table className="text-sm">
            <thead><tr><th className="p-2"></th>{PACKS.map((p) => <th key={p} className="p-2">{PACK_CREDITS[p]} דו״חות</th>)}</tr></thead>
            <tbody>
              {CURRENCIES.map((c) => (
                <tr key={c}>
                  <td className="p-2 font-bold" dir="ltr">{c}</td>
                  {PACKS.map((p) => <td key={p} className="p-1"><input name={`p_${c}_${p}`} defaultValue={prices[c][p]} className="input w-24 py-1.5" dir="ltr" inputMode="decimal" /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn-primary mt-3">שמירת מחירים</button>
        </form>
      </section>

      <section className="card">
        <h2 className="h2">הוספת קרדיטים ידנית</h2>
        <form action={adminGrant} className="mt-3 flex flex-wrap gap-2">
          <input name="email" className="input max-w-xs" placeholder="מייל המעסיק" dir="ltr" />
          <input name="n" className="input w-28" placeholder="כמות" dir="ltr" inputMode="numeric" />
          <button className="btn-dark">הוספה</button>
        </form>
        <p className="hint">מספר שלילי מוריד קרדיטים.</p>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card p-0">
          <h2 className="h2 px-5 pt-5">מעסיקים אחרונים</h2>
          <ul className="mt-3 divide-y divide-ink/[0.06] text-sm">
            {recentUsers.map((u) => (
              <li key={u.id} className="flex justify-between gap-2 px-5 py-2.5">
                <span dir="ltr">{u.email}</span>
                <span className="text-xs text-ink/55">{u.company || "—"} · {u.freeCredits}+{u.purchasedCredits} · {fmt(u.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-0">
          <h2 className="h2 px-5 pt-5">תשלומים אחרונים</h2>
          <ul className="mt-3 divide-y divide-ink/[0.06] text-sm">
            {recentTx.map((x) => (
              <li key={x.id} className="flex justify-between gap-2 px-5 py-2.5">
                <span>{x.creditsAdded} דו״חות · {(x.amount / 100).toLocaleString("he-IL")} {x.currency} · {x.provider}</span>
                <span className="text-xs text-ink/55">{x.status} · {fmt(x.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card">
        <h2 className="h2">תקלות אחרונות</h2>
        {ops.length === 0 ? <p className="mt-2 text-sm text-ink/55">אין תקלות.</p> : (
          <ul className="mt-2 space-y-1 text-sm">{ops.map((o, i) => <li key={i}><b>{o.kind}</b> · {fmt(o.at)} · <span dir="ltr">{o.text}</span></li>)}</ul>
        )}
      </section>

      <section className="card">
        <h2 className="h2">נתוני הדגמה</h2>
        <p className="mt-1 text-sm text-ink/60">יוצר מעסיק לדוגמה (demo@hire.clearwise.me) עם משרה, שאלון מנהל ושלושה מועמדים עם דו״חות. לבדיקות בלבד.</p>
        <form action={adminSeed}><button className="btn-outline mt-3">יצירת נתוני הדגמה</button></form>
      </section>
    </main>
  );
}
