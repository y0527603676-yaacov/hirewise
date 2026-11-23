"use client";
import { useState, useTransition } from "react";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { regenerateAction } from "@/app/actions";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/i18n";

export function CandidateLink({ base, defaultLang, labels }: { base: string; defaultLang: Locale; labels: { linkLang: string; copy: string; copied: string } }) {
  const [lang, setLang] = useState<Locale>(defaultLang);
  const [copied, setCopied] = useState(false);
  const url = `${base}?lang=${lang}`;
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input readOnly value={url} className="input font-mono text-sm" dir="ltr" onFocus={(e) => e.currentTarget.select()} aria-label="link" />
        <button
          type="button"
          className="btn-primary shrink-0"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {}
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? labels.copied : labels.copy}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-semibold text-ink/55">{labels.linkLang}:</span>
        {LOCALES.map((l) => (
          <button type="button" key={l} onClick={() => setLang(l)} className={`rounded-md px-2 py-1 font-medium ${l === lang ? "bg-ink text-white" : "bg-ink/5 text-ink/65 hover:bg-ink/10"}`}>
            {LOCALE_NAMES[l]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RegenerateButton({ jobId, label, errLocked, errGeneric }: { jobId: string; label: string; errLocked: string; errGeneric: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <div>
      <button
        type="button"
        className="btn-outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await regenerateAction(jobId);
            setErr(r === "ok" ? "" : r === "locked" ? errLocked : errGeneric);
          })
        }
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {label}
      </button>
      {err && <p className="err">{err}</p>}
    </div>
  );
}
