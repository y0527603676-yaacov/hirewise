"use client";
import { useActionState } from "react";
import { requestLogin, type LoginState } from "@/app/actions";
import type { Dict } from "@/i18n/en";

export function LoginForm({ d }: { d: Pick<Dict, "email" | "sendLink" | "linkSent" | "tooMany" | "mailOff" | "errEmail" | "errGeneric" | "loading"> }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestLogin, { status: "idle" });
  if (state.status === "sent")
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900">
        {d.linkSent.replace("{email}", state.email || "")}
        {state.devLink && (
          <p className="mt-3 break-all" dir="ltr">
            <a className="font-semibold text-brand underline" href={state.devLink}>{state.devLink}</a>
          </p>
        )}
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">{d.email}</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" dir="ltr" placeholder="you@company.com" />
        {state.status === "invalid" && <p className="err">{d.errEmail}</p>}
        {state.status === "recent" && <p className="err">{d.tooMany}</p>}
        {state.status === "mail_off" && <p className="err">{d.mailOff}</p>}
        {state.status === "error" && <p className="err">{d.errGeneric}</p>}
      </div>
      <button className="btn-primary w-full py-3" disabled={pending}>{pending ? d.loading : d.sendLink}</button>
    </form>
  );
}
