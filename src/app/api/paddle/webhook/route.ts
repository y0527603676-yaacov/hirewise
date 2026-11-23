import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { transactions } from "@/lib/schema";
import { completeTransaction } from "@/lib/payments";
import { verifyPaddleSignature } from "@/lib/core/paddle";

/** Paddle Billing notification (transaction.completed / transaction.paid), signature-verified */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyPaddleSignature(req.headers.get("paddle-signature"), raw, (process.env.PADDLE_WEBHOOK_SECRET || "").trim())) return NextResponse.json({ ok: false }, { status: 401 });
  let ev: { event_type?: string; data?: { id?: string; custom_data?: { hw_tx?: string }; details?: { totals?: { subtotal?: string } }; currency_code?: string } } = {};
  try {
    ev = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (ev.event_type !== "transaction.completed" && ev.event_type !== "transaction.paid") return NextResponse.json({ ok: true });
  const txId = ev.data?.custom_data?.hw_tx;
  if (!txId) return NextResponse.json({ ok: true });
  const db = await getDb();
  const [t] = await db.select().from(transactions).where(eq(transactions.id, txId)).limit(1);
  if (!t || (t.stripeSessionId && ev.data?.id && t.stripeSessionId !== ev.data.id)) return NextResponse.json({ ok: false }, { status: 404 });
  await completeTransaction(t.id, ev.data?.id || "paddle");
  return NextResponse.json({ ok: true });
}
