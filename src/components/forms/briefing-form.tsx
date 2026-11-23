"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlayCircle } from "lucide-react";
import { startAssessmentAction } from "@/app/actions";
import type { Dict } from "@/i18n/en";

export function BriefingForm({ d, slug, locale, gendered }: { d: Dict; slug: string; locale: string; gendered: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ fullName: "", email: "", phone: "", accommodation: false, consent: false, address: "" });
  const [bad, setBad] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setMsg("");
          const r = await startAssessmentAction(slug, { ...f, locale });
          if (r.ok) return router.push(`/a/${slug}/test`);
          if (r.code === "invalid") setBad(r.fields || []);
          else setMsg(r.code === "already" ? d.cAlready : r.code === "closed" ? d.cClosed : d.errGeneric);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="fn">{d.cFullName}</label>
          <input id="fn" className={`input ${bad.includes("fullName") ? "border-red-400" : ""}`} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} autoComplete="name" />
          {bad.includes("fullName") && <p className="err">{d.errName}</p>}
        </div>
        <div>
          <label className="label" htmlFor="em">{d.cEmail}</label>
          <input id="em" type="email" dir="ltr" className={`input ${bad.includes("email") ? "border-red-400" : ""}`} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" />
          {bad.includes("email") && <p className="err">{d.errEmail}</p>}
        </div>
        <div>
          <label className="label" htmlFor="ph">{d.cPhone} <span className="font-normal text-ink/40">({d.optional})</span></label>
          <input id="ph" type="tel" dir="ltr" className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" />
        </div>
      </div>
      {gendered && (
        <div>
          <span className="label">{d.cAddress}</span>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {([["m", d.cAddrM], ["f", d.cAddrF], ["", d.cAddrN]] as const).map(([v, l]) => (
              <button type="button" key={v || "n"} role="radio" aria-checked={f.address === v} onClick={() => setF({ ...f, address: v })} className={`chip ${f.address === v ? "chip-on" : ""}`}>{l}</button>
            ))}
          </div>
        </div>
      )}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink/10 bg-white p-3 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={f.accommodation} onChange={(e) => setF({ ...f, accommodation: e.target.checked })} />
        <span>{d.cAccommodation}</span>
      </label>
      <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${bad.includes("consent") ? "border-red-300 bg-red-50" : "border-ink/10 bg-white"}`}>
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />
        <span className="font-medium">{d.cConsent}</span>
      </label>
      {bad.includes("consent") && <p className="err">{d.errConsent}</p>}
      {msg && <p className="err">{msg}</p>}
      <button className="btn-primary w-full py-3.5 text-base" disabled={pending}>
        {pending ? <><Loader2 className="h-5 w-5 animate-spin" />{d.cPreparing}</> : <><PlayCircle className="h-5 w-5" />{d.cStart}</>}
      </button>
    </form>
  );
}
