// Custom export formats: a file type of its own (JSON, PDF, ODS...) next to the built-in
// CSV and XLSX files, with its extension, MIME type, content generator, download link and downloader.
import type { Action } from '@navette-js/actions';
import type { Downloader } from './downloads.ts';
import type { NotificationActionInput } from './notification-actions.ts';

/** What a custom format's `generate()` receives: the rows of the export, as written to the CSV file before escaping. */
export type ExportFileContext = {
    /** The exporter class. */
    exporter: Function;
    /** The export run (its id, file name, column map, options...). */
    export: { id: string | number | null; fileName: string; columnMap: Record<string, string>; options: Record<string, unknown> } & Record<string, unknown>;
    /** Exported column names, in file order. */
    columns: string[];
    /** Header labels, in file order. */
    labels: string[];
    /** One array of values per record, in column order. */
    rows: unknown[][];
    options: Record<string, unknown>;
};

/**
 * A custom export format, passed to `ExportAction.formats([...])` or returned by an exporter's `getFormats()` next to `'csv'` and
 * `'xlsx'`:
 *
 * ```ts
 * const JsonFormat: ExportFormatInterface = {
 *     getExtension: () => 'json',
 *     getMimeType: () => 'application/json',
 *     generate: ({ columns, rows }) => JSON.stringify(rows.map((row) => Object.fromEntries(columns.map((name, i) => [name, row[i]])))),
 * };
 * ```
 */
export interface ExportFormatInterface {
    /** File extension (letters and digits), also the format's key: two formats may not share it. */
    getExtension(): string;
    /** Content type of the downloaded file. */
    getMimeType(): string;
    /** The file's content. */
    generate(context: ExportFileContext): string | Buffer | Promise<string | Buffer>;
    /**
     * The download link of the "Export completed" notification (`url` is the file's download URL): a `{ label, url }` object or a
     * notification `Action`. "Download .<extension>" by default.
     */
    getDownloadNotificationAction?(url: string, run: ExportFileContext['export']): NotificationActionInput | Action;
    /** How the file is sent (see `Downloader`); the exporter's `getDownloader(format)` may replace it. */
    getDownloader?(): Downloader;
}

/** Whether a value is a custom export format. */
export const isExportFormatObject = (value: unknown): value is ExportFormatInterface =>
    typeof value === 'object' && value !== null && typeof (value as ExportFormatInterface).getExtension === 'function' && typeof (value as ExportFormatInterface).generate === 'function' && typeof (value as ExportFormatInterface).getMimeType === 'function';

/** Key of a format: `'csv'`, `'xlsx'` or a custom format's extension. */
export const exportFormatKey = (format: string | ExportFormatInterface): string => (typeof format === 'string' ? format : format.getExtension());

/** Checks a list of formats (built-in names or custom formats) and removes duplicates; throws on an unknown or invalid one. */
export function normalizeExportFormats<T extends string | ExportFormatInterface>(formats: T[]): T[] {
    const seen = new Set<string>();
    const result: T[] = [];
    for (const format of formats) {
        if (typeof format === 'string') {
            if (format !== 'csv' && format !== 'xlsx') throw new Error(`Unknown export format [${format}]: use 'csv', 'xlsx' or an ExportFormatInterface object.`);
        } else if (!isExportFormatObject(format)) throw new Error('An export format must be \'csv\', \'xlsx\' or an object with getExtension(), getMimeType() and generate().');
        const key = exportFormatKey(format);
        if (!/^[A-Za-z0-9]{1,16}$/.test(key)) throw new Error(`Invalid export format extension [${key}]: letters and digits only.`);
        if (seen.has(key.toLowerCase())) continue;
        seen.add(key.toLowerCase());
        result.push(format);
    }
    return result;
}
