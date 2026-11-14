// Realtime broadcasting: messages published on named channels and pushed to the browsers of the users subscribed to them.
// The default transport is in-process (one Node process). Several processes share messages through a `Broadcaster` adapter
// (Redis pub/sub, a hosted websockets service…). Browsers receive them over Server-Sent Events from the panel router.
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';

/** A message sent on a channel. `tenant` and `panel` restrict it to the pages of that tenant (its key) or that panel (its id). */
export type BroadcastMessage = { channel: string; event: string; data: unknown; tenant?: string | null; panel?: string | null };

/**
 * Transport of broadcast messages between the processes of the application. `publish()` sends a message to every process;
 * `subscribe()` receives the messages of one channel and returns a function that stops receiving them.
 * Each process subscribes once per channel, whatever the number of browsers listening to it.
 */
export interface Broadcaster {
    publish(message: BroadcastMessage): void | Promise<void>;
    subscribe(channel: string, listener: (message: BroadcastMessage) => void): () => void;
}

/** In-process transport: enough for an application running in a single Node process. */
export class MemoryBroadcaster implements Broadcaster {
    private listeners = new Map<string, Set<(message: BroadcastMessage) => void>>();
    publish(message: BroadcastMessage): void {
        // Listeners get a copy: a listener changing the message cannot affect the others.
        for (const listener of [...(this.listeners.get(message.channel) ?? [])]) listener(structuredClone(message));
    }
    subscribe(channel: string, listener: (message: BroadcastMessage) => void): () => void {
        const set = this.listeners.get(channel) ?? new Set();
        set.add(listener);
        this.listeners.set(channel, set);
        return () => { set.delete(listener); if (!set.size) this.listeners.delete(channel); };
    }
}

let broadcaster: Broadcaster = new MemoryBroadcaster();
/** Replaces the transport of broadcast messages (`new MemoryBroadcaster()` by default). Call it at startup, before serving requests. */
export function useBroadcaster(transport: Broadcaster): void { broadcaster = transport; hub.reset(); }
export function getBroadcaster(): Broadcaster { return broadcaster; }

/** Event of a flash notification sent live (`Notification.broadcast()`). */
export const NOTIFICATION_BROADCAST_EVENT = 'notification.broadcast';
/** Event telling the bell to fetch the user's database notifications again (`sendToDatabase(store, user, true)`). */
export const DATABASE_NOTIFICATIONS_SENT_EVENT = 'database-notifications.sent';

/** Something identifying a user: the user object (with an `id`) or the id itself. */
export type BroadcastRecipient = { id: string | number; receivesBroadcastNotificationsOn?: () => string } | string | number;

const CHANNEL = /^[A-Za-z0-9_.:@-]{1,200}$/;
/**
 * Private channel of a user. A user object may name its own with `receivesBroadcastNotificationsOn()`; otherwise it is
 * `<guard>.users.<id>`: `web.users.1` for the default auth guard. Panels with their own user table have their own guard,
 * hence their own channels.
 */
export function userBroadcastChannel(user: BroadcastRecipient, guard = 'web'): string {
    const channel = typeof user === 'object' && user !== null && typeof user.receivesBroadcastNotificationsOn === 'function'
        ? String(user.receivesBroadcastNotificationsOn())
        : `${guard}.users.${typeof user === 'object' && user !== null ? user.id : user}`;
    if (!CHANNEL.test(channel)) throw new Error(`Invalid broadcast channel: ${channel}`);
    return channel;
}

/** What a broadcast to users may be restricted to. `panel` also gives the auth guard of its users. */
export type BroadcastOptions = { guard?: string; tenant?: string | number | null; panel?: { getId(): string; getBroadcastChannel(user: BroadcastRecipient): string } | null };

