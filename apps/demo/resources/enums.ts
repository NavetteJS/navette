// Enums (label, color, icon) shared between resources.
export type EnumCase = { label: string; color: string; icon: string };
export const LEAVE_TYPES: Record<string, EnumCase> = {
    annual: { label: 'Annual Leave', color: 'success', icon: 'sun' },
    sick: { label: 'Sick Leave', color: 'danger', icon: 'heart' },
    personal: { label: 'Personal Leave', color: 'info', icon: 'user' },
    unpaid: { label: 'Unpaid Leave', color: 'warning', icon: 'banknotes' },
    parental: { label: 'Parental Leave', color: 'primary', icon: 'gift' },
};
export const LEAVE_STATUSES: Record<string, EnumCase> = {
    pending: { label: 'Pending', color: 'warning', icon: 'clock' },
    approved: { label: 'Approved', color: 'success', icon: 'check' },
    rejected: { label: 'Rejected', color: 'danger', icon: 'x-mark' },
    taken: { label: 'Taken', color: 'info', icon: 'check-badge' },
    cancelled: { label: 'Cancelled', color: 'gray', icon: 'x-circle' },
};
export const EXPENSE_STATUSES: Record<string, EnumCase> = {
    draft: { label: 'Draft', color: 'gray', icon: 'pencil' },
    submitted: { label: 'Submitted', color: 'info', icon: 'paper-airplane' },
    approved: { label: 'Approved', color: 'success', icon: 'check' },
    rejected: { label: 'Rejected', color: 'danger', icon: 'x-mark' },
    reimbursed: { label: 'Reimbursed', color: 'primary', icon: 'banknotes' },
};
export const PROJECT_STATUSES: Record<string, EnumCase> = {
    planning: { label: 'Planning', color: 'gray', icon: 'pencil-square' },
    active: { label: 'Active', color: 'success', icon: 'play' },
    on_hold: { label: 'On Hold', color: 'warning', icon: 'pause' },
    completed: { label: 'Completed', color: 'info', icon: 'check-circle' },
    cancelled: { label: 'Cancelled', color: 'danger', icon: 'x-mark' },
};
export const TASK_STATUSES: Record<string, EnumCase> = {
    backlog: { label: 'Backlog', color: 'gray', icon: 'inbox-stack' },
    todo: { label: 'To Do', color: 'info', icon: 'queue-list' },
    in_progress: { label: 'In Progress', color: 'warning', icon: 'arrow-path' },
    in_review: { label: 'In Review', color: 'primary', icon: 'eye' },
    completed: { label: 'Completed', color: 'success', icon: 'check-circle' },
    cancelled: { label: 'Cancelled', color: 'danger', icon: 'x-circle' },
};
export const TASK_PRIORITIES: Record<string, EnumCase> = {
    low: { label: 'Low', color: 'gray', icon: 'chevron-down' },
    medium: { label: 'Medium', color: 'info', icon: 'minus' },
    high: { label: 'High', color: 'warning', icon: 'chevron-up' },
    critical: { label: 'Critical', color: 'danger', icon: 'fire' },
};
export const EXPENSE_CATEGORIES: Record<string, EnumCase> = {
    travel: { label: 'Travel', color: 'info', icon: 'globe-alt' },
    meals: { label: 'Meals', color: 'success', icon: 'cake' },
    supplies: { label: 'Supplies', color: 'warning', icon: 'shopping-cart' },
    equipment: { label: 'Equipment', color: 'primary', icon: 'wrench-screwdriver' },
    software: { label: 'Software', color: 'gray', icon: 'computer-desktop' },
    other: { label: 'Other', color: 'gray', icon: 'ellipsis-horizontal' },
};
