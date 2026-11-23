import { txByReturnKey } from "@/lib/payments";

/** Paddle opens its secure checkout on this page (the URL carries ?_ptxn=…). On completion we go to /paid/<key>. */
export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const tx = await txByReturnKey(key);
  const token = (process.env.PADDLE_CLIENT_TOKEN || "").replace(/[^A-Za-z0-9_-]/g, "");
  const sandbox = process.env.PADDLE_ENV !== "live";
  if (!tx || !token) return new Response("Not found", { status: 404 });
  const done = `/paid/${key}`;
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Hirewise · Checkout</title>
<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script></head>
<body style="font-family:system-ui,Arial,sans-serif;background:#f5f6fb;color:#101828;display:grid;place-items:center;min-height:100vh;margin:0">
<div style="text-align:center"><div style="font-weight:800;color:#4f46e5;font-size:22px">Hirewise</div><p>Secure checkout…</p></div>
<script>
${sandbox ? 'Paddle.Environment.set("sandbox");' : ""}
Paddle.Initialize({ token: ${JSON.stringify(token)}, checkout: { settings: { successUrl: location.origin + ${JSON.stringify(done)} } },
  eventCallback: function (ev) { if (ev && ev.name === "checkout.completed") setTimeout(function () { location.href = ${JSON.stringify(done)}; }, 1200); } });
</script></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}
