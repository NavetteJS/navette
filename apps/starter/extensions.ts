// Extension points by example: a custom field and column, a custom create page, a plugin.
import { Field } from '@navette-js/forms';
import { CreateRecord, type PanelContext, type Plugin } from '@navette-js/panels';
import { e } from '@navette-js/support';
import { Column } from '@navette-js/tables';

/** Custom field: a 1-to-5 slider. A field renders its control and hands it to `wrap()`, which adds the label, hint and error. */
export class EffortField extends Field {
    static make(name: string): EffortField { return new EffortField(name); }
    getDefaultState(): unknown { return this._default ?? 1; }
    // The value comes from the browser: validate it, then convert it before saving.
    async getValidationRules() {
        return [...(await super.getValidationRules()), { name: 'between', passes: (value: unknown) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 5, message: (attribute: string) => `The ${attribute} field must be between 1 and 5.` }];
    }
    dehydrateState(state: unknown): unknown { return Number(state); }
    async toHtml(): Promise<string> {
        const input = `<input type="range" min="1" max="5" step="1" id="${e(this.getId())}" wire:model="${e(this.getStatePath())}"${(await this.isDisabled()) ? ' disabled' : ''} class="app-effort" />`;
        return this.wrap(input);
    }
}

/** Custom column: five dots. A column renders its cell content; `getState(record)` reads the value. */
export class EffortColumn<R = any> extends Column<R> {
    static make<R = any>(name: string): EffortColumn<R> { return new EffortColumn<R>(name); }
    async toHtml(record: R): Promise<string> {
        const effort = Math.max(0, Math.min(5, Math.floor(Number(await this.getState(record)) || 0)));
        return `<div class="nv-ta-text nv-ta-text-item nv-size-sm app-effort-cell" title="${effort}/5">${'●'.repeat(effort)}${'○'.repeat(5 - effort)}</div>`;
    }
}

/** Custom create page: lifecycle hooks fill in data and react to the creation. */
export class CreateTask extends CreateRecord {
    protected mutateFormDataBeforeCreate(data: Record<string, unknown>): Record<string, unknown> {
        // The author is not a form field: the server sets it from the session.
        return { ...data, created_by: (this._ctx as PanelContext).user?.email ?? null };
    }
    protected getCreatedNotificationTitle(): string { return 'Task created'; }
}

/** Plugin: a reusable bundle of panel configuration. */
export const footerPlugin = (text: string): Plugin => ({
    id: 'footer',
    register(panel) {
        // Render hook HTML is inserted as is: escape anything you don't control.
        panel.renderHook('panels::content.end', () => `<p class="app-footer">${e(text)}</p>`);
    },
});
