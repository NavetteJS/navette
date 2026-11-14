---
title: Calendar widgets
---

## Introduction

Navette includes a calendar. It displays events in a month, week or list view, with navigation rendered on the server and no JavaScript library to install. It comes in two forms:

- `CalendarWidget`, a widget to place on a dashboard or a page, next to other widgets.
- `CalendarPage`, a full page whose clicks can open [action modals](/actions/modals): forms, confirmations and slide-overs.

Create a class extending `CalendarWidget` and return the events of the displayed period from `getEvents()`:

```ts
import { CalendarWidget, type CalendarEvent } from '@navette-js/panels';

export class LeaveCalendar extends CalendarWidget {
    static heading = 'Leave';

    async getEvents({ start, end }: { start: string; end: string }): Promise<CalendarEvent[]> {
        const rows = await knex('leave_requests')
            .join('employees', 'employees.id', 'leave_requests.employee_id')
            .where('leave_requests.start_date', '<=', `${end} 23:59:59`)
            .where('leave_requests.end_date', '>=', start)
            .orderBy('leave_requests.start_date')
            .limit(500)
            .select('leave_requests.id', 'leave_requests.start_date', 'leave_requests.end_date', 'leave_requests.status', 'employees.name');

        return rows.map((row) => ({
            id: row.id,
            title: row.name,
            start: String(row.start_date).slice(0, 10),
            end: String(row.end_date).slice(0, 10),
            color: row.status === 'approved' ? 'success' : 'warning',
            url: `/hr/leave-requests/${row.id}`,
        }));
    }
}
```

