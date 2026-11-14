/**
 * Global default display time zone. Components that show or edit a
 * date-time (`DateTimePicker` with a time, `TextColumn`, `TextEntry`) use it when they have no `timezone()` of
 * their own. Stored values stay in UTC; only their display (and the picker's input) is converted.
 */
type TimezoneValue = string | (() => string | null | undefined) | null;

let configured: TimezoneValue = null;

const assertTimezone = (zone: string): void => { new Intl.DateTimeFormat('en-US', { timeZone: zone }); };

export const NavetteTimezone = {
    /**
     * Sets the default time zone (an IANA name such as `America/New_York`), or a function returning it, called each
     * time a component needs it (for example to read the signed-in user's time zone). `null` restores `UTC`.
     */
    set(timezone: TimezoneValue = null): void {
        if (typeof timezone === 'string') assertTimezone(timezone);
        configured = timezone;
    },
    /** The default time zone: the configured one, else `UTC` (Navette stores dates in UTC). */
    get(): string {
        const zone = typeof configured === 'function' ? configured() : configured;
        if (!zone) return 'UTC';
        try { assertTimezone(zone); return zone; } catch { return 'UTC'; }
    },
    /** Whether a default other than `UTC` was configured with `set()`. */
    isConfigured(): boolean { return configured !== null && NavetteTimezone.get() !== 'UTC'; },
};
