// Test probe: puts a hidden marker at every render hook location Navette actually renders.
// Enabled only by NAVETTE_HOOK_PROBE (end-to-end tests), never in the normal demo.
import { ActionsRenderHook } from '@navette-js/actions';
import { Page, PanelsRenderHook, UNPLACED_RENDER_HOOKS, Widget, type Plugin, type SubNavigationItem } from '@navette-js/panels';
import { TablesRenderHook } from '@navette-js/tables';

/** Only metadata elements are valid in `<head>`. */
const IN_HEAD: string[] = [PanelsRenderHook.HEAD_START, PanelsRenderHook.HEAD_END, PanelsRenderHook.STYLES_BEFORE, PanelsRenderHook.STYLES_AFTER];
/** Hooks whose output replaces the default markup: the probe leaves them alone unless asked. */
const REPLACING: string[] = [TablesRenderHook.FILTER_INDICATORS, TablesRenderHook.HEADER_CELL];

class ProbeWidget extends Widget {
    static isLazy = false;
    async render(): Promise<string> { return this.wrap('<div data-nv-probe-widget>probe</div>'); }
}
/** Pages that exercise the sub-navigation positions the demo does not use, and footer widgets. */
const probePage = (slug: string, position: 'start' | 'end') => class extends Page {
    static slug = slug;
    static title = `Probe ${position}`;
    static shouldRegisterNavigation = false;
    static subNavigationPosition = position;
    getSubNavigation(): SubNavigationItem[] {
        const base = this.panel.getUrl('probe');
        return [{ label: 'Start', icon: null, url: `${base}/sub-start`, active: position === 'start' }, { label: 'End', icon: null, url: `${base}/sub-end`, active: position === 'end' }];
    }
    getFooterWidgets() { return [ProbeWidget]; }
};

export const hookProbe = (scoped: unknown): Plugin => ({
    id: 'hook-probe',
    register(panel) {
        const names = new Set<string>([...Object.values(PanelsRenderHook), ...Object.values(TablesRenderHook), ...Object.values(ActionsRenderHook)]);
        for (const name of names) {
            if (name in UNPLACED_RENDER_HOOKS || REPLACING.includes(name)) continue;
            panel.renderHook(name, () => (IN_HEAD.includes(name) ? `<meta name="nv-hook" content="${name}">` : `<span hidden data-nv-hook="${name}"></span>`));
        }
        // Scoped hook: rendered only on the given resource's pages.
        panel.renderHook(PanelsRenderHook.PAGE_START, ({ scopes }) => `<span hidden data-nv-scoped="${scopes.length}"></span>`, scoped);
        // Replaces the Country header cell of the given resource only.
        panel.renderHook(TablesRenderHook.HEADER_CELL, ({ data }) => (data.column.name === 'country' ? '<th scope="col" class="fi-ta-header-cell" data-nv-replaced-header>Country (hook)</th>' : null), scoped);
        panel.pages([probePage('probe/sub-start', 'start'), probePage('probe/sub-end', 'end')]);
        panel.widgets([ProbeWidget]);
    },
});