Then [register the widget](/widgets/overview#registering-widgets) and display it on a dashboard or a page. The widget spans the full width of the page by default, and its styles are always loaded by the panel.

`getEvents()` receives the first and last days displayed (`YYYY-MM-DD`, both included) and the current `view`. It is called on every render, so filter your query on this range rather than loading all events.

## Defining events

Each event is a `CalendarEvent` object:

| Property | Description |
|---|---|
| `id` | Identifier of the event (string or number). |
| `title` | Text displayed in the calendar. |
| `start` | Start date `YYYY-MM-DD`, or date-time `2026-11-12T09:30`. A time is displayed before the title on the first day. |
| `end` | Optional end date or date-time, included. An event spanning several days is repeated in each day. |
| `color` | Optional color of the panel: `primary` (default), `success`, `warning`, `danger`, `info`, `gray`, or one you registered. |
| `url` | Optional address opened on click. Only a relative path (`/…`) or an `http(s)` address becomes a link. |
| `openUrlInNewTab` | Opens `url` in a new tab. |
| `description` | Optional tooltip text; the title by default. |
| `extra` | Optional data for your own code (`renderEvent()`, `onEventClick()`). It stays on the server and is never sent to the browser. |

Titles and descriptions are escaped.

## Choosing the views

By default, the user can switch between the `month`, `week` and `list` views, and the calendar opens on the first one. Override `getViews()` to choose the views and their order. With a single view, the view switcher is not displayed:

```ts
import { CalendarWidget, type CalendarView } from '@navette-js/panels';

export class LeaveCalendar extends CalendarWidget {
    getViews(): CalendarView[] {
        return ['week', 'list'];
    }
}
```

The list view shows the days of the month that have events.

## Customizing the calendar

The other settings are methods to override:

| Method | Default | Effect |
|---|---|---|
| `getFirstDayOfWeek()` | `1` | First day of the week: `0` for Sunday, `1` for Monday… |
| `getLocale()` | `'en-US'` | Language of month and day names (`Intl`). |
| `getLabels()` | English labels | Labels of the buttons: `{ previous, next, today, month, week, list, more, empty }`, where `more` is a function of the hidden count. |
| `getToday()` | today in UTC | Today's date, `YYYY-MM-DD`. Override it for another time zone. |
| `getMaxEventsPerDay()` | `3` | In the month view, beyond this number a day shows a "+N more" button, which opens the list view on that day. |
| `getHeading()` | static `heading` | Text displayed before the period ("Leave — November 2026"). |

```ts
import { CALENDAR_LABELS, CalendarWidget } from '@navette-js/panels';

export class PlanningCalendar extends CalendarWidget {
    getLocale() {
        return 'fr-FR';
    }

    getFirstDayOfWeek() {
        return 1;
    }

    getToday() {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
    }

    getLabels() {
        return { ...CALENDAR_LABELS, today: 'Aujourd’hui', more: (count: number) => `+${count} autres` };
    }
}
```

## Handling clicks

The developer chooses, click by click, what happens:

- An event with a `url` is a link to that address.
- Overriding `onEventClick(event)` makes events without a `url` clickable. The event is looked up again on the server among the events of the displayed period, so `event.extra` is available.
- Overriding `onDateClick(date)` makes the day numbers clickable. `date` is a checked `YYYY-MM-DD` string.

These methods may notify, write to the database or redirect, with `this.redirect(url)`:

```ts
import { CalendarWidget, Notification, type CalendarEvent } from '@navette-js/panels';

export class LeaveCalendar extends CalendarWidget {
    onDateClick(date: string) {
        this.redirect(`/hr/leave-requests/create?date=${date}`, true);
    }

    async onEventClick(event: CalendarEvent) {
        Notification.make().info().title(event.title).body(String(event.extra?.type ?? '')).send();
    }
}
```

<Aside variant="info">
A `CalendarWidget` cannot open action modals. To open forms or confirmations on click, use a [`CalendarPage`](#using-a-calendar-page).
</Aside>

## Customizing the rendering

You may replace parts of the calendar's HTML. The HTML you return is inserted as-is, so escape any data with `e()` from `@navette-js/support`:

| Method | Effect |
|---|---|
| `renderEvent(event, { day, view })` | HTML of an event, or `null` to keep the default rendering (`renderCalendarEvent()`). |
| `renderDayFooter(day, events)` | HTML added at the bottom of each day. |
| `renderToolbarEnd()` | HTML placed at the right of the toolbar, for example a link or a button. |
| `getExtraClasses()` | CSS classes added to the calendar. |
| `getStyle()` | CSS variables set on the calendar. |

```ts
import { CalendarWidget, type CalendarEvent } from '@navette-js/panels';
import { e } from '@navette-js/support';

export class LeaveCalendar extends CalendarWidget {
    renderEvent(event: CalendarEvent) {
        return `<span class="nv-cal-event nv-color nv-color-${e(event.color ?? 'primary')}">${e(event.title)} · ${e(String(event.extra?.type ?? ''))}</span>`;
    }

    renderDayFooter(_day: string, events: CalendarEvent[]) {
        return events.length > 1 ? `<span class="nv-cal-more">${events.length} away</span>` : '';
    }

    renderToolbarEnd() {
        return '<a href="/hr/calendar" wire:navigate class="nv-cal-today-btn">Full page</a>';
    }

    getStyle() {
        return { '--nv-cal-day-min-height': '9rem', '--nv-cal-radius': '0.75rem' };
    }
}
```

The CSS variables of the calendar are `--nv-cal-day-min-height`, `--nv-cal-radius`, `--nv-cal-event-radius`, `--nv-cal-gap`, `--nv-cal-border`, `--nv-cal-surface`, `--nv-cal-surface-muted` and `--nv-cal-muted`. Only names starting with `--` and values without `;`, `{`, `}`, `<` or `>` are kept.

## Using a calendar page

`CalendarPage` displays the same calendar as a full panel page, with the same methods (`getEvents()`, `getViews()`, `renderEvent()`…; the heading comes from `getCalendarHeading()`). Register it in the panel's `pages()` like any page.

On a page, clicks can open [actions](/actions/overview): return an `Action` from `dateAction()` to handle clicks on days, and from `eventAction()` to handle clicks on events without a `url`. The date is passed to the action as `arguments.date`, and the event ID as `arguments.event`:

```ts
import { Action } from '@navette-js/actions';
import { DatePicker, Select, Textarea } from '@navette-js/forms';
import { CalendarPage, Notification, type CalendarEvent } from '@navette-js/panels';

export class LeaveCalendarPage extends CalendarPage {
    static slug = 'hr/calendar';
    static title = 'Leave Calendar';
    static navigationIcon = 'o-calendar-days';

    async getEvents({ start, end }: { start: string; end: string }): Promise<CalendarEvent[]> {
        // Events without a `url`: a click opens `eventAction()`.
        // ...
    }

    getHeaderActions() {
        return [Action.make('create').label('New leave request').url(LeaveRequestResource.getUrl('create'))];
    }

    dateAction() {
        return Action.make('requestLeave')
            .modalHeading('New leave request')
            .modalSubmitActionLabel('Create')
            .modalWidth('lg')
            .schema(() => [
                Select.make('employee_id').label('Employee').options(employees).searchable().required(),
                DatePicker.make('start_date').required(),
                DatePicker.make('end_date').required(),
                Textarea.make('reason').required(),
            ])
            .fillForm(({ arguments: args }) => {
                const date = CalendarPage.dateOf(args);
                return { start_date: date, end_date: date };
            })
            .action(async ({ data }) => {
                await LeaveRequestResource.adapter.create({ ...data, status: 'pending' });
                Notification.make().success().title('Leave request created').send();
            });
    }

    eventAction() {
        return Action.make('reviewLeave')
            .modalWidth('md')
            .modalSubmitActionLabel('Save')
            .modalHeading(async ({ livewire, arguments: args }) => (await livewire.findEvent(args.event))?.title ?? 'Leave request')
            .schema(() => [Select.make('status').options(STATUSES).required()])
            .fillForm(async ({ livewire, arguments: args }) => ({ status: (await livewire.findEvent(args.event))?.extra?.status ?? null }))
            .action(async ({ livewire, arguments: args, data }) => {
                const event = await livewire.findEvent(args.event);
                if (!event) return;
                await LeaveRequestResource.adapter.update(event.id, { status: data.status });
                Notification.make().success().title('Status updated').send();
            });
    }
}
```

Arguments come from the browser, so read them through the two helpers of the page:

- `CalendarPage.dateOf(args)` returns `args.date` only if it is a real `YYYY-MM-DD` date, and `null` otherwise.
- `this.findEvent(id)` (or `livewire.findEvent(id)` in an action) returns the event with this ID among the events of the displayed period, or `null`. Never act on an event ID without it.

You may still override `onDateClick()` and `onEventClick()` on a page to do something else than opening the actions, such as redirecting, or mounting another action with `this.mountAction(name, args)`. Actions returned by `getCalendarActions()` can also be mounted from your own HTML, for example in `renderEvent()`, with `wire:click="mountAction('name', { … })"`.

## Rendering a calendar elsewhere

The `renderCalendar(model)` function of `@navette-js/panels` returns the calendar's HTML from a model (`view`, `anchor`, `events`, `labels`…), without a widget. Its navigation buttons call the `previousPeriod`, `nextPeriod`, `goToToday`, `setView`, `selectDate`, `selectEvent` and `showDay` methods of the component that renders it, which must implement them.

## Security

Navette provides these protections:

- The view and the displayed date are locked properties: the browser can only change them through the navigation methods, which validate their arguments.
- A date sent by the browser is used only if it is a real `YYYY-MM-DD` date, and an event ID only if it matches an event of the displayed period.
- Titles, descriptions and labels are escaped, event colors are restricted to color names, and event URLs to relative paths and `http(s)` addresses.

What your application must still do:

- Filter `getEvents()` to the events the current user may see: the calendar displays everything it returns.
- Escape data in the HTML returned by `renderEvent()`, `renderDayFooter()` and `renderToolbarEnd()`.
- Authorize the changes made by actions and click handlers.

<Aside variant="warning">
The calendar has no day view with hours, no drag and drop, and no continuous bars for events spanning several days.
</Aside>
