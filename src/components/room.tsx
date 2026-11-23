"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Timer } from "lucide-react";
import type { Dict } from "@/i18n/en";
import type { RoomView } from "@/lib/candidate";

type Q = Extract<RoomView, { state: "question" }>;

export function Room({ d, slug }: { d: Dict; slug: string }) {
  const [view, setView] = useState<RoomView | null>(null);
  const [text, setText] = useState("");
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmShort, setConfirmShort] = useState(false);
  const [pick, setPick] = useState<{ most?: string; least?: string }>({});
  const pickRef = useRef<{ most?: string; least?: string }>({});
  const keys = useRef(0);
  const qid = useRef("");
  const deadline = useRef(0);
  const textRef = useRef("");
  const sending = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const api = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/c/${slug}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: body.action === "event" });
    return res.json();
  }, [slug]);

  const show = useCallback((v: RoomView) => {
    setView(v);
    if (v.state === "question") {
      if (v.question.id !== qid.current) {
        qid.current = v.question.id;
        setConfirmShort(false);
        pickRef.current = v.choice ?? {};
        setPick(v.choice ?? {});
        keys.current = v.keystrokes;
        textRef.current = v.draft;
        setText(v.draft);
      }
      deadline.current = Date.now() + v.remaining * 1000;
      setLeft(v.remaining);
    }
  }, []);

  useEffect(() => {
    api({ action: "state" }).then(show).catch(() => setView({ state: "none" }));
  }, [api, show]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 3500);
  };

  const next = useCallback(async () => {
    if (sending.current || !qid.current) return;
    sending.current = true;
    setBusy(true);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const v = await api({ action: "next", qid: qid.current, text: textRef.current, keystrokes: keys.current, choice: pickRef.current });
      show(v);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      flash(d.errGeneric);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }, [api, show, d.errGeneric]);

  // Countdown; at zero the answer as typed so far is submitted
  useEffect(() => {
    if (view?.state !== "question") return;
    const iv = setInterval(() => {
      const s = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setLeft(s);
      if (s === 0 && !sending.current) {
        flash(d.cTimeUp);
        next();
      }
    }, 250);
    return () => clearInterval(iv);
  }, [view, next, d.cTimeUp]);

  // Leaving the window is recorded once per absence
  useEffect(() => {
    if (view?.state !== "question") return;
    let away = false;
    const leave = () => {
      if (away) return;
      away = true;
      api({ action: "event", type: "blur" }).catch(() => {});
    };
    const back = () => {
      if (away) flash(d.cBlurWarn);
      away = false;
    };
    const vis = () => (document.hidden ? leave() : back());
    window.addEventListener("blur", leave);
    window.addEventListener("focus", back);
    document.addEventListener("visibilitychange", vis);
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("blur", leave);
      window.removeEventListener("focus", back);
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("beforeunload", warn);
    };
  }, [view?.state, api, d.cBlurWarn]);

  const onChange = (v: string) => {
    textRef.current = v;
    setText(v);
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const r = await api({ action: "save", qid: qid.current, text: textRef.current, keystrokes: keys.current });
        if (r?.ok) setSaved(true);
      } catch {}
    }, 1200);
  };

  const choose = (slot: "most" | "least", id: string) => {
    const next = { ...pickRef.current, [slot]: id };
    if (slot === "most" && next.least === id) delete next.least;
    if (slot === "least" && next.most === id) delete next.most;
    pickRef.current = next;
    setPick(next);
    api({ action: "save", qid: qid.current, text: "", keystrokes: 0, choice: next }).then((r) => r?.ok && setSaved(true)).catch(() => {});
  };

  const blockPaste = (e: React.ClipboardEvent | React.DragEvent) => {
    e.preventDefault();
    flash(d.cPasteBlocked);
    api({ action: "event", type: "paste" }).catch(() => {});
  };

  if (!view) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-brand" /></div>;
  if (view.state === "none") return <div className="card mt-10 text-center text-ink/60">{d.cClosed}</div>;
  if (view.state === "done")
    return (
      <div className="card mt-10 p-8 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-mint" />
        <h1 className="mt-4 text-2xl font-extrabold">{d.cDoneTitle.replace("{name}", view.name)}</h1>
        <p className="mt-2 text-ink/65">{d.cDoneD.replace("{company}", view.company)}</p>
      </div>
    );

  const q = view as Q;
  const pct = Math.max(0, Math.min(100, (left / q.limit) * 100));
  const low = left <= 30;
  const last = q.index === q.total - 1;
  return (
    <div className="space-y-4 pb-10">
      <div className="sticky top-0 z-10 -mx-4 border-b border-ink/[0.06] bg-mist/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-bold">{d.cQOf.replace("{i}", String(q.index + 1)).replace("{n}", String(q.total))}</span>
          <span className={`flex items-center gap-1.5 font-mono text-lg font-bold tabular-nums ${low ? "text-red-600" : "text-ink"}`} aria-live="polite" aria-label={d.cTimeLeft} dir="ltr">
            <Timer className="h-5 w-5" />{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10">
          <div className={`h-full rounded-full transition-all ${low ? "bg-red-500" : "bg-brand"}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex gap-1">
          {Array.from({ length: q.total }).map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < q.index ? "bg-mint" : i === q.index ? "bg-brand" : "bg-ink/10"}`} />)}
        </div>
      </div>

      {q.intro && <p className="rounded-xl bg-brand/[0.06] p-3 text-sm text-ink/75">{q.intro}</p>}

      <div className="card">
        <span className={`badge ${q.question.kind === "experience" ? "bg-mint/10 text-mint" : "bg-brand/10 text-brand"}`}>{q.question.kind === "experience" ? d.cKindExperience : q.question.kind === "choice" ? d.cKindChoice : d.cKindScenario}</span>
        <h1 className="mt-2 text-lg font-extrabold">{q.question.title}</h1>
        <p className="mt-3 whitespace-pre-wrap leading-relaxed text-ink/80">{q.question.scenario}</p>
        <p className="mt-4 font-bold">{q.question.prompt}</p>
      </div>

      {q.question.kind === "choice" ? (
        <div className="space-y-4">
          {([["most", d.cChooseBest], ["least", d.cChooseWorst]] as const).map(([slot, label]) => (
            <fieldset key={slot} className="card space-y-2">
              <legend className="px-1 text-sm font-bold">{label}</legend>
              {q.question.options.map((o) => {
                const on = pick[slot] === o.id;
                const other = pick[slot === "most" ? "least" : "most"] === o.id;
                return (
                  <button
                    type="button"
                    key={o.id}
                    role="radio"
                    aria-checked={on}
                    disabled={other}
                    onClick={() => choose(slot, o.id)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-start text-sm leading-relaxed transition ${on ? (slot === "most" ? "border-mint bg-mint/[0.07] ring-2 ring-mint/20" : "border-warn bg-orange-50 ring-2 ring-orange-200") : "border-ink/10 bg-white hover:border-ink/30"} ${other ? "opacity-40" : ""}`}
                  >
                    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] font-bold ${on ? "border-transparent bg-ink text-white" : "border-ink/25"}`}>{on ? "✓" : ""}</span>
                    <span dir="auto">{o.text}</span>
                  </button>
                );
              })}
            </fieldset>
          ))}
          <div className="h-4 text-xs text-ink/45">{pick.most && pick.least ? (saved ? `✓ ${d.cAutosaved}` : "") : d.cPickBoth}</div>
        </div>
      ) : (
      <div>
        <textarea
          className="input min-h-[220px] text-base leading-relaxed"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter" || e.key === "Delete" || e.key === "Process" || e.key === "Unidentified") keys.current++;
          }}
          onInput={(e) => {
            // Mobile keyboards and IMEs often skip keydown; count real typing from input events instead
            const ie = e.nativeEvent as InputEvent;
            if (ie.inputType && ie.inputType.startsWith("insert") && ie.inputType !== "insertFromPaste" && ie.inputType !== "insertFromDrop") keys.current += Math.max(1, (ie.data || "").length);
          }}
          onPaste={blockPaste}
          onDrop={blockPaste}
          autoComplete="off"
          autoCorrect="on"
          spellCheck
          placeholder={d.cAnswerPh}
          aria-label={q.question.prompt}
        />
        <div className="mt-1 flex justify-between gap-2 text-xs text-ink/45">
          <span>{d.cDetailTip}</span>
          <span className="shrink-0">{saved ? `✓ ${d.cAutosaved}` : ""}</span>
        </div>
      </div>
      )}

      {confirmShort ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p>{d.cShortWarn.replace("{t}", `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => { setConfirmShort(false); document.querySelector("textarea")?.focus(); }}>{d.back}</button>
            <button type="button" className="btn-outline" disabled={busy} onClick={next}>{last ? d.cFinish : d.cNext}</button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn-primary w-full py-3.5 text-base"
          disabled={busy || (q.question.kind === "choice" && !(pick.most && pick.least))}
          onClick={() => (q.question.kind !== "choice" && textRef.current.trim().length < 250 && left > 45 ? setConfirmShort(true) : next())}
        >
          {busy && <Loader2 className="h-5 w-5 animate-spin" />}
          {last ? d.cFinish : d.cNext}
        </button>
      )}

      {toast && (
        <div role="alert" className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-md items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />{toast}
        </div>
      )}
    </div>
  );
}
