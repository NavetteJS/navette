// JavaScript renderers: components whose content is rendered in the browser by a module the application brings (React, Vue,
// Svelte or plain DOM code). The browser side is Filament's `js-component.js` / `js-field.js` Alpine components; this file
// builds their markup. It has no dependency on the schema classes, so that `index.ts` and `@navette-js/forms` can share it.
import { createHash } from 'node:crypto';
import { e, js } from '@navette-js/support';

/**
 * Trusted JavaScript function expression used instead of a module URL, such as `RawJs.make('window.mountMap')` from
 * `@navette-js/forms`. It is inserted into the page as code: never build it from user input.
 */
export interface JsRendererExpression {
    readonly js: string;
}

/** Renderer of a `JsComponent` or `JsField`: the URL of an ES module whose default export is the mount function, or a trusted expression. */
export type JsRenderer = string | JsRendererExpression;

export const isJsRendererExpression = (value: unknown): value is JsRendererExpression =>
    typeof value === 'object' && value !== null && typeof (value as JsRendererExpression).js === 'string';

/** JavaScript expression of a renderer: a quoted URL, the trusted expression itself, or `null`. */
export function jsRendererExpression(renderer: JsRenderer | null | undefined): string {
    if (renderer === null || renderer === undefined || renderer === '') return 'null';
    return isJsRendererExpression(renderer) ? renderer.js : js(String(renderer));
}

/** Text of a renderer, as PHP casts it to a string (used in the Livewire keys). */
export const jsRendererString = (renderer: JsRenderer | null | undefined): string =>
    renderer === null || renderer === undefined ? '' : isJsRendererExpression(renderer) ? renderer.js : String(renderer);

/** `md5()` of a string, in hexadecimal. */
export const md5 = (value: string): string => createHash('md5').update(value).digest('hex');

/**
 * PHP's `json_encode()` with its default flags: `/` is escaped, non-ASCII characters become `\uXXXX`, and an object without
 * keys is an empty array (`[]`), like an empty PHP array.
 */
