/**
 * Buying report credits.
 * - ILS: Grow. Directly through the Grow Light API when all four GROW_* values exist, otherwise through Make
 *   (the same shared scenario as Clearwise: Make creates the Grow payment page and returns its URL).
 * - USD / EUR / GBP: Paddle (merchant of record, handles VAT), with an inline (non-catalog) price.
 * - DEMO_PAYMENTS=1 (local testing only): credits are added without charging.
 * Credits are added exactly once per transaction, whichever confirmation arrives first.
 */
import { randomBytes, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { getDb, getSetting, newId, rawDb } from "./db";
import { transactions, users, type Transaction, type User } from "./schema";
import { mergePrices, PACK_CREDITS, providerFamily, type Currency, type Pack, type PriceTable } from "./core/pricing";
import { noteOps } from "./mail";
import { appUrl } from "./constants";

export async function getPrices(): Promise<PriceTable> {
  try {
    return mergePrices(JSON.parse((await getSetting("prices")) || "null"));
  } catch {
    return mergePrices(null);
  }
}

const env = (k: string) => {
  const v = (process.env[k] || "").trim();
  return v && !v.startsWith("your_") ? v : "";
};
const growDirect = () => Boolean(env("GROW_API_URL") && env("GROW_USER_ID") && env("GROW_PAGE_CODE") && env("GROW_API_KEY"));
const makeOn = () => /^https?:\/\/\S+$/.test(env("MAKE_WEBHOOK_URL"));
const paddleOn = () => Boolean(env("PADDLE_API_KEY") && env("PADDLE_CLIENT_TOKEN"));
export const demoPayments = () => env("DEMO_PAYMENTS") === "1";

export function providerFor(c: Currency): "grow" | "make" | "paddle" | "demo" | null {
  if (demoPayments()) return "demo";
  if (providerFamily(c) === "grow") return growDirect() ? "grow" : makeOn() ? "make" : null;
  return paddleOn() ? "paddle" : null;
}

export function hookSecretOk(secret: string | null | undefined): boolean {
  if (!secret) return false;
  const a = Buffer.from(secret);
  return [env("PAYMENT_HOOK_SECRET"), env("MAKE_SECRET")].some((s) => {
    if (!s) return false;
    const b = Buffer.from(s);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export type CheckoutResult = { ok: true; url: string } | { ok: false; code: "payments_off" | "payer" | "provider_failed" };

export async function createCheckout(user: User, pack: Pack, currency: Currency, payer: { fullName: string; phone: string }): Promise<CheckoutResult> {
  const provider = providerFor(currency);
  if (!provider) return { ok: false, code: "payments_off" };
  const prices = await getPrices();
  const amount = prices[currency][pack];
  const credits = PACK_CREDITS[pack];
  const id = newId();
  const returnKey = randomBytes(16).toString("hex");
  const base = appUrl();

  let fullName = "";
  let phone = "";
  if (provider === "grow" || provider === "make") {
    // Grow requires the payer's full name (2+ words) and an Israeli mobile number
    fullName = payer.fullName.trim().replace(/\s+/g, " ").slice(0, 80);
    phone = payer.phone.replace(/\D/g, "");
    if (phone.startsWith("9725")) phone = "0" + phone.slice(3);
    if (fullName.split(" ").length < 2 || !/^05\d{8}$/.test(phone)) return { ok: false, code: "payer" };
  }

  const db = await getDb();
  await db.insert(transactions).values({ id, userId: user.id, provider, amount: Math.round(amount * 100), currency, pack, creditsAdded: credits, status: "PENDING", returnKey, createdAt: new Date() });
  const product = `Hirewise — ${credits} reports`;

  if (provider === "demo") return { ok: true, url: `${base}/paid/${returnKey}` };

  if (provider === "make") {
    try {
      const res = await fetch(env("MAKE_WEBHOOK_URL"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          secret: env("MAKE_SECRET"), orderId: id, tool: "hirewise", product: `Hirewise - ${credits} דו"חות הערכת מועמדים`, amount, currency: "ILS",
          fullName, phone, email: user.email,
          // Grow rejects URLs with query strings, so the return address is a plain path
          successUrl: `${base}/paid/${returnKey}`, cancelUrl: `${base}/app/wallet`,
          notifyUrl: `${base}/api/payments/webhook/${env("PAYMENT_HOOK_SECRET") || env("MAKE_SECRET")}`,
        }),
      });
      const text = await res.text();
      let url = "";
      try {
        const d = JSON.parse(text);
        url = typeof d === "string" ? d : d.url || d.paymentUrl || d.link || (d.data && d.data.url) || "";
      } catch {
        url = text;
      }
      url = String(url || "").trim().replace(/^"+|"+$/g, "");
      if (/^https?:\/\/\S+$/.test(url)) return { ok: true, url };
      await noteOps("payment", `Make did not return a payment URL (${res.status}): ${text.slice(0, 120)}`);
    } catch (e) {
      await noteOps("payment", `Make error: ${String((e as Error)?.message || e)}`);
    }
    return { ok: false, code: "provider_failed" };
  }

  if (provider === "grow") {
    const json = await growCall("createPaymentProcess", {
      pageCode: env("GROW_PAGE_CODE"), userId: env("GROW_USER_ID"), apiKey: env("GROW_API_KEY"), sum: String(amount), description: product,
      "pageField[fullName]": fullName, "pageField[phone]": phone, "pageField[email]": user.email,
      successUrl: `${base}/paid/${returnKey}`, cancelUrl: `${base}/app/wallet`, notifyUrl: `${base}/api/payments/webhook`, cField1: id,
    });
    const d = json && String(json.status) === "1" && json.data ? json.data : null;
    if (d && typeof d.url === "string" && d.processId && d.processToken) {
      await db.update(transactions).set({ processId: String(d.processId), processToken: String(d.processToken) }).where(eq(transactions.id, id));
      return { ok: true, url: d.url };
    }
    return { ok: false, code: "provider_failed" };
  }

  // Paddle Billing: a transaction with an inline price; its checkout URL uses the default payment link set in Paddle
  try {
    const api = env("PADDLE_ENV") === "live" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
    const res = await fetch(`${api}/transactions`, {
      method: "POST",
      headers: { authorization: `Bearer ${env("PADDLE_API_KEY")}`, "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        items: [{ quantity: 1, price: { description: product, name: product, unit_price: { amount: String(Math.round(amount * 100)), currency_code: currency }, product: { name: product, tax_category: "standard" } } }],
        custom_data: { hw_tx: id },
        // Paddle opens its checkout on this page of ours (the domain must be approved in Paddle)
        checkout: { url: `${base}/pay/${returnKey}` },
      }),
    });
    const d = (await res.json().catch(() => ({}))) as { data?: { id?: string; checkout?: { url?: string } }; error?: { detail?: string } };
    const url = d.data?.checkout?.url;
    if (res.ok && url && d.data?.id) {
      await db.update(transactions).set({ stripeSessionId: d.data.id }).where(eq(transactions.id, id));
      return { ok: true, url };
    }
    await noteOps("payment", `Paddle (${res.status}): ${d.error?.detail || ""}`.slice(0, 200));
  } catch (e) {
    await noteOps("payment", `Paddle error: ${String((e as Error)?.message || e)}`);
  }
  return { ok: false, code: "provider_failed" };
}

/** Marks a transaction paid and adds the credits — exactly once */
export async function completeTransaction(txId: string, providerRef: string): Promise<boolean> {
  const DB = await rawDb();
  const r = await DB.prepare(`UPDATE transactions SET status = 'PAID', paid_at = ?, provider_ref = COALESCE(?, provider_ref) WHERE id = ? AND status != 'PAID'`).bind(Date.now(), providerRef || null, txId).run();
  if (!r.meta?.changes) return false;
  const tx = await DB.prepare(`SELECT user_id, credits_added FROM transactions WHERE id = ?`).bind(txId).first<{ user_id: string; credits_added: number }>();
  if (!tx) return false;
  await DB.prepare(`UPDATE users SET purchased_credits = purchased_credits + ?, ever_purchased = 1 WHERE id = ?`).bind(tx.credits_added, tx.user_id).run();
  return true;
}

export async function txByReturnKey(key: string): Promise<Transaction | null> {
  if (!/^[0-9a-f]{32}$/.test(key)) return null;
  const db = await getDb();
  const [t] = await db.select().from(transactions).where(eq(transactions.returnKey, key)).limit(1);
  return t ?? null;
}

// ---------- Grow Light API ----------
type GrowResponse = { status?: number | string; err?: unknown; data?: Record<string, unknown> | "" };

async function growCall(method: string, fields: Record<string, string>): Promise<GrowResponse | null> {
  const b = env("GROW_API_URL").replace(/\/+$/, "");
  const endpoint = b.includes("/api/light") ? `${b}/${method}` : `${b}/api/light/server/1.0/${method}`;
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  try {
    const res = await fetch(endpoint, { method: "POST", body, cache: "no-store" });
    const json = (await res.json()) as GrowResponse;
    if (String(json?.status) !== "1") await noteOps("payment", `Grow ${method}: ${JSON.stringify(json?.err ?? json).slice(0, 160)}`);
    return json;
  } catch (e) {
    await noteOps("payment", `Grow ${method} error: ${String((e as Error)?.message || e)}`);
    return null;
  }
}

/** Direct query to Grow: was this process paid? */
export async function growProcessPaid(t: Transaction): Promise<{ paid: boolean; ref: string }> {
  if (!t.processId || !t.processToken) return { paid: false, ref: "" };
  const json = await growCall("getPaymentProcessInfo", { pageCode: env("GROW_PAGE_CODE"), processId: t.processId, processToken: t.processToken });
  const d = json && String(json.status) === "1" && json.data ? json.data : null;
  const list = d && Array.isArray(d.transactions) ? (d.transactions as Record<string, unknown>[]) : [];
  const tx = list.find((x) => (String(x.statusCode) === "2" || x.status === "שולם") && Math.round(Number(x.sum) * 100) === t.amount);
  return { paid: Boolean(tx), ref: tx ? String(tx.transactionId ?? tx.asmachta ?? "grow") : "" };
}

export async function approveGrowTransaction(data: Record<string, string>) {
  await growCall("approveTransaction", { pageCode: env("GROW_PAGE_CODE"), ...data });
}

/** Direct query to Paddle: is this transaction completed? */
export async function paddlePaid(t: Transaction): Promise<boolean> {
  if (!t.stripeSessionId || !paddleOn()) return false;
  try {
    const api = env("PADDLE_ENV") === "live" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
    const res = await fetch(`${api}/transactions/${encodeURIComponent(t.stripeSessionId)}`, { headers: { authorization: `Bearer ${env("PADDLE_API_KEY")}` }, cache: "no-store" });
    const d = (await res.json().catch(() => ({}))) as { data?: { status?: string } };
    return d.data?.status === "completed" || d.data?.status === "paid";
  } catch {
    return false;
  }
}

export async function userById(id: string) {
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return u ?? null;
}
