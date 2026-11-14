/** The time zone if the runtime knows it, otherwise `UTC`: the name may come from the configuration of an application. */
export function safeTimezone(timezone: string): string {
    try {
        return new Intl.DateTimeFormat('en-GB', { timeZone: timezone }).resolvedOptions().timeZone;
    } catch {
        return 'UTC';
    }
}

export function formatTime(date: Date, timezone: string): string {
    return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(date);
}