/** Sends an event to the open pages of these users. */
export async function broadcastToUsers(users: BroadcastRecipient | BroadcastRecipient[], event: string, data: unknown, options: BroadcastOptions = {}): Promise<void> {
    for (const user of Array.isArray(users) ? users : [users]) {
        const channel = options.panel ? options.panel.getBroadcastChannel(user) : userBroadcastChannel(user, options.guard);
        await broadcaster.publish({ channel, event, data, tenant: options.tenant === undefined || options.tenant === null ? null : String(options.tenant), panel: options.panel ? options.panel.getId() : null });
    }
}

/** Tells the bell of these users to fetch their database notifications again. */
export function dispatchDatabaseNotificationsSent(users: BroadcastRecipient | BroadcastRecipient[], options: BroadcastOptions = {}): Promise<void> {
    return broadcastToUsers(users, DATABASE_NOTIFICATIONS_SENT_EVENT, {}, options);
}

type Entry = { id: string; seq: number; at: number; message: BroadcastMessage };
type ChannelState = { listeners: Set<(entry: Entry) => void>; unsubscribe: () => void; buffer: Entry[]; idle: ReturnType<typeof setTimeout> | null };

/**
 * Per-process fan-out: one subscription to the broadcaster per channel, shared by the streams of that channel. Recent messages
 * are kept for a short while, so a browser reconnecting with `Last-Event-ID` gets those it missed.
 */
class BroadcastHub {
    private channels = new Map<string, ChannelState>();
    private boot = randomBytes(6).toString('hex');
    private seq = 0;
    /** How long recent messages are kept, how many per channel, and how long an unused subscription is kept. */
    replayWindow = 2 * 60 * 1000;
    replaySize = 50;
    idleTimeout = 60 * 1000;

    listen(channel: string, listener: (entry: Entry) => void): () => void {
        let state = this.channels.get(channel);
        if (!state) {
            const created: ChannelState = { listeners: new Set(), buffer: [], idle: null, unsubscribe: () => {} };
            created.unsubscribe = broadcaster.subscribe(channel, (message) => {
                const entry: Entry = { id: `${this.boot}-${++this.seq}`, seq: this.seq, at: Date.now(), message };
                created.buffer.push(entry);
                while (created.buffer.length > this.replaySize || (created.buffer[0] && Date.now() - created.buffer[0].at > this.replayWindow)) created.buffer.shift();
                for (const fn of [...created.listeners]) fn(entry);
            });
            this.channels.set(channel, created);
            state = created;
        }
        const current = state;
        if (current.idle) { clearTimeout(current.idle); current.idle = null; }
        current.listeners.add(listener);
        return () => {
            current.listeners.delete(listener);
            if (current.listeners.size || current.idle) return;
            // Kept a little longer: a browser reconnecting soon after still finds the messages it missed.
            current.idle = setTimeout(() => {
                if (current.listeners.size || this.channels.get(channel) !== current) return;
                current.unsubscribe();
                this.channels.delete(channel);
            }, this.idleTimeout);
            current.idle.unref?.();
        };
    }
    /** Messages of a channel published after the given event id, if it comes from this process and is still kept. */
    since(channel: string, lastEventId: string): Entry[] {
        const match = /^([0-9a-f]{12})-(\d{1,15})$/.exec(lastEventId);
        if (!match || match[1] !== this.boot) return [];
        const after = Number(match[2]);
        return (this.channels.get(channel)?.buffer ?? []).filter((entry) => entry.seq > after && Date.now() - entry.at <= this.replayWindow);
    }
    /** Drops every subscription (the broadcaster was replaced). */
    reset(): void {
        for (const state of this.channels.values()) { if (state.idle) clearTimeout(state.idle); state.unsubscribe(); }
        this.channels.clear();
    }
}
const hub = new BroadcastHub();
/** Settings of the in-process fan-out (replay of missed messages on reconnection), for tests and tuning. */
export function getBroadcastHub(): { replayWindow: number; replaySize: number; idleTimeout: number } { return hub; }

