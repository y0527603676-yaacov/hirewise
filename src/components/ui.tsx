import Link from "next/link";
import { BUSINESS } from "@/lib/constants";
import { LOCALES, LOCALE_NAMES, type Locale, type T } from "@/i18n";

export function Logo({ href = "/", sub }: { href?: string; sub?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2" dir="ltr">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-white shadow-sm">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12.5l4.2 4.2L19 7" />
        </svg>
      </span>
      <span className="text-lg font-extrabold tracking-tight">Hirewise</span>
      {sub && <span className="hidden text-xs font-medium text-ink/45 sm:inline">{sub}</span>}
    </Link>
  );
}

/** Language links: /lang sets the cookie and comes back to the same page */
export function LangLinks({ current, next = "/", param }: { current: Locale; next?: string; param?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs" aria-label="Language">
      {LOCALES.map((l) => (
        <a
          key={l}
          href={param ? `${next}${next.includes("?") ? "&" : "?"}lang=${l}` : `/lang?l=${l}&next=${encodeURIComponent(next)}`}
          className={`rounded-md px-2 py-1 font-medium ${l === current ? "bg-ink text-white" : "text-ink/60 hover:bg-ink/5"}`}
          hrefLang={l}
          lang={l}
        >
          {LOCALE_NAMES[l]}
        </a>
      ))}
    </div>
  );
}

export function Footer({ t }: { t: T }) {
  return (
    <footer className="no-print mx-auto mt-16 max-w-5xl border-t border-ink/10 px-5 py-8 text-center text-xs leading-relaxed text-ink/55">
      <p>{t("footerOperated", { name: BUSINESS.name, address: BUSINESS.address })}</p>
      <p className="mt-1">{t("footerDisclaimer")}</p>
      <p className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
        <Link href="/sample" className="hover:underline">{t("heroCta2")}</Link>
        <Link href="/privacy" className="hover:underline">{t("privacy")}</Link>
        <Link href="/terms" className="hover:underline">{t("terms")}</Link>
        <a href={`mailto:${BUSINESS.email}`} dir="ltr" className="hover:underline">{BUSINESS.email}</a>
      </p>
      <p className="mt-2 text-ink/40">© {new Date().getFullYear()} Clearwise</p>
    </footer>
  );
}

export function ScoreRing({ value, label, size = 92, locked = false }: { value: number; label: string; size?: number; locked?: boolean }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const color = v >= 75 ? "#0f9d7a" : v >= 50 ? "#4f46e5" : v >= 35 ? "#d97706" : "#dc2626";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} viewBox="0 0 100 100" className={locked ? "blur-lock" : ""} role="img" aria-label={`${label}: ${v}`}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#eef0f6" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 50 50)" />
        <text x="50" y="57" textAnchor="middle" fontSize="24" fontWeight="800" fill="#101828">{v}</text>
      </svg>
      <span className="text-center text-xs font-semibold text-ink/65">{label}</span>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "ok" | "error"; children: React.ReactNode }) {
  const cls = { info: "border-brand/20 bg-brand/[0.05] text-ink", warn: "border-amber-300 bg-amber-50 text-amber-900", ok: "border-emerald-200 bg-emerald-50 text-emerald-900", error: "border-red-200 bg-red-50 text-red-800" }[tone];
  return <div className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${cls}`}>{children}</div>;
}
