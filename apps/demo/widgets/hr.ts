// Widgets du tableau de bord HR — port de App\Filament\Widgets\{WorkforceInsightsStats, DepartmentLeaveLoadChart, ProjectHealthChart, UtilizationRateChart, BudgetBurnRateChart}.
import { CalendarWidget, ChartWidget, Notification, Stat, StatsOverviewWidget, type CalendarEvent, type ChartData } from '@navette/panels';
import { dayLabel, diffInDays, diffInMonths, endOfWeek, knex, lastMonths, monthKey, monthLabel, now, parse, round, sql, startOfDay, startOfWeek, subDays, truncate } from './dates.ts';

export class WorkforceInsightsStats extends StatsOverviewWidget {
    static pollingInterval = null;
    async getStats(): Promise<Stat[]> {
        // `Employee::where('is_active', true)` écarte les employés supprimés ; `withTrashed()` les garde.
        const all: any[] = await knex()('employees').select('hire_date', 'is_active', 'employment_type', 'deleted_at');
        const active = all.filter((employee) => employee.is_active && employee.deleted_at === null);
        const totalActive = active.length;
        // `hire_date` est une date (minuit) ; l'ancienneté est en mois décimaux, comme `diffInMonths()`.
        const avgTenure = totalActive ? round(active.reduce((sum, employee) => sum + diffInMonths(startOfDay(parse(employee.hire_date)), now()) / 12, 0) / totalActive, 1) : 0;
        const inactiveCount = all.filter((employee) => !employee.is_active).length;
        const totalCount = all.length;
        const turnoverRate = totalCount > 0 ? round((inactiveCount / totalCount) * 100, 1) : 0;
        const headcountLimit = Math.trunc(Number(((await knex()('departments').where('is_active', true).sum({ total: 'headcount_limit' }).first()) as any)?.total ?? 0));
        const openCapacity = Math.max(0, headcountLimit - totalActive);
        const contractorCount = active.filter((employee) => employee.employment_type === 'contractor').length;
        const contractorRatio = totalActive > 0 ? round((contractorCount / totalActive) * 100, 1) : 0;
        return [
            Stat.make('Avg Tenure', `${avgTenure} yrs`).description(`${totalActive} active employees`).descriptionIcon('m-clock').color('primary'),
            Stat.make('Turnover Rate', `${turnoverRate}%`).description(`${inactiveCount} departed of ${totalCount}`).descriptionIcon('m-arrow-right-on-rectangle').color(turnoverRate > 20 ? 'danger' : 'warning'),
            Stat.make('Open Capacity', String(openCapacity)).description(`Limit: ${headcountLimit}, filled: ${totalActive}`).descriptionIcon('m-user-plus').color(openCapacity > 0 ? 'success' : 'gray'),
            Stat.make('Contractor Ratio', `${contractorRatio}%`).description(`${contractorCount} contractors`).descriptionIcon('m-briefcase').color('info'),
        ];
    }
}

export class DepartmentLeaveLoadChart extends ChartWidget {
    static pollingInterval = null;
    static heading = 'Department Leave Load';
    getType(): string { return 'bar'; }
    async getData(): Promise<ChartData> {
        // Congés approuvés ou pris cette année, par service de l'employé (les employés supprimés sont écartés, comme la relation Eloquent).
        const rows: any[] = await knex()('leave_requests')
            .join('employees', 'employees.id', 'leave_requests.employee_id').join('departments', 'departments.id', 'employees.department_id')
            .whereNull('employees.deleted_at').whereIn('leave_requests.status', ['approved', 'taken'])
            .whereRaw('strftime(\'%Y\', leave_requests.start_date) = ?', [String(now().getUTCFullYear())])
            .orderBy('leave_requests.id').select('departments.name', 'leave_requests.days_requested');
        const byDepartment = new Map<string, number>();
        for (const row of rows) byDepartment.set(row.name, (byDepartment.get(row.name) ?? 0) + Number(row.days_requested));
        // `sortDesc()` est un tri stable : à égalité, l'ordre de première apparition est gardé.
        const sorted = [...byDepartment].map(([name, days]) => [name, round(days, 1)] as const).sort((a, b) => b[1] - a[1]);
        return { datasets: [{ label: 'Leave Days', data: sorted.map(([, days]) => days), backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }], labels: sorted.map(([name]) => name) };
    }
}

export class ProjectHealthChart extends ChartWidget {
    static pollingInterval = null;
    static heading = 'Project Health';
    getType(): string { return 'bar'; }
    async getData(): Promise<ChartData> {
        const projects: any[] = await knex()('projects').whereNull('deleted_at').where('status', 'active').orderBy('name').limit(10).select('name', 'budget', 'spent', 'start_date', 'end_date');
        const budgetUsed: number[] = [], timelineElapsed: number[] = [];
        for (const project of projects) {
            budgetUsed.push(Number(project.budget) > 0 ? Math.min(200, round((Number(project.spent) / Number(project.budget)) * 100, 1)) : 0);
            if (project.end_date !== null) {
                const start = startOfDay(parse(project.start_date));
                const totalDays = diffInDays(start, startOfDay(parse(project.end_date)));
                timelineElapsed.push(totalDays > 0 ? Math.min(200, round((diffInDays(start, now()) / totalDays) * 100, 1)) : 0);
            } else timelineElapsed.push(0);
        }
        return {
            datasets: [{ label: 'Budget Used %', data: budgetUsed, backgroundColor: '#3b82f6' }, { label: 'Timeline Elapsed %', data: timelineElapsed, backgroundColor: '#f59e0b' }],
            labels: projects.map((project) => truncate(project.name, 20)),
        };
    }
}