/** Open streams per channel in this process: beyond the limit, the oldest one is closed. */
const openStreams = new Map<string, Set<() => void>>();
export const MAX_STREAMS_PER_CHANNEL = 20;

export type StreamOptions = {
    /** The user's channel. */
    channel: string;
    /** Key of the tenant of the page (only messages for no tenant or this one are sent), or `null`. */
    tenant: string | null;
    /** Id of the panel serving the stream (only messages for no panel or this one are sent). */
    panel: string;
    /** Called at every heartbeat: `false` closes the stream (the user signed out or lost access). */
    revalidate: () => Promise<boolean>;
    /** Interval of the keep-alive comments and session checks, in milliseconds. */
    heartbeat?: number;
};

/** Serves a Server-Sent Events stream of the messages of one user's channel. The caller has authenticated the request. */
export function streamBroadcasts(req: Request, res: Response, options: StreamOptions): void {
    const deliverable = (message: BroadcastMessage) => (message.tenant == null || message.tenant === options.tenant) && (message.panel == null || message.panel === options.panel);
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.flushHeaders();
    req.socket.setTimeout?.(0);
    req.socket.setNoDelay?.(true);
    let closed = false;
    const send = (entry: Entry) => {
        if (closed || !deliverable(entry.message)) return;
        // JSON never contains a raw line break: one `data:` line per message.
        res.write(`id: ${entry.id}\ndata: ${JSON.stringify({ channel: entry.message.channel, event: entry.message.event, data: entry.message.data })}\n\n`);
    };
    res.write('retry: 3000\n\n');
    const last = req.headers['last-event-id'];
    const stopListening = hub.listen(options.channel, send);
    if (typeof last === 'string') for (const entry of hub.since(options.channel, last)) send(entry);
    res.write(': connected\n\n');

    const streams = openStreams.get(options.channel) ?? new Set();
    openStreams.set(options.channel, streams);
    const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        stopListening();
        streams.delete(close);
        if (!streams.size) openStreams.delete(options.channel);
        res.end();
    };
    streams.add(close);
    while (streams.size > MAX_STREAMS_PER_CHANNEL) streams.values().next().value!();
    let checking = false;
    const timer = setInterval(() => {
        if (closed || checking) return;
        checking = true;
        options.revalidate().then((valid) => { checking = false; if (!valid) close(); else if (!closed) res.write(': ping\n\n'); }, () => { checking = false; close(); });
    }, options.heartbeat ?? 25_000);
    timer.unref?.();
    req.on('close', close);
    res.on('error', close);
}

/** Milliseconds of a polling interval (`'30s'`, `'500ms'`), or `null`. */
export function intervalToMilliseconds(interval: string | null): number | null {
    const match = interval ? /^([0-9]+)(ms|s)$/.exec(interval) : null;
    return match ? Number(match[1]) * (match[2] === 's' ? 1000 : 1) : null;
}

/**
 * Script of the database notifications component with broadcasting: it fetches the notifications when the stream announces new
 * ones or reconnects, and polls at `interval` only while the stream is down.
 */
export function databaseNotificationsBroadcastScript(channel: string, interval: string | null): string {
    const ms = intervalToMilliseconds(interval);
    return `setUpNavetteBroadcastNotifications({ $wire, broadcastChannel: ${JSON.stringify(channel)}, event: ${JSON.stringify('.' + DATABASE_NOTIFICATIONS_SENT_EVENT)}, onNotification: () => $wire.$refresh(), })
const navetteRefresh = () => $wire.$refresh()
window.addEventListener('navette-broadcasting-reconnected', navetteRefresh)
const navetteFallback = ${ms === null ? 'null' : `setInterval(() => { if (! window.navetteBroadcasting?.isConnected()) $wire.$refresh() }, ${Math.max(ms, 1000)})`}
$wire.__instance.addCleanup(() => { window.removeEventListener('navette-broadcasting-reconnected', navetteRefresh); if (navetteFallback) clearInterval(navetteFallback) })`;
}
