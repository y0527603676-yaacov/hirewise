import { NextResponse } from "next/server";
import { isLocale } from "@/i18n";
import { LANG_COOKIE } from "@/lib/locale";

/** Sets the visitor's language and returns to the page they came from (same-site paths only) */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const l = url.searchParams.get("l");
  let next = url.searchParams.get("next") || "/";
  if (!next.startsWith("/") || next.startsWith("//")) next = "/";
  const res = NextResponse.redirect(new URL(next, req.url));
  if (isLocale(l)) res.cookies.set(LANG_COOKIE, l, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
  return res;
}
