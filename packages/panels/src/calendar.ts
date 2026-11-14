// Calendar: date helpers, grid and rendering, with no runtime dependency.
// `CalendarWidget` (index.ts) builds on this module; every part of the rendering can be replaced.
import { Attributes, e, icon } from '@navette-js/support';

/** A calendar event. `start` and `end` are `YYYY-MM-DD` dates or ISO date-times (`2026-11-12T09:30`); `end` is inclusive. */
export type CalendarEvent = {
    id: string | number;
    title: string;
    start: string;
    end?: string | null;
    /** Panel color (`primary`, `success`, `warning`, `danger`, `info`, `gray`, or a registered color). */
    color?: string | null;
    /** URL opened on click. Without one, a click calls the widget's `onEventClick()` if it is overridden. */
    url?: string | null;
    openUrlInNewTab?: boolean;
    /** Tooltip text; defaults to the title. */
    description?: string | null;
    /** Free-form data for `renderEvent()` and `onEventClick()`. It is never sent to the browser. */
    extra?: Record<string, unknown>;
};
export type CalendarView = 'month' | 'week' | 'list';
export const CALENDAR_VIEWS: CalendarView[] = ['month', 'week', 'list'];

const DAY = 86400000;
export const isDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && toDate(value).toISOString().slice(0, 10) === value;
function toDate(day: string): Date { return new Date(`${day}T00:00:00Z`); }
const iso = (date: Date) => date.toISOString().slice(0, 10);
export const addDays = (day: string, count: number): string => iso(new Date(toDate(day).getTime() + count * DAY));
export function addMonths(day: string, count: number): string {
    const date = toDate(day);
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(date.getUTCDate(), last));
    return iso(target);
}
/** First day of the week containing `day`; `firstDay`: 0 = Sunday, 1 = Monday… */
export const startOfWeek = (day: string, firstDay = 1): string => addDays(day, -((toDate(day).getUTCDay() - firstDay + 7) % 7));
export const startOfMonth = (day: string): string => `${day.slice(0, 8)}01`;
export const endOfMonth = (day: string): string => { const date = toDate(day); return iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))); };
/** Day (`YYYY-MM-DD`) of an event date or date-time; `null` if the value is unreadable. */
export const dayOf = (value: unknown): string | null => (typeof value === 'string' && isDate(value.slice(0, 10)) ? value.slice(0, 10) : null);
/** `HH:MM` time of an event date-time; `null` for a plain date. */
export const timeOf = (value: unknown): string | null => (typeof value === 'string' ? (/^\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2})/.exec(value)?.[1] ?? null) : null);

/** Days shown by a view around the anchor date: the month padded to whole weeks, the week, or the month (list). */
export function visibleRange(view: CalendarView, anchor: string, firstDay = 1): { start: string; end: string } {
    if (view === 'week') { const start = startOfWeek(anchor, firstDay); return { start, end: addDays(start, 6) }; }
    if (view === 'list') return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
    const start = startOfWeek(startOfMonth(anchor), firstDay);
    const end = addDays(startOfWeek(endOfMonth(anchor), firstDay), 6);
    return { start, end };
}
export function daysBetween(start: string, end: string): string[] {
    const days: string[] = [];
    for (let day = start; day <= end && days.length < 400; day = addDays(day, 1)) days.push(day);
    return days;
}
/** Events on a day: those that started earlier first, then by time and title. */
export function eventsOn(day: string, events: CalendarEvent[]): CalendarEvent[] {
    return events
        .filter((event) => { const start = dayOf(event.start); const end = dayOf(event.end ?? event.start) ?? start; return start !== null && start <= day && day <= (end! < start ? start : end!); })
        .sort((a, b) => (dayOf(a.start)! < dayOf(b.start)! ? -1 : dayOf(a.start)! > dayOf(b.start)! ? 1 : (timeOf(a.start) ?? '').localeCompare(timeOf(b.start) ?? '') || a.title.localeCompare(b.title)));
}

