// Per-browser session data (persisted table filters, search and sort). The default store keeps it in memory.

/** Storage of small per-session values. Implement it to keep them in a database or a cache shared by several processes. */
export interface SessionStore {
    get(session: string, key: string): unknown | Promise<unknown>;
    set(session: string, key: string, value: unknown): void | Promise<void>;
}

/**
 * In-memory store: values are lost when the process restarts and are not shared between processes.
 * Sessions idle for longer than `ttl` are dropped, and the oldest sessions go first beyond `maxSessions`.
 */
export class MemorySessionStore implements SessionStore {
    private sessions = new Map<string, { at: number; values: Map<string, string> }>();
    private readonly options: { ttl?: number; maxSessions?: number; maxValueLength?: number };
    constructor(options: { ttl?: number; maxSessions?: number; maxValueLength?: number } = {}) { this.options = options; }
    private get ttl(): number { return this.options.ttl ?? 12 * 60 * 60 * 1000; }
    get(session: string, key: string): unknown {
        const entry = this.sessions.get(session);
        if (!entry || Date.now() - entry.at > this.ttl) { this.sessions.delete(session); return undefined; }
        const raw = entry.values.get(key);
        return raw === undefined ? undefined : JSON.parse(raw);
    }
    set(session: string, key: string, value: unknown): void {
        const raw = JSON.stringify(value ?? null);
        // Values come from the browser: an oversized one is not kept.
        if (raw.length > (this.options.maxValueLength ?? 64 * 1024)) return;
        const entry = this.sessions.get(session) ?? { at: Date.now(), values: new Map<string, string>() };
        entry.at = Date.now();
        entry.values.set(key, raw);
        // Most recently used last: re-inserting moves the session to the end.
        this.sessions.delete(session);
        this.sessions.set(session, entry);
        const max = this.options.maxSessions ?? 10000;
        while (this.sessions.size > max) this.sessions.delete(this.sessions.keys().next().value!);
    }
}
