import { AlertTriangle, CheckCircle2, Clock, MessageSquareQuote, ShieldCheck } from "lucide-react";
import { ScoreRing, Notice } from "./ui";
import type { T } from "@/i18n";
import type { IntegrityFlag, IntegrityLevel } from "@/lib/core/integrity";

export type ReportData = {
  name: string;
  role: string;
  answeredIn: string;
  submitted: string;
  overall: number; competence: number; culture: number; reliability: number;
  summary: string;
  strengths: { title: string; evidence: string }[];
  redFlags: { title: string; evidence: string; severity: "low" | "medium" | "high" }[];
  interview: { question: string; why: string }[];
  integrity: { level: IntegrityLevel; flags: IntegrityFlag[]; note?: string; accommodation?: boolean };
  questions: { id: string; title: string; prompt: string; answer: string; seconds: number; score?: number; note?: string; timedOut?: boolean; choice?: { best?: string; worst?: string; key?: string } }[];
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function ReportView({ t, r }: { t: T; r: ReportData }) {
  const sev = { low: "bg-amber-50 text-amber-700", medium: "bg-orange-50 text-orange-700", high: "bg-red-50 text-red-700" };
  const sevLabel = { low: t("sevLow"), medium: t("sevMedium"), high: t("sevHigh") };
  const intTone = { clean: "ok", minor: "warn", review: "error" } as const;
  const intLabel = { clean: t("intClean"), minor: t("intMinor"), review: t("intReview") };
  return (
    <div className="space-y-5">
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="h1">{r.name}</h1>
            <p className="mt-1 text-sm text-ink/55">{r.role} · {r.answeredIn} · {r.submitted}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ScoreRing value={r.overall} label={t("overall")} size={104} />
          <ScoreRing value={r.competence} label={t("competence")} />
          <ScoreRing value={r.culture} label={t("cultureFit")} />
          <ScoreRing value={r.reliability} label={t("reliability")} />
        </div>
        <p className="mt-5 text-xs text-ink/50">{t("repHuman")}</p>
      </div>

      <div className="card">
        <h2 className="h2">{t("execSummary")}</h2>
        <p dir="auto" className="mt-2 leading-relaxed text-ink/80">{r.summary}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="card">
          <h2 className="h2 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-mint" />{t("strengths")}</h2>
          <ul className="mt-3 space-y-3">
            {r.strengths.map((s, i) => (
              <li key={i}>
                <div className="font-semibold">{s.title}</div>
                <p dir="auto" className="mt-0.5 text-sm italic text-ink/60">“{s.evidence}”</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2 className="h2 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warn" />{t("redFlags")}</h2>
          {r.redFlags.length === 0 ? (
            <p className="mt-3 text-sm text-ink/50">—</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {r.redFlags.map((s, i) => (
                <li key={i}>
                  <div className="flex flex-wrap items-center gap-2 font-semibold">{s.title}<span className={`badge ${sev[s.severity]}`}>{sevLabel[s.severity]}</span></div>
                  <p dir="auto" className="mt-0.5 text-sm italic text-ink/60">“{s.evidence}”</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="h2 flex items-center gap-2"><MessageSquareQuote className="h-5 w-5 text-brand" />{t("interviewQ")}</h2>
        <ol className="mt-3 list-decimal space-y-3 ps-5">
          {r.interview.map((q, i) => (
            <li key={i}>
              <div className="font-semibold">{q.question}</div>
              <div className="text-sm text-ink/55">{q.why}</div>
            </li>
          ))}
        </ol>
      </div>

      <div className="card">
        <h2 className="h2 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-ink/60" />{t("integritySignals")}</h2>
        <div className="mt-3 space-y-2">
          <Notice tone={intTone[r.integrity.level]}>
            <b>{intLabel[r.integrity.level]}</b>
            {r.integrity.flags.length > 0 && (
              <ul className="mt-1 list-disc ps-5">
                {r.integrity.flags.map((f) => <li key={f.code}>{t(`flag${f.code}` as never, { n: f.count })}</li>)}
              </ul>
            )}
          </Notice>
          {r.integrity.note && <p className="text-sm text-ink/65">{r.integrity.note}</p>}
          {r.integrity.accommodation && <Notice>{t("accommodationUsed")}</Notice>}
          <p className="text-xs text-ink/50">{t("intContext")}</p>
        </div>
      </div>

      <div className="card">
        <h2 className="h2">{t("perQuestion")}</h2>
        <ol className="mt-3 space-y-4">
          {r.questions.map((q, i) => (
            <li key={q.id} className="rounded-xl border border-ink/[0.07] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold">{i + 1}. {q.title}</h3>
                <span className="flex items-center gap-2 text-xs text-ink/55">
                  {typeof q.score === "number" && <span className="badge bg-brand/10 text-brand">{q.score}</span>}
                  <Clock className="h-3.5 w-3.5" />{t("timeUsed", { s: fmt(q.seconds) })}{q.timedOut ? " ⏱" : ""}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink/55">{q.prompt}</p>
              {q.choice ? (
                <dl className="mt-2 space-y-1 rounded-lg bg-mist p-3 text-sm">
                  <div><dt className="inline font-semibold text-mint">{t("repBest")}: </dt><dd dir="auto" className="inline">{q.choice.best || t("repNoPick")}</dd></div>
                  <div><dt className="inline font-semibold text-warn">{t("repWorst")}: </dt><dd dir="auto" className="inline">{q.choice.worst || t("repNoPick")}</dd></div>
                  {q.choice.key && q.choice.key !== q.choice.best && <div className="text-ink/55"><dt className="inline">{t("repKey")}: </dt><dd dir="auto" className="inline">{q.choice.key}</dd></div>}
                </dl>
              ) : (
                <blockquote dir="auto" className="mt-2 whitespace-pre-wrap rounded-lg bg-mist p-3 text-sm leading-relaxed">{q.answer || "—"}</blockquote>
              )}
              {q.note && <p dir="auto" className="mt-2 text-sm text-ink/70">{q.note}</p>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