export type CalendarLabels = { previous: string; next: string; today: string; month: string; week: string; list: string; more: (count: number) => string; empty: string };
export const CALENDAR_LABELS: CalendarLabels = { previous: 'Previous', next: 'Next', today: 'Today', month: 'Month', week: 'Week', list: 'List', more: (count) => `+${count} more`, empty: 'No events.' };

export type CalendarModel = {
    heading: string | null;
    view: CalendarView;
    views: CalendarView[];
    /** Anchor date and today's date, `YYYY-MM-DD`. */
    anchor: string;
    today: string;
    firstDay: number;
    locale: string;
    events: CalendarEvent[];
    maxEventsPerDay: number;
    /** Day numbers are buttons (`selectDate`). */
    datesClickable: boolean;
    /** Events without a URL are buttons (`selectEvent`). */
    eventsClickable: boolean;
    labels: CalendarLabels;
    /** Overrides an event's rendering: return already-escaped HTML, or `null` to keep the default. */
    renderEvent?: (event: CalendarEvent, context: { day: string; view: CalendarView }) => string | null;
    /** Already-escaped HTML appended to the bottom of a day cell (total, badge…). */
    renderDayFooter?: (day: string, events: CalendarEvent[]) => string;
    /** Already-escaped HTML placed at the end of the toolbar (action buttons…). */
    toolbarEnd?: string;
};

const COLOR = /^[a-z][a-z0-9-]*$/;
/** Only a same-site path (`/…`) or an http(s) URL becomes a link (no `javascript:` or protocol-relative URLs). */
const safeUrl = (url: unknown): string | null => (typeof url === 'string' && /^(\/(?!\/)|https?:\/\/)/.test(url) ? url : null);
const call = (method: string, argument: string | number) => `${method}(${JSON.stringify(String(argument)).replace(/"/g, "'")})`;

/** Default event rendering: a link, a button or a plain block, depending on what a click can do. */
export function renderCalendarEvent(event: CalendarEvent, context: { day: string; view: CalendarView; clickable: boolean }): string {
    const start = dayOf(event.start)!;
    const end = dayOf(event.end ?? event.start) ?? start;
    const color = event.color && COLOR.test(event.color) ? event.color : 'primary';
    const url = safeUrl(event.url);
    const time = context.day === start ? timeOf(event.start) : null;
    const attributes = new Attributes({
        title: event.description ?? event.title, 'data-event': String(event.id),
        ...(url ? { href: url, ...(event.openUrlInNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : url.startsWith('/') ? { 'wire:navigate': '' } : {}) } : context.clickable ? { type: 'button', 'wire:click': call('selectEvent', event.id) } : {}),
    }).class(['nv-cal-event', 'fi-color', `fi-color-${color}`, context.day > start ? 'nv-cal-event-continued' : null, context.day < end ? 'nv-cal-event-continues' : null]);
    const tag = url ? 'a' : context.clickable ? 'button' : 'div';
    return `<${tag} ${attributes.toHtml()}>${time ? `<time class="nv-cal-event-time">${e(time)}</time>` : ''}<span class="nv-cal-event-title">${e(event.title)}</span></${tag}>`;
}

