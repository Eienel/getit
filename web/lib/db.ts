import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../drizzle/schema";

// Single global pool — Vercel serverless will reuse the connection across
// invocations within the same lambda container. Build-time (Next collecting
// page data) does not have a real DATABASE_URL, so we lazy-init on first use.
declare global {
  // eslint-disable-next-line no-var
  var __pgClient: ReturnType<typeof postgres> | undefined;
}

function getClient() {
  if (global.__pgClient) return global.__pgClient;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Set it in your env (e.g. Neon/Vercel Postgres connection string).",
    );
  }
  const client = postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // required for some Postgres providers (Supabase pgbouncer, etc.)
  });
  global.__pgClient = client;
  return client;
}

// Lazy proxy: build-time tools (page data collection, type checks) can import
// `db` without a connection. Real queries must happen at runtime where
// DATABASE_URL is present.
function makeLazyDb() {
  let cached: ReturnType<typeof drizzle> | null = null;
  const target = {} as ReturnType<typeof drizzle>;
  return new Proxy(target, {
    get(_t, prop) {
      if (!cached) cached = drizzle(getClient(), { schema });
      const value = (cached as unknown as Record<string | symbol, unknown>)[prop as string];
      return typeof value === "function" ? (value as Function).bind(cached) : value;
    },
  });
}

export const db = makeLazyDb();
export { schema };
