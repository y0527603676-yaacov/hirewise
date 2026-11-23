"use client";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { checkoutAction } from "@/app/actions";

type Pack = { id: string; credits: number; price: string; per: string };

export function BuyPacks({ packs, needPayer, labels }: { packs: Pack[]; needPayer: boolean; labels: { buy: string; pack: string; payerName: string; payerPhone: string; payerHint: string; errPayer: string; errOff: string; errGeneric: string } }) {
  const [sel, setSel] = useState(packs[1]?.id || packs[0]?.id);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {packs.map((p) => (
          <button type="button" key={p.id} onClick={() => setSel(p.id)} className={`chip p-4 text-start ${sel === p.id ? "chip-on" : ""}`}>
            <div className="text-sm font-bold">{labels.pack.replace("{n}", String(p.credits))}</div>
            <div className="mt-1 text-2xl font-extrabold text-ink" dir="ltr">{p.price}</div>
            <div className="mt-0.5 text-xs text-ink/50">{p.per}</div>
          </button>
        ))}
      </div>
      {needPayer && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pn">{labels.payerName}</label>
            <input id="pn" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
          <div>
            <label className="label" htmlFor="pp">{labels.payerPhone}</label>
            <input id="pp" className="input" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="05X-XXXXXXX" />
          </div>
          <p className="hint sm:col-span-2">{labels.payerHint}</p>
        </div>
      )}
      {err && <p className="err">{err}</p>}
      <button
        type="button"
        className="btn-primary px-8 py-3"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr("");
            const r = await checkoutAction({ pack: sel, fullName: name, phone });
            if (r.ok) window.location.href = r.url;
            else setErr(r.code === "payer" ? labels.errPayer : r.code === "payments_off" ? labels.errOff : labels.errGeneric);
          })
        }
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {labels.buy}
      </button>
    </div>
  );
}
