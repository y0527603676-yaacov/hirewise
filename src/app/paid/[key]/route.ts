import { NextResponse } from "next/server";
import { completeTransaction, demoPayments, growProcessPaid, paddlePaid, txByReturnKey } from "@/lib/payments";
import { visitorLocale } from "@/lib/locale";
import { dirOf, getT } from "@/i18n";

/**
 * The buyer returns here from the payment page. Returning is not proof of payment: credits are added only after
 * the provider's confirmation arrives (or a direct query to the provider confirms it). Waits and re-checks a few times.
 */
export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const n = Math.max(0, Number(new URL(req.url).searchParams.get("n")) || 0);
  const tx = await txByReturnKey(key);
  if (!tx) return NextResponse.redirect(new URL("/app/wallet", req.url));
  let paid = tx.status === "PAID";
  if (!paid && tx.provider === "demo" && demoPayments()) paid = await completeTransaction(tx.id, "demo");
  if (!paid && tx.provider === "grow") {
    const info = await growProcessPaid(tx);
    if (info.paid) paid = (await completeTransaction(tx.id, info.ref)) || true;
  }
  if (!paid && tx.provider === "paddle" && (await paddlePaid(tx))) paid = (await completeTransaction(tx.id, tx.stripeSessionId || "paddle")) || true;
  if (paid) return NextResponse.redirect(new URL(`/app/wallet?paid=${tx.id}`, req.url));
  if (n >= 12) return NextResponse.redirect(new URL("/app/wallet", req.url));
  const locale = await visitorLocale();
  const t = getT(locale);
  const next = `/paid/${key}?n=${n + 1}`;
  return new Response(
    `<!doctype html><html lang="${locale}" dir="${dirOf(locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="3;url=${next}"><title>Hirewise</title></head><body style="font-family:system-ui,Arial,sans-serif;background:#f5f6fb;color:#101828;display:grid;place-items:center;min-height:100vh;margin:0"><div style="text-align:center;padding:24px"><div style="font-weight:800;color:#4f46e5;font-size:22px" dir="ltr">Hirewise</div><p style="font-size:18px">${t("paidWait")}</p><p><a href="${next}" style="color:#4f46e5">↻</a></p></div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}
