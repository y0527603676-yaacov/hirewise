import { createHmac, timingSafeEqual } from "crypto";

/** Verifies a Paddle Billing webhook: header "Paddle-Signature: ts=<unix>;h1=<hex hmac of `${ts}:${body}`>" */
export function verifyPaddleSignature(header: string | null, rawBody: string, secret: string, now = Date.now(), toleranceSec = 300): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(";").map((p) => p.split("=").map((s) => s.trim()) as [string, string]));
  const ts = Number(parts.ts);
  if (!ts || !parts.h1 || Math.abs(now / 1000 - ts) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(parts.h1));
  return a.length === b.length && timingSafeEqual(a, b);
}
