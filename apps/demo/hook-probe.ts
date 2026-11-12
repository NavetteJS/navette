// Sonde de test : pose un marqueur invisible à chaque emplacement de render hook réellement rendu par Navette.
// Activée seulement par NAVETTE_HOOK_PROBE (parcours tools/parity/e2e-render-hooks.mjs) ; jamais dans la démo normale.
import { ActionsRenderHook } from '@navette/actions';
import { PanelsRenderHook, UNPLACED_RENDER_HOOKS, type Plugin } from '@navette/panels';
import { TablesRenderHook } from '@navette/tables';

/** Dans `<head>`, seul un élément de métadonnées est valide. */
const IN_HEAD: string[] = [PanelsRenderHook.HEAD_START, PanelsRenderHook.HEAD_END, PanelsRenderHook.STYLES_BEFORE, PanelsRenderHook.STYLES_AFTER];
/** Emplacements dont le rendu remplace le balisage par défaut : la sonde n'y rend rien, sauf demande explicite. */
const REPLACING: string[] = [TablesRenderHook.FILTER_INDICATORS, TablesRenderHook.HEADER_CELL];

export const hookProbe = (scoped: unknown): Plugin => ({
    id: 'hook-probe',
    register(panel) {
        const names = new Set<string>([...Object.values(PanelsRenderHook), ...Object.values(TablesRenderHook), ...Object.values(ActionsRenderHook)]);
        for (const name of names) {
            if (name in UNPLACED_RENDER_HOOKS || REPLACING.includes(name)) continue;
            panel.renderHook(name, () => (IN_HEAD.includes(name) ? `<meta name="nv-hook" content="${name}">` : `<span hidden data-nv-hook="${name}"></span>`));
        }
        // Hook à portée : rendu seulement sur les pages de la resource donnée.
        panel.renderHook(PanelsRenderHook.PAGE_START, ({ scopes }) => `<span hidden data-nv-scoped="${scopes.length}"></span>`, scoped);
        // Remplacement d'une cellule d'en-tête : seulement pour la colonne « Country » de la resource donnée.
        panel.renderHook(TablesRenderHook.HEADER_CELL, ({ data }) => (data.column.name === 'country' ? '<th scope="col" class="fi-ta-header-cell" data-nv-replaced-header>Pays</th>' : null), scoped);
    },
});
