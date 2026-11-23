"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { createJobAction } from "@/app/actions";
import type { Dict } from "@/i18n/en";

type F = Record<string, string>;
const TEXTS_ROLE = ["title", "department", "responsibilities", "requiredSkills"] as const;
const TEXTS_CULT = ["teamDynamics", "criticalTraits", "nonNegotiables", "behavioralRedLines"] as const;
const REQUIRED = ["title", "responsibilities", "requiredSkills", "criticalTraits", "behavioralRedLines"];
const LABEL: Record<string, keyof Dict> = {
  title: "fTitle", department: "fDepartment", responsibilities: "fResponsibilities", requiredSkills: "fRequiredSkills",
  teamDynamics: "fTeamDynamics", criticalTraits: "fCriticalTraits", nonNegotiables: "fNonNegotiables", behavioralRedLines: "fBehavioralRedLines",
};
const HINT: Partial<Record<string, keyof Dict>> = {
  responsibilities: "hResponsibilities", requiredSkills: "hRequiredSkills", teamDynamics: "hTeamDynamics", criticalTraits: "hCriticalTraits",
  nonNegotiables: "hNonNegotiables", behavioralRedLines: "hBehavioralRedLines",
};

type Issue = { field: string; quote: string; category: string; explanation: string; suggestion: string };

