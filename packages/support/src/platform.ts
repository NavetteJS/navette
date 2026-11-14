// The visitor's operating system, read from the browser's user agent.

/** An operating system family: Windows, Linux, macOS or anything else. */
export type Platform = 'windows' | 'linux' | 'mac' | 'other';

/**
 * Platforms, with `Platform.detect(userAgent)`, for example to write a keyboard shortcut
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
        // Order matters: "Windows" first, then "Mac" (iPhones and iPads say "like Mac OS X"), then "Linux" (Android too).
        if (agent.includes('Windows')) return 'windows';
        if (agent.includes('Mac')) return 'mac';
        if (agent.includes('Linux')) return 'linux';
        return 'other';
    },
} as const;
