// Shared outbound HTTP helper. Every external call carries a custom User-Agent
// (handoff §10), a timeout, and surfaces non-2xx as throwable errors so callers
// can back off and serve stale.

export const USER_AGENT =
  process.env.AIRSPACE_USER_AGENT ||
  "airspace-dashboard/1.0 (personal; +https://github.com/personal/airspace-dashboard)";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

export interface FetchOpts {
  timeoutMs?: number;
  headers?: Record<string, string>;
  // pass-through for non-GET if ever needed
  init?: RequestInit;
}

export async function fetchJson<T>(url: string, opts: FetchOpts = {}): Promise<T> {
  const res = await fetchWithTimeout(url, {
    timeoutMs: opts.timeoutMs ?? 8000,
    headers: { Accept: "application/json", ...opts.headers },
    init: opts.init,
  });
  if (!res.ok) {
    throw new HttpError(res.status, `${url} -> HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchWithTimeout(
  url: string,
  opts: FetchOpts = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);
  try {
    return await fetch(url, {
      ...opts.init,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        ...opts.headers,
        ...(opts.init?.headers as Record<string, string> | undefined),
      },
      // never let Next cache live data at the fetch layer; we cache explicitly
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}
