// Support for mounted actions of panel components: rate limiting, actions opened from the URL, parent action handles.
import type { Action } from '@navette-js/actions';

// ------------------------------------------------------------------ rate limiting (`Action.rateLimit()`)

/** Where action attempts are counted. The default store keeps them in memory: use a shared store when running several instances. */
export interface ActionRateLimitStore {
    /** Records an attempt if fewer than `maxAttempts` were made in the current window; returns 0, or the seconds until available. */
    attempt(key: string, maxAttempts: number, decaySeconds: number): number | Promise<number>;
    clear(key: string): void | Promise<void>;
}

/** Fixed-window counter, as Laravel's rate limiter: the window starts with the first attempt and lasts `decaySeconds`. */
export class MemoryActionRateLimitStore implements ActionRateLimitStore {
    private windows = new Map<string, { attempts: number; resetAt: number }>();
    attempt(key: string, maxAttempts: number, decaySeconds: number, now = Date.now()): number {
        let window = this.windows.get(key);
        if (!window || window.resetAt <= now) { window = { attempts: 0, resetAt: now + decaySeconds * 1000 }; this.windows.set(key, window); }
        if (window.attempts >= maxAttempts) return Math.max(1, Math.ceil((window.resetAt - now) / 1000));
        window.attempts++;
        // Keep the store from growing forever.
        if (this.windows.size > 10_000) for (const [k, w] of this.windows) if (w.resetAt <= now) this.windows.delete(k);
        return 0;
    }
    clear(key: string): void { this.windows.delete(key); }
}

let rateLimitStore: ActionRateLimitStore = new MemoryActionRateLimitStore();
/** Replaces the store counting the attempts of rate limited actions (Redis…, when several instances serve the panel). */
export function useActionRateLimitStore(store: ActionRateLimitStore): void { rateLimitStore = store; }
export function getActionRateLimitStore(): ActionRateLimitStore { return rateLimitStore; }

/**
 * Key of an action's rate limit, as Filament's: the IP address, the component class and the mounted actions (names,
 * arguments and contexts, without form data), so each record and each set of arguments has its own limit.
 */
export function actionRateLimitKey(componentClass: string, ip: string, mountedActions: { name: string; arguments?: unknown; context?: unknown }[]): string {
    const method = JSON.stringify(mountedActions.map(({ name, arguments: args, context }) => ({ name, arguments: args ?? {}, context: context ?? {} })));
    return `navette-action-rate-limiter:${componentClass}|${method}|${ip}`;
}

// ------------------------------------------------------------------ actions opened from the URL

/** URL parameters of the action to open when the page loads (Filament's `#[Url]` properties of `InteractsWithActions`). */
export type DefaultActionQuery = {
    action?: string; actionArguments?: Record<string, unknown>; actionContext?: Record<string, unknown>;
    tableAction?: string; tableActionRecord?: string; tableActionArguments?: Record<string, unknown>; actionComponent?: string;
};

const UNSAFE_KEY = /^(__proto__|constructor|prototype)$/;
const MAX_KEYS = 50;
const MAX_DEPTH = 4;
const MAX_VALUE_LENGTH = 1000;

/** `name[a][b]=value` parameters as a nested object (bounded in size and depth; unsafe keys are dropped). */
function bracketParameter(params: URLSearchParams, name: string): Record<string, unknown> | undefined {
    let found = false;
    const out: Record<string, unknown> = {};
    let count = 0;
    for (const [key, value] of params) {
        if (!key.startsWith(`${name}[`)) continue;
        const segments = [...key.slice(name.length).matchAll(/\[([^\[\]]*)\]/g)].map((m) => m[1]);
        // The whole key must be made of `[segment]` parts.
        if (segments.map((segment) => `[${segment}]`).join('') !== key.slice(name.length)) continue;
        if (!segments.length || segments.length > MAX_DEPTH || segments.some((segment) => segment === '' || UNSAFE_KEY.test(segment) || segment.length > 100)) continue;
        if (++count > MAX_KEYS) break;
        found = true;
        let node: Record<string, unknown> = out;
        for (const segment of segments.slice(0, -1)) {
            const next = node[segment];
            if (next === undefined || typeof next !== 'object' || next === null) node[segment] = {};
            node = node[segment] as Record<string, unknown>;
        }
        node[segments[segments.length - 1]] = value.slice(0, MAX_VALUE_LENGTH);
    }
    return found ? out : undefined;
}

