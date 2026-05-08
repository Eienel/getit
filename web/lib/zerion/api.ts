// Thin Zerion API client. Direct adaptation of the auth and retry flow in
// /cli/utils/api/{auth.js,client.js}. The CLI's resolveApiKeyAuth() reads
// process.env.ZERION_API_KEY first; we honor the same contract here so we
// can deploy on Vercel with a plain env var.
//
// All HTTP behavior (Basic Auth, 429 backoff, JSON:API error surfacing) is
// preserved as-is.

const API_BASE = process.env.ZERION_API_BASE || "https://api.zerion.io/v1";
const MAX_429_RETRIES = 5;
const DEFAULT_429_BACKOFF_MS = 1000;

function getApiKey(): string {
  const k = process.env.ZERION_API_KEY;
  if (!k) {
    throw new Error(
      "ZERION_API_KEY is required. Get one at https://developers.zerion.io and set it in your Vercel env.",
    );
  }
  return k;
}

function basicAuthHeader(key: string): string {
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

function parseRetryDelayMs(response: Response): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const asNumber = Number(retryAfter);
    if (Number.isFinite(asNumber)) return Math.max(asNumber * 1000, DEFAULT_429_BACKOFF_MS);
    const asDate = Date.parse(retryAfter);
    if (Number.isFinite(asDate)) return Math.max(asDate - Date.now(), DEFAULT_429_BACKOFF_MS);
  }
  const reset = response.headers.get("ratelimit-reset");
  if (reset) {
    const asNumber = Number(reset);
    if (Number.isFinite(asNumber)) return Math.max(asNumber * 1000, DEFAULT_429_BACKOFF_MS);
  }
  return DEFAULT_429_BACKOFF_MS;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchZerion<T = unknown>(
  pathname: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const url = new URL(`${API_BASE}${pathname.startsWith("/") ? pathname : "/" + pathname}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, String(v));
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: basicAuthHeader(getApiKey()),
  };

  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    let response: Response;
    try {
      response = await fetch(url, { headers, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 429 && attempt < MAX_429_RETRIES) {
      const delay = parseRetryDelayMs(response);
      await response.text().catch(() => {});
      attempt += 1;
      await sleep(delay);
      continue;
    }

    const text = await response.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { _rawText: text.slice(0, 500) };
    }

    if (!response.ok) {
      const apiErr =
        Array.isArray((payload as { errors?: { detail?: string; title?: string }[] })?.errors)
          ? (payload as { errors: { detail?: string; title?: string }[] }).errors[0]
          : null;
      const detail = apiErr?.detail || apiErr?.title;
      const msg = `Zerion API error: ${response.status} ${response.statusText}${detail ? `. ${detail}` : ""}`;
      throw new Error(msg);
    }

    return payload as T;
  }
}

// Wallet positions/balances. Used to detect when the per-bequest deposit
// address has been funded.
export async function getWalletPositions(address: string, chain?: string) {
  const params: Record<string, string> = {
    "filter[trash]": "no_filter",
    "filter[positions]": "only_simple",
    currency: "usd",
  };
  if (chain) params["filter[chain_ids]"] = chain;
  return fetchZerion<{ data: Array<{ attributes: PositionAttrs; relationships?: unknown }> }>(
    `/wallets/${address}/positions/`,
    params,
  );
}

type PositionAttrs = {
  fungible_info?: { symbol?: string; name?: string; implementations?: Array<{ chain_id: string; address: string | null; decimals: number }> };
  quantity?: { numeric?: string; int?: string; decimals?: number };
  value?: number | null;
  chain?: string;
};
