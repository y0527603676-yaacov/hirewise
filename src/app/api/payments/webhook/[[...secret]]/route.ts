import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { transactions } from "@/lib/schema";
import { approveGrowTransaction, completeTransaction, hookSecretOk } from "@/lib/payments";

/**
 * Grow payment confirmation. Comes from one of three senders:
 * 1. Grow directly (direct connection): verified by the process id and its secret token.
 * 2. Grow through a URL with a secret (/api/payments/webhook/<secret>), when Make created the page.
 * 3. Make itself, with header x-cw-secret and body {orderId, status, transactionId}.
 * Our transaction id comes back in cField1 (or orderId); the amount is checked whenever it is sent.
 */
export async function POST(req: Request, { params }: { params: Promise<{ secret?: string[] }> }) {
  const pathSecret = (await params).secret?.[0];
  const raw = await req.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw);
  } catch {
    body = Object.fromEntries(new URLSearchParams(raw));
  }
  const flat: Record<string, string> = {};
  (function walk(o: unknown, pre: string) {
    if (o && typeof o === "object") for (const k in o as Record<string, unknown>) walk((o as Record<string, unknown>)[k], pre ? `${pre}[${k}]` : k);
    else flat[pre] = String(o ?? "");
  })(body, "");
  const pick = (re: RegExp) => {
    for (const k in flat) if (re.test(k)) return flat[k];
    return "";
  };
  const orderId = pick(/^orderId$/) || pick(/(^|\[)cField1\]?$/) || pick(/customField1\]?$/);
  const statusCode = pick(/(^|\[)statusCode\]?$/);
  const status = pick(/^status$/) || pick(/^data\[status\]$/);
  const sum = pick(/(^|\[)sum\]?$/) || pick(/(^|\[)amount\]?$/);
  const processId = pick(/(^|\[)processId\]?$/);
  const processToken = pick(/(^|\[)processToken\]?$/);
  const txn = pick(/(^|\[)transactionId\]?$/) || pick(/asmachta\]?$/) || "grow";

  const db = await getDb();
  const [t] = orderId
    ? await db.select().from(transactions).where(eq(transactions.id, orderId)).limit(1)
    : processId
      ? await db.select().from(transactions).where(eq(transactions.processId, processId)).limit(1)
      : [];
  if (!t || t.currency !== "ILS") return NextResponse.json({ ok: false }, { status: 401 });

  const direct = Boolean(t.processId && t.processToken);
  const authentic = direct ? t.processId === processId && t.processToken === processToken : hookSecretOk(pathSecret || req.headers.get("x-cw-secret") || pick(/^secret$/));
  if (!authentic || (sum && Math.round(Number(sum) * 100) !== t.amount) || (direct && !sum)) return NextResponse.json({ ok: false }, { status: 401 });

  const paid = statusCode ? statusCode === "2" : direct ? status === "1" : !status || /^(paid|success|approved|ok|1|true|שולם)$/i.test(status);
  if (!paid) return NextResponse.json({ ok: true, paid: false });
  await completeTransaction(t.id, txn);
  if (direct) {
    const data: Record<string, string> = {};
    for (const k in flat) {
      const m = k.match(/^data\[([^\]]+)\]$/);
      if (m) data[m[1]] = flat[k];
    }
    await approveGrowTransaction(data);
  }
  return NextResponse.json({ ok: true, paid: true });
}
