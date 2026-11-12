// Points d'extension, illustrés : un champ et une colonne sur mesure, une page de création personnalisée, un plugin.
// Voir docs/14-etendre.md.
import { Field } from '@navette-js/forms';
import { CreateRecord, type PanelContext, type Plugin } from '@navette-js/panels';
import { e } from '@navette-js/support';
import { Column } from '@navette-js/tables';

/** Champ sur mesure : un curseur de 1 à 5. Un champ rend son contrôle et le confie à `wrap()`, qui ajoute libellé, aide et erreur. */
export class EffortField extends Field {
    static make(name: string): EffortField { return new EffortField(name); }
    getDefaultState(): unknown { return this._default ?? 1; }
    // La valeur vient du navigateur : elle est validée, puis convertie avant d'être enregistrée.
    async getValidationRules() {
        return [...(await super.getValidationRules()), { name: 'between', passes: (value: unknown) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 5, message: (attribute: string) => `The ${attribute} field must be between 1 and 5.` }];
    }
    dehydrateState(state: unknown): unknown { return Number(state); }
    async toHtml(): Promise<string> {
        const input = `<input type="range" min="1" max="5" step="1" id="${e(this.getId())}" wire:model="${e(this.getStatePath())}"${(await this.isDisabled()) ? ' disabled' : ''} class="app-effort" />`;
        return this.wrap(input);
    }
}

/** Colonne sur mesure : cinq pastilles. Une colonne rend le contenu de sa cellule ; `getState(record)` lit la valeur. */
export class EffortColumn<R = any> extends Column<R> {
    static make<R = any>(name: string): EffortColumn<R> { return new EffortColumn<R>(name); }
    async toHtml(record: R): Promise<string> {
        const effort = Math.max(0, Math.min(5, Math.floor(Number(await this.getState(record)) || 0)));
        return `<div class="fi-ta-text fi-ta-text-item fi-size-sm app-effort-cell" title="${effort}/5">${'●'.repeat(effort)}${'○'.repeat(5 - effort)}</div>`;
    }
}

/** Page de création personnalisée : les crochets de cycle de vie complètent les données et réagissent à la création. */
export class CreateTask extends CreateRecord {
    protected mutateFormDataBeforeCreate(data: Record<string, unknown>): Record<string, unknown> {
        // L'auteur n'est pas un champ du formulaire : il est posé par le serveur, à partir de la session.
        return { ...data, created_by: (this._ctx as PanelContext).user?.email ?? null };
    }
    protected getCreatedNotificationTitle(): string { return 'Tâche créée'; }
}

/** Plugin : un paquet de configuration réutilisable d'un panel à l'autre. */
export const footerPlugin = (text: string): Plugin => ({
    id: 'footer',
    register(panel) {
        // Le HTML d'un render hook est inséré tel quel : on échappe ce qui n'est pas de nous.
        panel.renderHook('panels::content.end', () => `<p class="app-footer">${e(text)}</p>`);
    },
});