export class UtilizationRateChart extends ChartWidget {
    static pollingInterval = null;
    static heading = 'Utilization Rate';
    getType(): string { return 'line'; }
    async getData(): Promise<ChartData> {
        const fullTime = Number(((await knex()('employees').whereNull('deleted_at').where('is_active', true).where('employment_type', 'full_time').count({ n: '*' }).first()) as any)?.n ?? 0);
        const weeklyCapacity = Math.max(1, fullTime * 40);
        const labels: string[] = [], utilization: number[] = [];
        for (let weeksAgo = 11; weeksAgo >= 0; weeksAgo--) {
            const day = subDays(now(), weeksAgo * 7);
            const start = startOfWeek(day), end = endOfWeek(day);
            const billable = Number(((await knex()('timesheets').whereBetween('date', [sql(start), sql(end)]).where('is_billable', true).sum({ hours: 'hours' }).first()) as any)?.hours ?? 0);
            labels.push(dayLabel(start));
            utilization.push(round((billable / weeklyCapacity) * 100, 1));
        }
        return {
            datasets: [
                { label: 'Utilization %', data: utilization, borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', fill: 'start' },
                { label: 'Target (80%)', data: Array(12).fill(80), borderColor: '#ef4444', borderDash: [5, 5], pointRadius: 0, fill: false },
            ],
            labels,
        };
    }
}

export class BudgetBurnRateChart extends ChartWidget {
    static pollingInterval = null;
    static heading = 'Budget Burn Rate';
    getType(): string { return 'line'; }
    async getData(): Promise<ChartData> {
        const months = lastMonths(12);
        const expenses: any[] = await knex()('expenses').whereIn('status', ['approved', 'reimbursed']).where('created_at', '>=', sql(months[0])).select('created_at', 'total_amount');
        const totalBudget = Number(((await knex()('projects').whereNull('deleted_at').where('status', 'active').sum({ total: 'budget' }).first()) as any)?.total ?? 0);
        let cumulative = 0;
        const cumulativeData: number[] = [], budgetLine: number[] = [], labels: string[] = [];
        for (const month of months) {
            const key = monthKey(month);
            cumulative += expenses.filter((expense) => String(expense.created_at ?? '').slice(0, 7) === key).reduce((sum, expense) => sum + Number(expense.total_amount), 0);
            cumulativeData.push(round(cumulative, 2));
            budgetLine.push(round(totalBudget, 2));
            labels.push(monthLabel(month));
        }
        return {
            datasets: [
                { label: 'Cumulative Expenses', data: cumulativeData, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: 'start' },
                { label: 'Total Budget', data: budgetLine, borderColor: '#22c55e', borderDash: [5, 5], pointRadius: 0, fill: false },
            ],
            labels,
        };
    }
}

const LEAVE_COLORS: Record<string, string> = { approved: 'success', pending: 'warning', rejected: 'danger', cancelled: 'gray' };
/**
 * Calendrier des congés (composant propre à Navette, absent de la démo Filament) : exemple de CalendarWidget personnalisé —
 * couleur selon le statut, lien vers la demande, clic sur un jour, pied de case et bouton dans la barre d'outils.
 */
export class LeaveCalendar extends CalendarWidget {
    static heading = 'Leave';
    static isLazy = false;
    async getEvents({ start, end }: { start: string; end: string }): Promise<CalendarEvent[]> {
        const rows = await knex()('leave_requests').join('employees', 'employees.id', 'leave_requests.employee_id')
            .where('leave_requests.start_date', '<=', `${end} 23:59:59`).where('leave_requests.end_date', '>=', start)
            .orderBy('leave_requests.start_date').limit(500)
            .select('leave_requests.id', 'leave_requests.start_date', 'leave_requests.end_date', 'leave_requests.status', 'leave_requests.type', 'employees.name');
        return rows.map((row: any) => ({
            id: row.id, title: row.name, start: String(row.start_date).slice(0, 10), end: String(row.end_date).slice(0, 10), color: LEAVE_COLORS[row.status] ?? 'primary',
            url: `/hr/leave-requests/${row.id}`, description: `${row.name} — ${row.type} (${row.status})`,
        }));
    }
    getMaxEventsPerDay(): number { return 4; }
    onDateClick(date: string): void { Notification.make().info().title(new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))).body('Override onDateClick() to open a form, a page or a filtered list.').send(); }
    renderDayFooter(_day: string, events: CalendarEvent[]): string { return events.length > 1 ? `<span class="nv-cal-more">${events.length} away</span>` : ''; }
    renderToolbarEnd(): string { return '<a href="/hr/calendar" wire:navigate class="nv-cal-today-btn">Page version</a>'; }
}

export const hrWidgets = [WorkforceInsightsStats, DepartmentLeaveLoadChart, ProjectHealthChart, UtilizationRateChart, BudgetBurnRateChart];
/** Hors du tableau de bord HR, qui reste celui de la démo Filament : le calendrier a ses propres pages (`pages/calendar.ts`). */
export const calendarWidgets = [LeaveCalendar];
