// The visitor's operating system, read from the browser's user agent (Filament's `Filament\Support\Enums\Platform`).

/** An operating system family: Windows, Linux, macOS or anything else. */
export type Platform = 'windows' | 'linux' | 'mac' | 'other';

/**
 * Platforms, with `Platform.detect(userAgent)` (Filament's `Platform::detect()`), for example to write a keyboard shortcut
 * the way the visitor's keyboard shows it:
 *
 * ```ts
 * panel.globalSearchFieldSuffix((userAgent) => {
 *     const platform = Platform.detect(userAgent);
 *     return platform === Platform.Mac ? '⌘K' : platform === Platform.Other ? null : 'CTRL+K';
 * });
 * ```
 */
export const Platform = {
    Windows: 'windows',
    Linux: 'linux',
    Mac: 'mac',
    Other: 'other',
    /** Platform of a user agent string (`req.headers['user-agent']`); an empty or unknown one is `Platform.Other`. */
    detect(userAgent: string | null | undefined): Platform {
        const agent = typeof userAgent === 'string' ? userAgent : '';
        // Same order as Filament: "Windows" first, then "Mac" (iPhones and iPads say "like Mac OS X"), then "Linux" (Android too).
        if (agent.includes('Windows')) return 'windows';
        if (agent.includes('Mac')) return 'mac';
        if (agent.includes('Linux')) return 'linux';
        return 'other';
    },
} as const;