/** Renders the whole calendar: toolbar, then the requested view. */
export function renderCalendar(model: CalendarModel): string {
    const { view, anchor, today, firstDay, locale, labels } = model;
    const range = visibleRange(view, anchor, firstDay);
    const days = daysBetween(range.start, range.end);
    const format = (options: Intl.DateTimeFormatOptions, day: string) => new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(toDate(day));
    const title = view === 'week'
        ? `${format({ month: 'short', day: 'numeric' }, range.start)} – ${format({ month: 'short', day: 'numeric', year: 'numeric' }, range.end)}`
        : format({ month: 'long', year: 'numeric' }, anchor);
    const eventHtml = (event: CalendarEvent, day: string) => model.renderEvent?.(event, { day, view }) ?? renderCalendarEvent(event, { day, view, clickable: model.eventsClickable });
    const dayNumber = (day: string, text: string) => (model.datesClickable
        ? `<button type="button" wire:click="${call('selectDate', day)}" class="nv-cal-day-number">${e(text)}</button>`
        : `<span class="nv-cal-day-number">${e(text)}</span>`);
    const iconButton = (name: string, label: string, method: string) => `<button type="button" wire:click="${method}" title="${e(label)}" aria-label="${e(label)}" class="fi-icon-btn fi-size-md nv-cal-nav">${icon(name, { alias: `panels::calendar.${method === 'previousPeriod' ? 'previous' : 'next'}-button` })}</button>`;
    const switcher = model.views.length > 1
        ? `<div class="nv-cal-views" role="group">${model.views.map((name) => `<button type="button" wire:click="${call('setView', name)}" aria-pressed="${name === view}" class="nv-cal-view${name === view ? ' nv-cal-view-active' : ''}">${e(labels[name])}</button>`).join('')}</div>`
        : '';
    const toolbar = `<div class="nv-cal-toolbar"><div class="nv-cal-nav-group">${iconButton('m-chevron-left', labels.previous, 'previousPeriod')}<button type="button" wire:click="goToToday" class="nv-cal-today-btn">${e(labels.today)}</button>${iconButton('m-chevron-right', labels.next, 'nextPeriod')}</div><h3 class="nv-cal-title" aria-live="polite">${e(model.heading ? `${model.heading} — ${title}` : title)}</h3><div class="nv-cal-toolbar-end">${switcher}${model.toolbarEnd ?? ''}</div></div>`;

    let body: string;
    if (view === 'list') {
        const filled = days.map((day) => [day, eventsOn(day, model.events)] as const).filter(([, events]) => events.length);
        body = filled.length
            ? `<div class="nv-cal-list">${filled.map(([day, events]) => `<section class="nv-cal-list-day${day === today ? ' nv-cal-today' : ''}" data-date="${day}"><h4 class="nv-cal-list-date">${dayNumber(day, format({ weekday: 'long', month: 'long', day: 'numeric' }, day))}</h4><div class="nv-cal-events">${events.map((event) => eventHtml(event, day)).join('')}</div>${model.renderDayFooter?.(day, events) ?? ''}</section>`).join('')}</div>`
            : `<p class="nv-cal-empty">${e(labels.empty)}</p>`;
    } else {
        const month = anchor.slice(0, 7);
        const head = days.slice(0, 7).map((day) => `<div role="columnheader" class="nv-cal-weekday">${e(format({ weekday: 'short' }, day))}</div>`).join('');
        const cells = days.map((day) => {
            const events = eventsOn(day, model.events);
            const limit = view === 'month' ? Math.max(1, model.maxEventsPerDay) : events.length;
            const shown = events.length > limit ? events.slice(0, limit - 1) : events;
            const more = events.length - shown.length;
            const label = view === 'week' ? format({ day: 'numeric' }, day) : String(Number(day.slice(8)));
            return `<div role="gridcell" data-date="${day}" aria-label="${e(format({ dateStyle: 'full' }, day))}" class="nv-cal-day${view === 'month' && !day.startsWith(month) ? ' nv-cal-outside' : ''}${day === today ? ' nv-cal-today' : ''}"><div class="nv-cal-day-head">${dayNumber(day, label)}</div><div class="nv-cal-events">${shown.map((event) => eventHtml(event, day)).join('')}${more > 0 ? `<button type="button" wire:click="${call('showDay', day)}" class="nv-cal-more">${e(labels.more(more))}</button>` : ''}</div>${model.renderDayFooter?.(day, events) ?? ''}</div>`;
        }).join('');
        body = `<div role="grid" class="nv-cal-grid nv-cal-grid-${view}"><div role="row" class="nv-cal-weekdays">${head}</div><div class="nv-cal-days">${cells}</div></div>`;
    }
    return `<div class="nv-cal nv-cal-view-${view}" data-date="${anchor}" wire:loading.class="nv-cal-loading">${toolbar}${body}</div>`;
}
