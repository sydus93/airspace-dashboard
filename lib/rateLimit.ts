// Single-flight lock + minimum upstream spacing (handoff §7).
//
// Guarantees: at most one in-flight upstream request at a time, and successive
// upstream requests are spaced >= minSpacingMs apart. Between upstream refreshes
// every caller receives the last cached frame. This is what keeps airplanes.live
// under 1 req/sec no matter how many browser tabs poll /api/traffic.
//
// On error we keep serving the last good value and flag it stale; repeated
// errors (e.g. 429) widen the spacing via exponential backoff.

export interface Cached<T> {
  value: T | null;
  fetchedAt: number; // epoch ms of last SUCCESSFUL fetch
  stale: boolean;
  error?: string;
}

export class SingleFlight<T> {
  private minSpacingMs: number;
  private maxBackoffMs: number;
  private lastStart = 0; // when the last upstream attempt began
  private lastSuccessAt = 0;
  private value: T | null = null;
  private inFlight: Promise<T> | null = null;
  private consecutiveErrors = 0;
  private lastError?: string;

  constructor(minSpacingMs: number, maxBackoffMs = 30_000) {
    this.minSpacingMs = minSpacingMs;
    this.maxBackoffMs = maxBackoffMs;
  }

  private currentSpacing(): number {
    if (this.consecutiveErrors === 0) return this.minSpacingMs;
    const backoff = this.minSpacingMs * Math.pow(2, this.consecutiveErrors);
    return Math.min(backoff, this.maxBackoffMs);
  }

  // staleAfterMs: how old a successful frame may be before we mark it stale.
  async get(
    fetcher: () => Promise<T>,
    staleAfterMs: number,
    now: number = Date.now()
  ): Promise<Cached<T>> {
    // Coalesce concurrent callers onto a single upstream request.
    if (this.inFlight) {
      try {
        await this.inFlight;
      } catch {
        /* fall through to cached snapshot below */
      }
      return this.snapshot(now, staleAfterMs);
    }

    const dueAt = this.lastStart + this.currentSpacing();
    if (now >= dueAt) {
      this.lastStart = now;
      this.inFlight = fetcher();
      try {
        const v = await this.inFlight;
        this.value = v;
        this.lastSuccessAt = now;
        this.consecutiveErrors = 0;
        this.lastError = undefined;
      } catch (err) {
        this.consecutiveErrors += 1;
        this.lastError = err instanceof Error ? err.message : String(err);
      } finally {
        this.inFlight = null;
      }
    }
    return this.snapshot(now, staleAfterMs);
  }

  private snapshot(now: number, staleAfterMs: number): Cached<T> {
    const ageOk = now - this.lastSuccessAt <= staleAfterMs;
    return {
      value: this.value,
      fetchedAt: this.lastSuccessAt,
      stale: !ageOk || this.consecutiveErrors > 0,
      error: this.lastError,
    };
  }
}
