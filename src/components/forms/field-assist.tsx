"use client";
/**
 * Helps an employer fill one wizard field: dictate (browser speech recognition, no install), then let the AI
 * phrase it. Up to three suggestions; after three rejections, type freely or upload a document about the business.
 * Where the browser has no speech recognition (or the microphone is blocked), it points to the keyboard's own microphone.
 */
import { useEffect, useRef, useState } from "react";
import { Check, FileUp, Loader2, Mic, RefreshCw, Sparkles, Square } from "lucide-react";
import { suggestFieldAction } from "@/app/actions";
import type { Dict } from "@/i18n/en";

type SR = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
const SPEECH_LANG: Record<string, string> = { he: "he-IL", en: "en-US", es: "es-ES", fr: "fr-FR", de: "de-DE", ar: "ar-SA" };
const MAX_ROUNDS = 3;

export function FieldAssist({ field, value, onChange, d, locale, jurisdiction, context }: { field: string; value: string; onChange: (v: string) => void; d: Dict; locale: string; jurisdiction: string; context: Record<string, string> }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(true);
  const [suggestion, setSuggestion] = useState("");
  const [previous, setPrevious] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [giveUp, setGiveUp] = useState(false);
  const rec = useRef<SR | null>(null);
  const base = useRef("");
  const latest = useRef(value);
  latest.current = value;
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => rec.current?.stop();
  }, []);

  const suggest = async (prev: string[], document?: { mediaType: string; data: string; name: string }) => {
    setBusy(true);
    setNote("");
    try {
      const r = await suggestFieldAction({ field, raw: latest.current, context, previous: prev, jurisdiction, document });
      if (r.ok) {
        setSuggestion(r.text);
        setGiveUp(false);
      } else setNote(r.code === "limit" ? d.asLimit : r.code === "bad_file" ? d.asBadFile : r.code === "ai_off" ? d.aiOff : d.errGeneric);
    } catch {
      setNote(d.errGeneric);
    } finally {
      setBusy(false);
    }
  };

  const startMic = () => {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return setSupported(false);
    const r = new Ctor();
    r.lang = SPEECH_LANG[locale] || "en-US";
    r.continuous = true;
    r.interimResults = true;
    base.current = latest.current ? latest.current.trimEnd() + " " : "";
    r.onresult = (e) => {
      let fin = "";
      let tmp = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript;
        else tmp += res[0].transcript;
      }
      if (fin) {
        base.current = (base.current + fin).replace(/\s+/g, " ") + " ";
        onChange(base.current.trimEnd());
      }
      setInterim(tmp);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setNote(d.asMicDenied);
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
      rec.current = null;
      // After speaking, offer a phrasing straight away
      if (latest.current.trim().length >= 8) suggest(previous);
    };
    rec.current = r;
    setNote("");
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
      setNote(d.asMicDenied);
    }
  };

  const reject = () => {
    const prev = [...previous, suggestion];
    setPrevious(prev);
    setSuggestion("");
    if (prev.length >= MAX_ROUNDS) setGiveUp(true);
    else suggest(prev);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setNote(d.asBadFile);
    const mediaType = f.type || (f.name.endsWith(".txt") ? "text/plain" : "");
    let data: string;
    if (mediaType.startsWith("text/")) data = await f.text();
    else {
      const buf = new Uint8Array(await f.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      data = btoa(bin);
    }
    setPrevious([]);
    suggest([], { mediaType, data, name: f.name });
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {supported ? (
          listening ? (
            <button type="button" onClick={() => rec.current?.stop()} className="btn bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700">
              <Square className="h-3.5 w-3.5" />{d.asStop}
            </button>
          ) : (
            <button type="button" onClick={startMic} disabled={busy} className="btn-outline px-3 py-1.5 text-xs">
              <Mic className="h-3.5 w-3.5" />{d.asMic}
            </button>
          )
        ) : (
          <span className="text-xs text-ink/50">{d.asMicNone}</span>
        )}
        <button type="button" onClick={() => suggest(previous)} disabled={busy || listening || (!value.trim() && !Object.values(context).some((v) => v?.trim()))} className="btn-outline px-3 py-1.5 text-xs">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-brand" />}
          {busy ? d.asSuggesting : d.asSuggest}
        </button>
      </div>
      {listening && (
        <p className="flex items-center gap-2 text-xs font-medium text-red-600" aria-live="polite">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />{d.asListening} {interim && <span className="text-ink/50">{interim}</span>}
        </p>
      )}
      {suggestion && (
        <div className="rounded-xl border border-brand/25 bg-brand/[0.04] p-3">
          <div className="text-xs font-bold text-brand">{d.asSuggestion}</div>
          <p dir="auto" className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{suggestion}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={() => { onChange(suggestion); setSuggestion(""); setPrevious([]); }}>
              <Check className="h-3.5 w-3.5" />{d.asAccept}
            </button>
            <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={reject} disabled={busy}>
              <RefreshCw className="h-3.5 w-3.5" />{d.asAnother}
            </button>
          </div>
        </div>
      )}
      {giveUp && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{d.asGiveUp}</p>
          <input ref={fileRef} type="file" accept="application/pdf,image/*,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <button type="button" className="btn-outline mt-2 px-3 py-1.5 text-xs" onClick={() => fileRef.current?.click()} disabled={busy}>
            <FileUp className="h-3.5 w-3.5" />{d.asUpload}
          </button>
        </div>
      )}
      {note && <p className="text-xs font-medium text-amber-700">{note}</p>}
    </div>
  );
}
