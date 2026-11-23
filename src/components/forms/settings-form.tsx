"use client";
import { useActionState } from "react";
import { saveSettings, type SettingsState } from "@/app/actions";
import { CURRENCIES } from "@/lib/core/pricing";
import { JURISDICTIONS } from "@/lib/core/compliance";
import { LOCALES, LOCALE_NAMES } from "@/i18n";
import type { Dict } from "@/i18n/en";

export function SettingsForm({ d, u }: { d: Dict; u: { name: string; company: string; contactEmail: string; locale: string; currency: string; jurisdiction: string; email: string } }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, { status: "idle" });
  const bad = (k: string) => state.fields?.includes(k);
  return (
    <form action={action} className="card space-y-4 p-6">
      <p className="text-sm text-ink/55" dir="ltr">{u.email}</p>
      <div>
        <label className="label" htmlFor="name">{d.fName}</label>
        <input id="name" name="name" className="input" defaultValue={u.name} />
      </div>
      <div>
        <label className="label" htmlFor="company">{d.fCompany}</label>
        <input id="company" name="company" className="input" defaultValue={u.company} />
      </div>
      <div>
        <label className="label" htmlFor="contactEmail">{d.fContactEmail}</label>
        <input id="contactEmail" name="contactEmail" type="email" dir="ltr" className={`input ${bad("contactEmail") ? "border-red-400" : ""}`} defaultValue={u.contactEmail} />
        <p className="hint">{d.hContactEmail}</p>
        {bad("contactEmail") && <p className="err">{d.errEmail}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="locale">{d.fLocale}</label>
          <select id="locale" name="locale" className="input" defaultValue={u.locale}>
            {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="currency">{d.fCurrency}</label>
          <select id="currency" name="currency" className="input" defaultValue={u.currency}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="jurisdiction">{d.fDefaultJurisdiction}</label>
          <select id="jurisdiction" name="jurisdiction" className="input" defaultValue={u.jurisdiction}>
            {JURISDICTIONS.map((j) => <option key={j} value={j}>{d[`j${j}` as keyof Dict]}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? d.loading : d.save}</button>
        {state.status === "saved" && <span className="text-sm font-semibold text-mint">✓ {d.saved}</span>}
      </div>
    </form>
  );
}
