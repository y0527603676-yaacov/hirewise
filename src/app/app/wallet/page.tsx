import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { transactions } from "@/lib/schema";
import { getPrices, providerFor } from "@/lib/payments";
import { formatPrice, isCurrency, PACK_CREDITS, PACKS, type Currency } from "@/lib/core/pricing";
import { fmtDate, userLocale, userT } from "@/lib/view";
import { BuyPacks } from "@/components/forms/buy";
import { Notice } from "@/components/ui";

export default async function Wallet({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  const user = await requireUser();
  const t = userT(user);
  const locale = userLocale(user);
  const { paid } = await searchParams;
  const cur: Currency = isCurrency(user.preferredCurrency) ? user.preferredCurrency : "USD";
  const prices = await getPrices();
  const provider = providerFor(cur);
  const db = await getDb();
  const txs = await db.select().from(transactions).where(eq(transactions.userId, user.id)).orderBy(desc(transactions.createdAt)).limit(20);
  const packs = PACKS.map((p) => ({
    id: p, credits: PACK_CREDITS[p], price: formatPrice(prices[cur][p], cur, locale),
    per: t("perReport", { price: formatPrice(Math.round((prices[cur][p] / PACK_CREDITS[p]) * 100) / 100, cur, locale) }),
  }));
  const paidTx = paid ? txs.find((x) => x.id === paid && x.status === "PAID") : undefined;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="h1">{t("walletTitle")}</h1>
      {paidTx && <Notice tone="ok">{t("paidThanks", { n: paidTx.creditsAdded })}</Notice>}
      <div className="grid grid-cols-3 gap-3">
        {[[t("freeCredits"), user.freeCredits], [t("purchasedCredits"), user.purchasedCredits], [t("usedCredits"), user.totalUsedCredits]].map(([k, v]) => (
          <div key={String(k)} className="card text-center">
            <div className="text-3xl font-extrabold">{v}</div>
            <div className="mt-1 text-xs font-semibold text-ink/55">{k}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <h2 className="h2">{t("packsTitle")}</h2>
        <p className="mt-1 text-sm text-ink/55">{t("pricingNote")}</p>
        <div className="mt-4">
          {provider ? (
            <BuyPacks
              packs={packs}
              needPayer={provider === "grow" || provider === "make"}
              labels={{ buy: t("buy"), pack: t("pricingPack"), payerName: t("payerName"), payerPhone: t("payerPhone"), payerHint: t("payerHintIl"), errPayer: t("errPayer"), errOff: t("paymentsOff"), errGeneric: t("errGeneric") }}
            />
          ) : (
            <Notice tone="warn">{t("paymentsOff")}</Notice>
          )}
        </div>
      </div>
      {txs.length > 0 && (
        <div className="card p-0">
          <h2 className="h2 px-5 pt-5">{t("txHistory")}</h2>
          <ul className="mt-3 divide-y divide-ink/[0.06] text-sm">
            {txs.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span>{t("pricingPack", { n: x.creditsAdded })} · <span dir="ltr">{formatPrice(x.amount / 100, x.currency as Currency, locale)}</span></span>
                <span className="flex items-center gap-2 text-xs text-ink/50">
                  {fmtDate(x.createdAt, locale)}
                  <span className={`badge ${x.status === "PAID" ? "bg-mint/10 text-mint" : x.status === "FAILED" ? "bg-red-50 text-red-700" : "bg-ink/5 text-ink/55"}`}>{t(`tx${x.status}` as never)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