/** A plain object from an already parsed query value (extended query parser), copied without unsafe keys. */
function plainObject(value: unknown, depth = 0): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value) || depth > MAX_DEPTH) return undefined;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, MAX_KEYS)) {
        if (UNSAFE_KEY.test(key)) continue;
        out[key] = typeof item === 'string' ? item.slice(0, MAX_VALUE_LENGTH) : plainObject(item, depth + 1) ?? null;
    }
    return out;
}

/** Reads the default action parameters of a request URL. Everything comes from the browser: values are only shaped here, the action is checked when it is mounted. */
export function readDefaultActionQuery(url: string | undefined, parsed: Record<string, unknown> = {}): DefaultActionQuery {
    const params = new URLSearchParams((url ?? '').split('?')[1]?.split('#')[0] ?? '');
    const scalar = (name: string): string | undefined => {
        const value = params.get(name);
        return value !== null && value !== '' && value.length <= 200 ? value : undefined;
    };
    const object = (name: string) => bracketParameter(params, name) ?? plainObject(parsed[name]);
    const out: DefaultActionQuery = {};
    const set = <K extends keyof DefaultActionQuery>(key: K, value: DefaultActionQuery[K] | undefined) => { if (value !== undefined) out[key] = value; };
    set('action', scalar('action'));
    set('actionArguments', object('actionArguments'));
    set('actionContext', object('actionContext'));
    set('tableAction', scalar('tableAction'));
    set('tableActionRecord', scalar('tableActionRecord'));
    set('tableActionArguments', object('tableActionArguments'));
    set('actionComponent', scalar('actionComponent'));
    return out;
}

/** Browser script removing the default action parameters from the address bar (once the action is closed). */
export function clearDefaultActionUrlScript(names: string[]): string {
    return `(() => { const url = new URL(window.location.href); for (const key of [...url.searchParams.keys()]) if (${JSON.stringify(names)}.some((name) => key === name || key.startsWith(name + '['))) url.searchParams.delete(key); window.history.replaceState(window.history.state, '', url.toString()); })()`;
}

// ------------------------------------------------------------------ parent actions (`ctx.parentAction`, `ctx.mountedActions`)

/** What a mounted action handle needs from its host component. */
export type MountedActionHost = {
    getMountedActionRawData(index: number): Record<string, unknown>;
    getMountedActionValidatedData(index: number): Promise<Record<string, unknown>>;
    fillMountedActionData(index: number, data: Record<string, unknown>): Promise<void>;
};

/**
 * An action currently mounted on the page (open modal), as seen by an action mounted on top of it: `ctx.parentAction`
 * (the direct parent) and `ctx.mountedActions` (every mounted action, from the first one).
 */
export class MountedAction {
    private readonly host: MountedActionHost;
    private readonly index: number;
    private readonly action: Action;
    private readonly args: Record<string, unknown>;
    constructor(host: MountedActionHost, index: number, action: Action, args: Record<string, unknown>) { this.host = host; this.index = index; this.action = action; this.args = args; }
    getAction(): Action { return this.action; }
    getName(): string { return this.action.getName(); }
    getNestingIndex(): number { return this.index; }
    /** The arguments the action was mounted with (as sent by the browser: check them). */
    getArguments(): Record<string, unknown> { return this.args; }
    /** The current state of its form, not validated (it has not been submitted). */
    getRawData(): Record<string, unknown> { return this.host.getMountedActionRawData(this.index); }
    /**
     * Its form state, validated with its rules. Invalid: the errors are shown in its modal and the running action is halted.
     * `mutateDataUsing()` and the form's hooks do not run.
     */
    getValidatedData(): Promise<Record<string, unknown>> { return this.host.getMountedActionValidatedData(this.index); }
    /** Changes fields of its form (nested objects or dot-notation keys); keys that are not fields of the form are ignored. */
    fillData(data: Record<string, unknown>): Promise<void> { return this.host.fillMountedActionData(this.index, data); }
}
