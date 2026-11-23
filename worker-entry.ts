// @ts-nocheck
/**
 * Worker entry: the site itself (OpenNext) plus a scheduler.
 * The scheduler calls an internal URL protected by a secret, so all logic stays in the site code.
 */
import handler, { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge };

export default {
  fetch: handler.fetch,
  async scheduled(_event, env, ctx) {
    const secret = env.CRON_SECRET || env.PAYMENT_HOOK_SECRET || "";
    if (!secret) return;
    const base = (env.APP_URL || "https://hire.clearwise.me").replace(/\/+$/, "");
    ctx.waitUntil(handler.fetch(new Request(`${base}/api/cron/${encodeURIComponent(secret)}`), env, ctx));
  },
};
