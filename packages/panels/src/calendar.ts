// Calendrier — composant propre à Navette (Filament n'en fournit pas) : dates, grille et rendu, sans dépendance au runtime.
// Le widget `CalendarWidget` (index.ts) s'appuie sur ce module ; chaque morceau du rendu peut être remplacé.
import { Attributes, e, icon } from '@navette-js/support';

/** Un événement. `start` et `end` sont des dates `YYYY-MM-DD` ou des dates-heures ISO (`2026-11-12T09:30`) ; `end` est inclus. */
export type CalendarEvent = {
    id: string | number;
    title: string;
    start: string;
    end?: string | null;
    /** Couleur du panel (`primary`, `success`, `warning`, `danger`, `info`, `gray`, ou une couleur déclarée). */
    color?: string | null;
    /** Adresse ouverte au clic. Sans adresse, le clic appelle `onEventClick()` du widget s'il est redéfini. */
    url?: string | null;
    openUrlInNewTab?: boolean;
    /** Texte de l'infobulle ; par défaut, le titre. */
    description?: string | null;
    /** Données libres, à disposition de `renderEvent()` et de `onEventClick()`. Elles ne sont pas envoyées au navigateur. */
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
/** Premier jour de la semaine contenant `day` ; `firstDay` : 0 = dimanche, 1 = lundi… */
export const startOfWeek = (day: string, firstDay = 1): string => addDays(day, -((toDate(day).getUTCDay() - firstDay + 7) % 7));
export const startOfMonth = (day: string): string => `${day.slice(0, 8)}01`;
export const endOfMonth = (day: string): string => { const date = toDate(day); return iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))); };
/** Jour (`YYYY-MM-DD`) d'une date ou d'une date-heure d'événement ; nul si la valeur est illisible. */
export const dayOf = (value: unknown): string | null => (typeof value === 'string' && isDate(value.slice(0, 10)) ? value.slice(0, 10) : null);
/** Heure `HH:MM` d'une date-heure d'événement, nulle pour une date seule. */
export const timeOf = (value: unknown): string | null => (typeof value === 'string' ? (/^\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2})/.exec(value)?.[1] ?? null) : null);

/** Jours affichés par une vue autour de la date d'ancrage : le mois complété en semaines entières, la semaine, ou le mois (liste). */
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
/** Événements d'un jour, ceux qui ont commencé plus tôt d'abord, puis par heure et par titre. */
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
    /** Date d'ancrage et date du jour, `YYYY-MM-DD`. */
    anchor: string;
    today: string;
    firstDay: number;
    locale: string;
    events: CalendarEvent[];
    maxEventsPerDay: number;
    /** Les numéros de jour sont des boutons (`selectDate`). */
    datesClickable: boolean;
    /** Les événements sans adresse sont des boutons (`selectEvent`). */
    eventsClickable: boolean;
    labels: CalendarLabels;
    /** Remplace le rendu d'un événement : rendre du HTML déjà échappé, ou `null` pour garder le rendu par défaut. */
    renderEvent?: (event: CalendarEvent, context: { day: string; view: CalendarView }) => string | null;
    /** HTML ajouté au bas de la case d'un jour (total, pastille…), déjà échappé. */
    renderDayFooter?: (day: string, events: CalendarEvent[]) => string;
    /** HTML placé à droite de la barre d'outils (boutons d'action…), déjà échappé. */
    toolbarEnd?: string;
};

const COLOR = /^[a-z][a-z0-9-]*$/;
/** Seules une adresse du site (`/…`) ou une adresse http(s) deviennent un lien. */
const safeUrl = (url: unknown): string | null => (typeof url === 'string' && /^(\/(?!\/)|https?:\/\/)/.test(url) ? url : null);
const call = (method: string, argument: string | number) => `${method}(${JSON.stringify(String(argument)).replace(/"/g, "'")})`;

/** Rendu par défaut d'un événement : un lien, un bouton ou un simple bloc, selon ce qu'un clic peut faire. */
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

/** Rend le calendrier complet : barre d'outils, puis la vue demandée. */
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
    const iconButton = (name: string, label: string, method: string) => `<button type="button" wire:click="${method}" title="${e(label)}" aria-label="${e(label)}" class="fi-icon-btn fi-size-md nv-cal-nav">${icon(name)}</button>`;
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
