import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Cloudflare bindings (wrangler.jsonc): the D1 database */
export interface D1Stmt {
  bind(...values: unknown[]): D1Stmt;
  run(): Promise<{ meta?: { changes?: number } }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}
export interface D1Like {
  prepare(sql: string): D1Stmt;
  batch(statements: D1Stmt[]): Promise<unknown>;
}

export async function cfEnv(): Promise<{ DB: D1Like }> {
  const { env } = await getCloudflareContext({ async: true });
  return env as unknown as { DB: D1Like };
}

/** Runs work after the response is sent (best effort; the scheduler retries anything unfinished) */
export async function background(p: Promise<unknown>) {
  try {
    const { ctx } = await getCloudflareContext({ async: true });
    ctx.waitUntil(p.catch((e) => console.error("background task failed", e)));
  } catch {
    p.catch(() => {});
  }
}
