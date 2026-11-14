// Rate limiting of sensitive endpoints (login, password reset, multi-factor challenges).

/** In-memory rate limiter: `max` attempts per window, per key. Fine for a single instance; use a shared store when running several. */
export class Throttle {
    private hits = new Map<string, number[]>();
    private max: number;
    private windowMs: number;
    constructor(max = 5, windowMs = 60_000) { this.max = max; this.windowMs = windowMs; }
    /** Records an attempt; returns 0 if allowed, otherwise the number of seconds to wait. */
    hit(key: string, now = Date.now()): number {
        const recent = (this.hits.get(key) ?? []).filter((at) => at > now - this.windowMs);
        if (recent.length >= this.max) { this.hits.set(key, recent); return Math.max(1, Math.ceil((recent[0] + this.windowMs - now) / 1000)); }
        recent.push(now);
        this.hits.set(key, recent);
        // Keep the store from growing forever.
        if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (!v.some((at) => at > now - this.windowMs)) this.hits.delete(k);
        return 0;
    }
    clear(key: string): void { this.hits.delete(key); }
    /** Whether the next attempt would be refused, without recording one. */
    tooManyAttempts(key: string, now = Date.now()): boolean { return this.availableIn(key, now) > 0; }
    /** Seconds before another attempt is allowed (0: allowed now), without recording one. */
    availableIn(key: string, now = Date.now()): number {
        const recent = (this.hits.get(key) ?? []).filter((at) => at > now - this.windowMs);
        return recent.length >= this.max ? Math.max(1, Math.ceil((recent[0] + this.windowMs - now) / 1000)) : 0;
    }
    /** Maximum attempts per window. */
    getMaxAttempts(): number { return this.max; }
}
