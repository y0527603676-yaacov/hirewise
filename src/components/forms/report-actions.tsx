"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Printer, RefreshCw } from "lucide-react";
import { retryAction, unlockAction } from "@/app/actions";

export function UnlockButton({ subId, label, noCredits }: { subId: string; label: string; noCredits: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <div>
      <button
        type="button"
        className="btn-primary px-6 py-3"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await unlockAction(subId);
            if (r === "no_credits") setErr(noCredits);
            else router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        {label}
      </button>
      {err && <p className="err">{err}</p>}
    </div>
  );
}

/** While a report is being prepared: asks the server to run it now, then refreshes until it is ready */
export function PendingWatcher({ subId }: { subId: string }) {
  const router = useRouter();
  useEffect(() => {
    let stop = false;
    fetch(`/api/eval/${subId}`, { method: "POST" })
      .catch(() => {})
      .finally(() => !stop && router.refresh());
    const iv = setInterval(() => !stop && router.refresh(), 8000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [subId, router]);
  return <Loader2 className="h-6 w-6 animate-spin text-brand" />;
}

export function RetryButton({ subId, label }: { subId: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn-outline" disabled={pending} onClick={() => start(async () => { await retryAction(subId); router.refresh(); })}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      {label}
    </button>
  );
}

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn-outline no-print" onClick={() => window.print()}>
      <Printer className="h-4 w-4" />{label}
    </button>
  );
}
