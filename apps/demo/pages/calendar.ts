// Calendrier des congés — exemples des deux formes du composant calendrier de Navette (absent de la démo Filament) :
// `LeaveCalendarPage` (page entière, clics ouvrant des modales à formulaire) et une page d'accueil du widget `LeaveCalendar`.
import { Action } from '@navette-js/actions';
import { DatePicker, Select, Textarea } from '@navette-js/forms';
import { CalendarPage, Dashboard, Notification, type CalendarEvent } from '@navette-js/panels';
import { LeaveRequestResource } from '../resources/LeaveRequestResource.ts';
import { calendarWidgets } from '../widgets/hr.ts';
import { knex } from '../widgets/dates.ts';

const COLORS: Record<string, string> = { approved: 'success', pending: 'warning', rejected: 'danger', cancelled: 'gray' };
const distinct = async (column: 'type' | 'status'): Promise<[string, string][]> => (await knex()('leave_requests').distinct(column).whereNotNull(column).orderBy(column)).map((row: any): [string, string] => [String(row[column]), String(row[column]).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())]);
const employees = async (): Promise<[string, string][]> => (await knex()('employees').whereNull('deleted_at').orderBy('name').limit(500).select('id', 'name')).map((row: any): [string, string] => [String(row.id), row.name]);
const days = (start: string, end: string) => Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;

export class LeaveCalendarPage extends CalendarPage {
    static slug = 'hr/calendar';
    static title = 'Leave Calendar';
    static navigationIcon = 'o-calendar-days';
    static navigationGroup = 'HR';
    static navigationSort = 10;

    async getEvents({ start, end }: { start: string; end: string }): Promise<CalendarEvent[]> {
        const rows = await knex()('leave_requests').join('employees', 'employees.id', 'leave_requests.employee_id')
            .where('leave_requests.start_date', '<=', `${end} 23:59:59`).where('leave_requests.end_date', '>=', start)
            .orderBy('leave_requests.start_date').limit(500)
            .select('leave_requests.id', 'leave_requests.start_date', 'leave_requests.end_date', 'leave_requests.status', 'leave_requests.type', 'employees.name');
        // Pas d'adresse : le clic ouvre l'action `eventAction()`. `extra` reste côté serveur.
        return rows.map((row: any) => ({ id: row.id, title: row.name, start: String(row.start_date).slice(0, 10), end: String(row.end_date).slice(0, 10), color: COLORS[row.status] ?? 'primary', description: `${row.name} — ${row.type} (${row.status})`, extra: { status: row.status, type: row.type, name: row.name } }));
    }
    getMaxEventsPerDay(): number { return 4; }

    /** Bouton d'en-tête : la page de création de la resource (le chemin « page dédiée »). */
    getHeaderActions(): Action[] { return [Action.make('create').label('New leave request').url(LeaveRequestResource.getUrl('create'))]; }

    /** Clic sur un jour : formulaire en modale, prérempli avec la date, qui crée la demande. */
    dateAction(): Action {
        return Action.make('requestLeave').modalHeading('New leave request').modalSubmitActionLabel('Create').modalWidth('lg')
            .schema(() => [
                Select.make('employee_id').label('Employee').options(employees).searchable().required(),
                Select.make('type').options(() => distinct('type')).required(),
                DatePicker.make('start_date').required(),
                DatePicker.make('end_date').required(),
                Textarea.make('reason').required().maxLength(65535),
            ])
            .fillForm(({ arguments: args }) => { const date = CalendarPage.dateOf(args); return { start_date: date, end_date: date }; })
            .action(async ({ data }) => {
                const start = String(data.start_date ?? '').slice(0, 10), end = String(data.end_date ?? '').slice(0, 10);
                if (!(start <= end)) { Notification.make().danger().title('The end date must not be before the start date.').send(); return; }
                await LeaveRequestResource.adapter.create({ employee_id: Number(data.employee_id), type: data.type, start_date: start, end_date: end, days_requested: days(start, end), reason: data.reason, status: 'pending' });
                Notification.make().success().title('Leave request created').send();
            });
    }
    /** Clic sur un événement : son statut, modifiable. L'événement est relu côté serveur à chaque étape. */
    eventAction(): Action {
        return Action.make('reviewLeave').modalSubmitActionLabel('Save').modalWidth('md')
            .modalHeading(async ({ livewire, arguments: args }) => { const event = await (livewire as LeaveCalendarPage).findEvent(args?.event); return event ? `${event.title} — ${String(event.extra?.type ?? '')}` : 'Leave request'; })
            .schema(() => [Select.make('status').options(() => distinct('status')).required()])
            .fillForm(async ({ livewire, arguments: args }) => ({ status: (await (livewire as LeaveCalendarPage).findEvent(args?.event))?.extra?.status ?? null }))
            .action(async ({ livewire, arguments: args, data }) => {
                const event = await (livewire as LeaveCalendarPage).findEvent(args?.event);
                const allowed = (await distinct('status')).map(([value]) => value);
                if (!event || !allowed.includes(String(data.status))) { Notification.make().danger().title('Leave request not found').send(); return; }
                await LeaveRequestResource.adapter.update(event.id, { status: String(data.status) });
                Notification.make().success().title('Status updated').send();
            });
    }
    renderToolbarEnd(): string { return '<a href="/hr/calendar-widget" wire:navigate class="nv-cal-today-btn">Widget version</a>'; }
}

/** Le même calendrier en widget (`LeaveCalendar`, `widgets/hr.ts`), tel qu'on le poserait sur un tableau de bord. */
export class LeaveCalendarWidgetPage extends Dashboard {
    static slug = 'hr/calendar-widget';
    static title = 'Leave Calendar (widget)';
    static shouldRegisterNavigation = false;
    getWidgets() { return calendarWidgets; }
}

export const calendarPages = [LeaveCalendarPage, LeaveCalendarWidgetPage];
