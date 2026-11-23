/**
 * Email through Resend (HTTP). Without RESEND_API_KEY and MAIL_FROM nothing is sent.
 * TEST_EMAIL: when set, every email is delivered to that address instead (for testing).
 */
import { appUrl } from "./constants";
import { dirOf, type Locale } from "@/i18n";

export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function sendMail(m: { to: string; subject: string; html: string }): Promise<boolean> {
  if (!mailConfigured()) return false;
  try {
    const res = await fetch(process.env.MAIL_API_URL || "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [(process.env.TEST_EMAIL || "").trim() || m.to], subject: m.subject, html: m.html }),
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      console.error("mail failed", res.status, detail);
      await noteOps("mail", `"${m.subject}" (${res.status}): ${detail}`);
    }
    return res.ok;
  } catch (e) {
    console.error("mail error", e);
    await noteOps("mail", `"${m.subject}": ${String((e as Error)?.message || e).slice(0, 160)}`);
    return false;
  }
}

/** A simple branded email: title, paragraphs, one button */
export function mailHtml(locale: Locale, p: { lines: string[]; button?: { label: string; href: string }; foot?: string }) {
  const dir = dirOf(locale);
  const align = dir === "rtl" ? "right" : "left";
  return `<div dir="${dir}" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#101828;text-align:${align};max-width:560px">
<div style="font-size:20px;font-weight:bold;color:#4f46e5;margin-bottom:14px" dir="ltr">Hirewise <span style="font-size:12px;color:#8a8f98;font-weight:normal">by Clearwise</span></div>
${p.lines.map((l) => `<p style="margin:0 0 12px">${esc(l)}</p>`).join("")}
${p.button ? `<p style="margin:18px 0"><a href="${esc(p.button.href)}" style="background:#4f46e5;color:#fff;padding:11px 20px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block">${esc(p.button.label)}</a></p>` : ""}
${p.foot ? `<p style="color:#6b7280;font-size:13px">${esc(p.foot)}</p>` : ""}
<p style="color:#9ca3af;font-size:12px;margin-top:22px" dir="ltr">${esc(appUrl().replace(/^https?:\/\//, ""))}</p></div>`;
}

/** Operational problems are kept for the admin screen (not emailed, since email may be what failed) */
export async function noteOps(kind: string, text: string) {
  try {
    const { putSetting, getSetting } = await import("./db");
    const cur = JSON.parse((await getSetting("ops.log")) || "[]") as { at: number; kind: string; text: string }[];
    cur.unshift({ at: Date.now(), kind, text: text.slice(0, 300) });
    await putSetting("ops.log", JSON.stringify(cur.slice(0, 40)));
  } catch {}
}
