"use client";
import { useState } from "react";

/** Shows a secret only on demand, with a copy button (admin screen only) */
export function CopySecret({ value }: { value: string }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="rounded-lg bg-mist px-3 py-2 text-sm" dir="ltr">{show ? value : "•".repeat(24)}</code>
      <button type="button" className="btn-outline" onClick={() => setShow(!show)}>{show ? "הסתרה" : "הצגה"}</button>
      <button
        type="button"
        className="btn-primary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {}
        }}
      >
        {copied ? "הועתק ✓" : "העתקה"}
      </button>
    </div>
  );
}
