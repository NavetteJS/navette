// Creating an `Intl.DateTimeFormat` costs about twenty times more than using one: formatters are kept.
const formatters = new Map<string, Intl.DateTimeFormat>();
const MAX_FORMATTERS = 500;

/** A cached `Intl.DateTimeFormat`; throws like the constructor for an invalid time zone. */
export function dateTimeFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const key = `${locale}|${JSON.stringify(options)}`;
    let format = formatters.get(key);
    if (!format) {
        format = new Intl.DateTimeFormat(locale, options);
        if (formatters.size >= MAX_FORMATTERS) formatters.clear();
        formatters.set(key, format);
    }
    return format;
}