export function JobWizard({ d, defaultJurisdiction, basis }: { d: Dict; defaultJurisdiction: string; basis: Record<string, string> }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<F>({ employmentType: "full", locationType: "onsite", jurisdiction: defaultJurisdiction, paceOfWork: "dynamic", pressureLevel: "medium", autonomyVsSupervision: "balanced" });
  const [missing, setMissing] = useState<string[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const chips = (k: string, opts: [string, keyof Dict][]) => (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {opts.map(([v, label]) => (
        <button type="button" key={v} role="radio" aria-checked={f[k] === v} onClick={() => set(k, v)} className={`chip ${f[k] === v ? "chip-on" : ""}`}>
          {d[label]}
        </button>
      ))}
    </div>
  );

  const text = (k: string) => {
    const multi = k !== "title" && k !== "department";
    const bad = missing.includes(k);
    const flagged = issues.filter((i) => i.field === k);
    return (
      <div>
        <label className="label" htmlFor={k}>
          {d[LABEL[k]]} {!REQUIRED.includes(k) && <span className="font-normal text-ink/40">({d.optional})</span>}
        </label>
        {multi ? (
          <textarea id={k} rows={3} className={`input min-h-[88px] ${bad || flagged.length ? "border-red-400" : ""}`} value={f[k] || ""} onChange={(e) => set(k, e.target.value)} />
        ) : (
          <input id={k} className={`input ${bad || flagged.length ? "border-red-400" : ""}`} value={f[k] || ""} onChange={(e) => set(k, e.target.value)} />
        )}
        {HINT[k] && <p className="hint">{d[HINT[k]!]}</p>}
        {bad && <p className="err">{d.fieldRequired}</p>}
        {flagged.map((i, n) => (
          <div key={n} className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-800">
            <b>“{i.quote}”</b> {i.explanation}
            {i.suggestion && <div className="mt-1 text-red-900/80">{d.suggestion}: {i.suggestion}</div>}
          </div>
        ))}
      </div>
    );
  };

  const missingIn = (keys: readonly string[]) => keys.filter((k) => REQUIRED.includes(k) && (f[k] || "").trim().length < 2);

  const go = (n: number) => {
    const m = step === 0 && n > 0 ? missingIn(TEXTS_ROLE) : step === 1 && n > 1 ? missingIn(TEXTS_CULT) : [];
    setMissing(m);
    if (!m.length) {
      setStep(n);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const submit = () =>
    start(async () => {
      setErr("");
      setIssues([]);
      const r = await createJobAction(f);
      if (r.ok) return router.push(`/app/jobs/${r.jobId}`);
      if (r.code === "missing") {
        setMissing(r.fields);
        setStep(r.fields.some((x) => (TEXTS_ROLE as readonly string[]).includes(x)) ? 0 : 1);
      } else if (r.code === "compliance") {
        setIssues(r.issues);
        setStep(r.issues.some((x) => (TEXTS_ROLE as readonly string[]).includes(x.field)) ? 0 : 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else setErr(r.code === "ai_off" ? d.aiOff : d.errGeneric);
    });

  const steps = [d.stepRole, d.stepCulture, d.stepReview];
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="h1">{d.wizTitle}</h1>
      <ol className="mt-5 flex gap-2">
        {steps.map((s, i) => (
          <li key={s} className={`flex-1 rounded-full py-1.5 text-center text-xs font-bold ${i === step ? "bg-brand text-white" : i < step ? "bg-brand/15 text-brand" : "bg-ink/5 text-ink/40"}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {issues.length > 0 && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" />{d.complianceTitle}</div>
          <p className="mt-1">{d.complianceD}</p>
          <p className="mt-1 text-xs text-red-800/70">{d.complianceBasis.replace("{basis}", basis[f.jurisdiction] || "")}</p>
        </div>
      )}

      <div className="card mt-5 space-y-5 p-6">
        {step === 0 && (
          <>
            {text("title")}
            {text("department")}
            <div>
              <span className="label">{d.fEmploymentType}</span>
              {chips("employmentType", [["full", "etFull"], ["part", "etPart"], ["contract", "etContract"], ["intern", "etIntern"]])}
            </div>
            <div>
              <span className="label">{d.fLocationType}</span>
              {chips("locationType", [["onsite", "ltOnsite"], ["hybrid", "ltHybrid"], ["remote", "ltRemote"]])}
            </div>
            <div>
              <span className="label">{d.fJurisdiction}</span>
              {chips("jurisdiction", [["IL", "jIL"], ["US", "jUS"], ["EU", "jEU"], ["UK", "jUK"], ["GLOBAL", "jGLOBAL"]])}
            </div>
            {text("responsibilities")}
            {text("requiredSkills")}
          </>
        )}
        {step === 1 && (
          <>
            <div>
              <span className="label">{d.fPaceOfWork}</span>
              {chips("paceOfWork", [["steady", "paceSteady"], ["dynamic", "paceDynamic"], ["intense", "paceIntense"]])}
            </div>
            <div>
              <span className="label">{d.fPressureLevel}</span>
              {chips("pressureLevel", [["low", "pressureLow"], ["medium", "pressureMedium"], ["high", "pressureHigh"]])}
            </div>
            <div>
              <span className="label">{d.fAutonomy}</span>
              {chips("autonomyVsSupervision", [["close", "autClose"], ["balanced", "autBalanced"], ["full", "autFull"]])}
            </div>
            {text("teamDynamics")}
            {text("criticalTraits")}
            {text("nonNegotiables")}
            {text("behavioralRedLines")}
          </>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {[...TEXTS_ROLE, ...TEXTS_CULT].filter((k) => (f[k] || "").trim()).map((k) => (
                <div key={k} className={k === "title" || k === "department" ? "" : "sm:col-span-2"}>
                  <dt className="font-semibold text-ink/55">{d[LABEL[k]]}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap">{f[k]}</dd>
                </div>
              ))}
            </dl>
            <p className="rounded-xl bg-brand/[0.05] p-4 text-sm leading-relaxed text-ink/75"><Sparkles className="me-1 inline h-4 w-4 text-brand" />{d.reviewNote}</p>
            {err && <p className="err">{err}</p>}
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        {step > 0 ? <button type="button" className="btn-outline" onClick={() => go(step - 1)} disabled={pending}>{d.back}</button> : <span />}
        {step < 2 ? (
          <button type="button" className="btn-primary" onClick={() => go(step + 1)}>{d.next}</button>
        ) : (
          <button type="button" className="btn-primary px-6" onClick={submit} disabled={pending}>
            {pending ? <><Loader2 className="h-4 w-4 animate-spin" />{d.generating}</> : <><Sparkles className="h-4 w-4" />{d.generate}</>}
          </button>
        )}
      </div>
    </div>
  );
}
