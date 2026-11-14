import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, addMonths, CALENDAR_LABELS, daysBetween, eventsOn, isDate, renderCalendar, startOfWeek, visibleRange, type CalendarEvent, type CalendarModel } from '../src/calendar.ts';

test('dates: validity, offsets and month ends', () => {
    assert.equal(isDate('2026-02-28'), true);
    assert.equal(isDate('2026-02-30'), false);
    assert.equal(isDate("2026-02-28'); alert(1)"), false);
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
    assert.equal(addMonths('2026-01-15', -1), '2025-12-15');
    assert.equal(startOfWeek('2026-11-12', 1), '2026-11-09');
    assert.equal(startOfWeek('2026-11-12', 0), '2026-11-08');
});

test('visible range: the month is padded to whole weeks', () => {
    assert.deepEqual(visibleRange('month', '2026-11-12', 1), { start: '2026-10-26', end: '2026-12-06' });
    assert.deepEqual(visibleRange('week', '2026-11-12', 1), { start: '2026-11-09', end: '2026-11-15' });
    assert.deepEqual(visibleRange('list', '2026-02-10', 1), { start: '2026-02-01', end: '2026-02-28' });
    assert.equal(daysBetween('2026-10-26', '2026-12-06').length, 42);
});

const events: CalendarEvent[] = [
    { id: 1, title: 'Long', start: '2026-11-10', end: '2026-11-12' },
    { id: 2, title: 'Morning', start: '2026-11-12T09:30', color: 'success', url: '/a' },
    { id: 3, title: '<b>x</b>', start: '2026-11-12T08:00', url: 'javascript:alert(1)', color: 'bad color"' },
    { id: 4, title: 'Ends before start', start: '2026-11-20', end: '2026-11-01' },
];
test('events on a day: multi-day, order, end before start', () => {
    assert.deepEqual(eventsOn('2026-11-12', events).map((event) => event.id), [1, 3, 2]);
    assert.deepEqual(eventsOn('2026-11-11', events).map((event) => event.id), [1]);
    assert.deepEqual(eventsOn('2026-11-20', events).map((event) => event.id), [4]);
    assert.deepEqual(eventsOn('2026-11-05', events).map((event) => event.id), []);
});

const model = (overrides: Partial<CalendarModel> = {}): CalendarModel => ({
    heading: null, view: 'month', views: ['month', 'week', 'list'], anchor: '2026-11-12', today: '2026-11-12', firstDay: 1, locale: 'en-US', events,
    maxEventsPerDay: 3, datesClickable: false, eventsClickable: false, labels: CALENDAR_LABELS, ...overrides,
});
test('rendering: 42-cell grid, title, escaping, filtered URL and color', () => {
    const html = renderCalendar(model());
    assert.equal(html.match(/role="gridcell"/g)?.length, 42);
    assert.match(html, /November 2026/);
    // The title is escaped in text; in the `title` attribute only quotes need escaping.
    assert.ok(html.includes('>&lt;b&gt;x&lt;/b&gt;<') && !html.includes('><b>x</b><'));
    assert.ok(!html.includes('javascript:'));
    assert.ok(!html.includes('bad color'));
    assert.match(html, /<a [^>]*href="\/a"[^>]*wire:navigate/);
    assert.ok(!html.includes('selectDate') && !html.includes('selectEvent'));
});
test('rendering: clickable days and events, "+N more", week and list views, custom rendering', () => {
    const clickable = renderCalendar(model({ datesClickable: true, eventsClickable: true, maxEventsPerDay: 2 }));
    assert.match(clickable, /wire:click="selectDate\('2026-11-12'\)"/);
    assert.match(clickable, /wire:click="selectEvent\('1'\)"/);
    assert.match(clickable, /wire:click="showDay\('2026-11-12'\)"[^>]*>\+2 more</);
    assert.equal(renderCalendar(model({ view: 'week' })).match(/role="gridcell"/g)?.length, 7);
    const list = renderCalendar(model({ view: 'list' }));
    assert.equal(list.match(/class="nv-cal-list-day/g)?.length, 4);
    assert.match(renderCalendar(model({ view: 'list', events: [] })), /No events\./);
    assert.match(renderCalendar(model({ renderEvent: (event) => (event.id === 2 ? '<i data-custom>ok</i>' : null), renderDayFooter: (_day, list) => (list.length ? '<u>foot</u>' : '') })), /<i data-custom>ok<\/i>[^]*<u>foot<\/u>/);
});
test('labels and day names follow the current locale', async () => {
    const { setLocale } = await import('@navette-js/support/i18n');
    const { calendarLocale } = await import('../src/calendar.ts');
    setLocale('fr');
    try {
        assert.equal(calendarLocale(), 'fr');
        const html = renderCalendar(model({ labels: CALENDAR_LABELS, locale: calendarLocale(), maxEventsPerDay: 2 }));
        assert.match(html, /title="Précédent"/);
        assert.match(html, />Aujourd’hui<|>Aujourd&#039;hui<|>Aujourd'hui</);
        assert.match(html, />Mois<\/button><button[^>]*>Semaine<\/button><button[^>]*>Liste</);
        assert.match(html, />\+2 autres</);
        assert.match(html, />novembre 2026</);
        assert.match(html, />lun\.</);
        assert.match(renderCalendar(model({ view: 'list', events: [], labels: CALENDAR_LABELS })), /Aucun événement\./);
        // An override built from the defaults keeps the other translations.
        assert.equal({ ...CALENDAR_LABELS, today: 'Maintenant' }.next, 'Suivant');
    } finally { setLocale('en'); }
    assert.equal(CALENDAR_LABELS.today, 'Today');
    // A Laravel-style locale name is accepted by Intl.
    assert.match(renderCalendar(model({ locale: 'pt_BR' })), /novembro de 2026/);
});