export function phpJsonEncode(value: unknown): string {
    const normalize = (item: unknown): unknown => {
        if (Array.isArray(item)) return item.map(normalize);
        if (typeof item === 'object' && item !== null && typeof (item as { toJSON?: unknown }).toJSON !== 'function') {
            const entries = Object.entries(item).filter(([, entry]) => entry !== undefined);
            return entries.length ? Object.fromEntries(entries.map(([key, entry]) => [key, normalize(entry)])) : [];
        }
        return item;
    };
    return (JSON.stringify(normalize(value)) ?? 'null')
        .replace(/\//g, '\\/')
        .replace(/[\u0080-￿]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/** Configuration passed to a renderer: only a plain object is accepted (anything else, including `null`, is no configuration). */
export function normalizeRendererConfiguration(configuration: unknown): Record<string, unknown> {
    if (configuration === null || configuration === undefined) return {};
    if (typeof configuration !== 'object' || Array.isArray(configuration)) throw new TypeError('The renderer configuration must be an object of JSON-serializable values.');
    return configuration as Record<string, unknown>;
}

/** Markup of a schema component rendered by a JavaScript module, as Filament's `HasJsRenderer::toEmbeddedHtml()`. */
export function jsComponentHtml(options: {
    livewireKey: string | null;
    assetUrl: string;
    renderer: JsRenderer | null;
    rendererConfiguration: Record<string, unknown>;
    componentConfiguration: { id: string | null };
    extraAttributes?: string;
    failedToLoadMessage: string;
}): string {
    const key = options.livewireKey ?? '';
    const configuration = phpJsonEncode(options.rendererConfiguration);
    // `x-data` stays stable when the configuration changes: only the keyed span is replaced, and its `x-init` updates the
    // mounted renderer without remounting it.
    return `<div
            wire:key="${e(`${key}.${md5(phpJsonEncode(options.componentConfiguration) + jsRendererString(options.renderer))}`)}"
            x-load
            x-load-src="${e(options.assetUrl)}"
            x-data="jsSchemaComponent({
                renderer: ${e(jsRendererExpression(options.renderer))},
                rendererConfiguration: JSON.parse($el.querySelector('[data-renderer-configuration]').dataset.rendererConfiguration),
                componentConfiguration: ${js(options.componentConfiguration)},
            })"${options.extraAttributes ? ` ${options.extraAttributes}` : ''}
        >
            <span
                hidden
                wire:key="${e(`${key}.renderer-configuration.${md5(configuration)}`)}"
                data-renderer-configuration="${e(configuration)}"
                x-init="updateRendererConfiguration(JSON.parse($el.dataset.rendererConfiguration))"
            ></span>
            <div wire:ignore x-ref="host"></div>
            <p x-cloak x-show="hasError" role="alert">
                ${e(options.failedToLoadMessage)}
            </p>
        </div>`;
}

/** State binding of a field rendered by a JavaScript module: when its edits are sent to the server. */
export type JsFieldBindingConfiguration = { isLive: boolean; isLiveOnBlur: boolean; debounce: number | null };

/** Input settings of a field rendered by a JavaScript module, passed to the renderer's props. */
export type JsFieldConfiguration = {
    id: string;
    ariaDescribedBy: string;
    isDisabled: boolean;
    isReadOnly: boolean;
    isRequired: boolean;
    isInvalid: boolean;
};

/** Debounce in milliseconds: a number, or a string such as `500ms` or `0.5s`, as Filament reads `live(debounce:)`. */
export function debounceMilliseconds(debounce: number | string | null | undefined): number | null {
    if (debounce === null || debounce === undefined || debounce === '') return null;
    if (typeof debounce === 'number') return Math.trunc(debounce);
    const seconds = debounce.endsWith('s') && !debounce.endsWith('ms');
    const value = Number.parseFloat(debounce);
    return Number.isFinite(value) ? Math.trunc(value * (seconds ? 1000 : 1)) : null;
}

/** Control markup of a field rendered by a JavaScript module (to place in the field wrapper). */
export function jsFieldHtml(options: {
    livewireKey: string | null;
    statePath: string;
    assetUrl: string;
    renderer: JsRenderer | null;
    rendererConfiguration: Record<string, unknown>;
    fieldConfiguration: JsFieldConfiguration;
    bindingConfiguration: JsFieldBindingConfiguration;
    extraAttributes?: string;
    failedToLoadMessage: string;
}): string {
    const key = options.livewireKey ?? '';
    const configuration = phpJsonEncode(options.rendererConfiguration);
    const fieldConfiguration = phpJsonEncode(options.fieldConfiguration);
    return `<div
            wire:key="${e(`${key}.${md5(phpJsonEncode(options.bindingConfiguration) + jsRendererString(options.renderer))}`)}"
            x-load
            x-load-src="${e(options.assetUrl)}"
            x-data="jsFieldFormComponent({
                        state: $wire.$entangle(${e(js(options.statePath))}),
                        renderer: ${e(jsRendererExpression(options.renderer))},
                        rendererConfiguration: JSON.parse($el.querySelector('[data-renderer-configuration]').dataset.rendererConfiguration),
                        fieldConfiguration: {
                            ...${js(options.bindingConfiguration)},
                            ...JSON.parse($el.querySelector('[data-renderer-configuration]').dataset.fieldConfiguration),
                        },
                    })"${options.extraAttributes ? ` ${options.extraAttributes}` : ''}
        >
            <span
                hidden
                wire:key="${e(`${key}.renderer-configuration.${md5(phpJsonEncode([options.rendererConfiguration, options.fieldConfiguration]))}`)}"
                data-renderer-configuration="${e(configuration)}"
                data-field-configuration="${e(fieldConfiguration)}"
                x-init="updateRendererConfiguration(JSON.parse($el.dataset.rendererConfiguration), JSON.parse($el.dataset.fieldConfiguration))"
            ></span>
            <div wire:ignore x-ref="host"></div>
            <p x-cloak x-show="hasError" role="alert" class="nv-fo-field-wrp-error-message">
                ${e(options.failedToLoadMessage)}
            </p>
        </div>`;
}

// ------------------------------------------------------------------ renderer types (browser side)
// Types for the mount functions of `JsComponent` and `JsField` renderers, to import with `import type` in browser code.

/** Values must be JSON-serializable. */
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };
/** Deeply read-only view of a value received from Navette. */
export type Snapshot<T> = T extends object ? { readonly [Key in keyof T]: Snapshot<T[Key]> } : T;
/** The element to render into: `HTMLElement` when the DOM library is loaded. */
export type JsRendererHost = typeof globalThis extends { HTMLElement: { prototype: infer Element } } ? Element : any;

/** Common methods of Livewire's `$wire` proxy, passed unmodified. */
export interface JsRendererLivewire {
    $call<Result = unknown>(method: string, ...parameters: JsonValue[]): Promise<Result>;
    $get<Result = unknown>(path: string, isReactive?: boolean): Result;
    $set(path: string, value: JsonValue, isLive?: boolean): Promise<unknown>;
    $commit(): Promise<unknown>;
}

export interface JsRendererContext<Props, Utilities> {
    host: JsRendererHost;
    props: Props;
    utilities: Utilities;
}

export interface JsRendererInstance<Props> {
    /** Calls may overlap: cancel or order asynchronous work within the renderer. */
    update(props: Props): void | Promise<void>;
    /** Stops DOM work immediately. A rejected promise is reported, but remounting does not await cleanup. */
    destroy(): void | Promise<void>;
}

/** Schema utilities passed to a renderer as `utilities`, with the component's exposed methods (`$methodName`). */
export interface JsRendererUtilities<State = unknown> {
    readonly $wire: JsRendererLivewire;
    $callSchemaComponentMethod<Result = unknown>(method: string, argumentsObject?: Record<string, JsonValue>): Promise<Result | null>;
    /** Read it when needed, rather than destructuring this getter while mounting. */
    readonly $state: Snapshot<State>;
    readonly $statePath: string | null;
    $get<Result = unknown>(path: string, isAbsolute?: boolean): Snapshot<Result> | undefined;
    $set(path: string, value: JsonValue, isAbsolute?: boolean, isLive?: boolean): Promise<unknown>;
}

export interface JsComponentProps<Configuration = Record<string, unknown>> {
    readonly configuration: Snapshot<Configuration>;
    readonly id: string | null;
}

/** Mount function exported by default by a `JsComponent` renderer module. */
export type JsComponentRenderer<Configuration = Record<string, unknown>, Methods = Record<never, never>> = (
    context: JsRendererContext<JsComponentProps<Configuration>, JsRendererUtilities & Methods>,
) => JsRendererInstance<JsComponentProps<Configuration>> | Promise<JsRendererInstance<JsComponentProps<Configuration>>>;

export interface JsFieldProps<Value = unknown, Configuration = Record<string, unknown>> {
    readonly value: Snapshot<Value>;
    readonly configuration: Snapshot<Configuration>;
    readonly id: string;
    readonly ariaDescribedBy: string;
    readonly isDisabled: boolean;
    readonly isReadOnly: boolean;
    readonly isRequired: boolean;
    readonly isInvalid: boolean;
    readonly isLive: boolean;
    readonly isLiveOnBlur: boolean;
    readonly debounce: number | null;
    /** Sets the field state (ignored while the field is disabled or read-only). */
    readonly onChange: (value: Value | Snapshot<Value>) => void;
    readonly onBlur: () => void;
}

/** Mount function exported by default by a `JsField` renderer module. */
export type JsFieldRenderer<Value = unknown, Configuration = Record<string, unknown>, Methods = Record<never, never>> = (
    context: JsRendererContext<JsFieldProps<Value, Configuration>, JsRendererUtilities<Value> & Methods>,
) => JsRendererInstance<JsFieldProps<Value, Configuration>> | Promise<JsRendererInstance<JsFieldProps<Value, Configuration>>>;
