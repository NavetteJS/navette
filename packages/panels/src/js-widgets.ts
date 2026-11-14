// JavaScript widgets (Filament's `HasJsRenderer` widgets): the content of the widget is rendered in the browser by an ES
// module the application brings (plain DOM code, React, Vue, Svelte…). The browser side is Filament's `js-widget.js` Alpine
// component; this file builds its markup, as Filament's `filament-widgets::js-widget` view does.
import { e, isLocalOrHttpUrl } from '@navette-js/support';
import { t } from '@navette-js/support/i18n';
import {
    isJsRendererExpression, jsRendererExpression, jsRendererString, md5, normalizeRendererConfiguration, phpJsonEncode,
    type JsRenderer, type JsRendererContext, type JsRendererInstance, type JsRendererLivewire, type Snapshot,
} from '@navette-js/schemas';

export type { JsonValue, Snapshot } from '@navette-js/schemas';

/**
 * Renderer of a JavaScript widget: the URL of an ES module whose default export is the mount function (a path of the site,
 * such as `NavetteAsset.getScriptSrc('revenue-overview')`, or an `http(s)://` URL), or a trusted function expression
 * (`RawJs.make('window.mountRevenueOverview')` from `@navette-js/forms`), or `null` for no renderer.
 */
export type JsWidgetRendererSource = JsRenderer | null;

/** A module URL the widget may import: a path of the site (`/js/…`, not `//host`) or an `http(s)://` URL. */
export const isSafeJsWidgetRendererUrl = (url: string): boolean => isLocalOrHttpUrl(url) && /^[^\s"'<>`]*$/.test(url);

/** Checks a renderer: an unsafe URL (`javascript:`, `data:`, `//host`, a relative path…) is a programming error. */
export function resolveJsWidgetRenderer(renderer: unknown): JsWidgetRendererSource {
    if (renderer === null || renderer === undefined || renderer === '') return null;
    if (isJsRendererExpression(renderer)) return renderer;
    if (typeof renderer !== 'string') throw new TypeError('getRenderer() must return a module URL, a RawJs expression or null.');
    if (!isSafeJsWidgetRendererUrl(renderer)) throw new Error(`Invalid JavaScript widget renderer URL: ${JSON.stringify(renderer)}. Use a path of the site (/js/…) or an http(s) URL.`);
    return renderer;
}

/**
 * Inner markup of a JavaScript widget (Filament's `filament-widgets::js-widget` view, without the widget wrapper): the section,
 * the keyed renderer element and the configuration it receives as `props.configuration`.
 */
export function jsWidgetContentHtml(options: { widgetId: string; assetUrl: string; renderer: unknown; rendererConfiguration: unknown }): string {
    const renderer = resolveJsWidgetRenderer(options.renderer);
    const configuration = phpJsonEncode(normalizeRendererConfiguration(options.rendererConfiguration));
    // `x-data` stays stable when the configuration changes: only the keyed span is replaced, and its `x-init` updates the
    // mounted renderer in place. Another renderer changes the outer key, which remounts it.
    return `<section x-data="{
        isCollapsed:  false ,
    }" class="fi-section"><div class="fi-section-content-ctn"><div class="fi-section-content"><div
            wire:key="${e(`${options.widgetId}.renderer.${md5(jsRendererString(renderer))}`)}"
            x-load
            x-load-src="${e(options.assetUrl)}"
            x-data="jsWidgetComponent({
                        renderer: ${e(jsRendererExpression(renderer))},
                        rendererConfiguration: JSON.parse(
                            $el.querySelector('[data-renderer-configuration]').dataset
                                .rendererConfiguration,
                        ),
                    })"
        >
            <span
                hidden
                wire:key="${e(`${options.widgetId}.renderer-configuration.${md5(configuration)}`)}"
                data-renderer-configuration="${e(configuration)}"
                x-init="updateRendererConfiguration(JSON.parse($el.dataset.rendererConfiguration))"
            ></span>
            <div wire:ignore x-ref="host"></div>
            <p x-cloak x-show="hasError" role="alert">
                ${e(t('filament-widgets::js-widget.failed_to_load'))}
            </p>
        </div></div></div></section>`;
}

// Types for renderer modules written in TypeScript (`import type { JsWidgetRenderer } from '@navette-js/panels'`).

export interface JsWidgetProps<Configuration = Record<string, unknown>> {
    readonly configuration: Snapshot<Configuration>;
}
/** Common proxy methods. The runtime object is Livewire's unmodified `$wire`. */
export interface JsWidgetLivewire extends JsRendererLivewire {}
export interface JsWidgetUtilities<Methods = Record<never, never>> {
    readonly $wire: JsWidgetLivewire & Methods;
}
export interface JsWidgetRendererContext<Configuration = Record<string, unknown>, Methods = Record<never, never>>
    extends JsRendererContext<JsWidgetProps<Configuration>, JsWidgetUtilities<Methods>> {}
export interface JsWidgetRendererInstance<Configuration = Record<string, unknown>> extends JsRendererInstance<JsWidgetProps<Configuration>> {}
/** Default export of a renderer module: mounts the UI in `host` and returns its `update()` and `destroy()` methods. */
export type JsWidgetRenderer<Configuration = Record<string, unknown>, Methods = Record<never, never>> = (
    context: JsWidgetRendererContext<Configuration, Methods>,
) => JsWidgetRendererInstance<Configuration> | Promise<JsWidgetRendererInstance<Configuration>>;
