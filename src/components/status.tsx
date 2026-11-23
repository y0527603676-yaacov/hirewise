import type { Report, Submission } from "@/lib/schema";
import type { T } from "@/i18n";

/** One badge that says where a candidate stands: in progress, report pending, locked with a match teaser, or open */
export function StatusBadge({ t, sub, report }: { t: T; sub: Submission; report: Report | null }) {
  if (sub.status === "IN_PROGRESS") return <span className="badge bg-sky-50 text-sky-700">{t("stInProgress")}</span>;
  if (sub.status === "EXPIRED") return <span className="badge bg-ink/5 text-ink/50">{t("stExpired")}</span>;
  if (report) {
    const tone = report.overallScore >= 75 ? "bg-mint/10 text-mint" : report.overallScore >= 50 ? "bg-brand/10 text-brand" : "bg-amber-50 text-amber-700";
    return (
      <span className="flex items-center gap-1.5">
        <span className={`badge ${tone}`}>{report.overallScore}%</span>
        {!report.isUnlocked && <span className="badge bg-ink/5 text-ink/55">🔒 {t("evLocked")}</span>}
      </span>
    );
  }
  if (sub.evalStatus === "DEFERRED") return <span className="badge bg-amber-50 text-amber-700">{t("evDeferred")}</span>;
  if (sub.evalStatus === "FAILED" && sub.evalAttempts >= 4) return <span className="badge bg-red-50 text-red-700">{t("evFailed")}</span>;
  return <span className="badge bg-indigo-50 text-brand">{t("evPending")}</span>;
}
