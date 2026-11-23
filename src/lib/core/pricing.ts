/** Credit packs and prices. Defaults can be overridden from the admin screen (settings key "prices"). */
export const CURRENCIES = ["USD", "EUR", "GBP", "ILS"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const PACKS = ["s", "m", "l"] as const;
export type Pack = (typeof PACKS)[number];

export const PACK_CREDITS: Record<Pack, number> = { s: 10, m: 30, l: 100 };

export type PriceTable = Record<Currency, Record<Pack, number>>;
export const DEFAULT_PRICES: PriceTable = {
  USD: { s: 29, m: 69, l: 199 },
  EUR: { s: 27, m: 64, l: 185 },
  GBP: { s: 23, m: 55, l: 159 },
  ILS: { s: 109, m: 249, l: 699 },
};

export const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", EUR: "€", GBP: "£", ILS: "₪" };

export const isCurrency = (c: unknown): c is Currency => CURRENCIES.includes(c as Currency);
export const isPack = (p: unknown): p is Pack => PACKS.includes(p as Pack);

/** Merges a stored (possibly partial or broken) price table over the defaults; only positive numbers are kept. */
export function mergePrices(stored: unknown): PriceTable {
  const out = JSON.parse(JSON.stringify(DEFAULT_PRICES)) as PriceTable;
  if (!stored || typeof stored !== "object") return out;
  for (const c of CURRENCIES) {
    const row = (stored as Record<string, unknown>)[c];
    if (!row || typeof row !== "object") continue;
    for (const p of PACKS) {
      const v = Number((row as Record<string, unknown>)[p]);
      if (Number.isFinite(v) && v > 0 && v < 100000) out[c][p] = Math.round(v * 100) / 100;
    }
  }
  return out;
}

/** Israel (ILS) is paid through Grow; every other currency through Paddle. */
export const providerFamily = (c: Currency) => (c === "ILS" ? "grow" : "paddle");

export const formatPrice = (amount: number, c: Currency, locale = "en") => {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: c, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);
  } catch {
    return `${CURRENCY_SYMBOL[c]}${amount}`;
  }
};

/** Default display currency for a visitor's language */
export const currencyForLocale = (l: string): Currency => (l === "he" ? "ILS" : l === "es" || l === "fr" || l === "de" ? "EUR" : "USD");
