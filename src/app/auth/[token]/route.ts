import { NextResponse } from "next/server";
import { consumeLoginToken } from "@/lib/auth";
import { LANG_COOKIE, visitorLocale } from "@/lib/locale";
import { dirOf, getT } from "@/i18n";

/**
 * Login link from the email (one use, 30 minutes).
 * Opening the link shows a button and the token is used only on the click (POST), because email security
 * scanners open links in advance and would otherwise burn the token before the person clicks.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await visitorLocale();
  const t = getT(locale);
  const safe = token.replace(/[^0-9a-f]/g, "");
  const nx = new URL(req.url).searchParams.get("next") || "";
  const nextQs = /^\/app(\/[A-Za-z0-9/_-]*)?$/.test(nx) ? `?next=${encodeURIComponent(nx)}` : "";
  return new Response(
    `<!doctype html><html lang="${locale}" dir="${dirOf(locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Hirewise</title></head>
<body style="font-family:system-ui,Arial,sans-serif;background:#f5f6fb;color:#101828;display:grid;place-items:center;min-height:100vh;margin:0">
<form method="post" action="/auth/${safe}${nextQs}" style="background:#fff;border-radius:20px;padding:32px;text-align:center;box-shadow:0 8px 24px -12px rgba(16,24,40,.15);max-width:360px;width:90%">
<div style="font-weight:800;font-size:22px;color:#4f46e5" dir="ltr">Hirewise</div>
<p style="color:#475467">${t("loginTitle")}</p>
<button style="background:#4f46e5;color:#fff;border:0;border-radius:12px;padding:12px 22px;font-size:16px;font-weight:700;cursor:pointer;width:100%">${t("mailLoginBtn")}</button>
</form></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" } },
  );
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await consumeLoginToken(token);
  if (!user) return NextResponse.redirect(new URL("/login?e=link", req.url), 303);
  const nx = new URL(req.url).searchParams.get("next") || "";
  const res = NextResponse.redirect(new URL(/^\/app(\/[A-Za-z0-9/_-]*)?$/.test(nx) ? nx : "/app", req.url), 303);
  res.cookies.set(LANG_COOKIE, user.locale, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
  return res;
}
