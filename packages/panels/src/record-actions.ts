// Prebuilt record actions (Filament's `CreateAction`, `EditAction`, `ViewAction`, `ReplicateAction`, `DeleteAction`,
// `ForceDeleteAction`, `RestoreAction`, their bulk variants, and the relationship actions `AttachAction`, `DetachAction`,
// `AssociateAction`, `DissociateAction`): each one is an `Action` subclass set up by its `make()`.
//
// The relationship actions work with the static methods of the relation manager hosting them (`attach()`,
// `searchAttachable()`… see `RelationManager`). Every key they receive comes from the browser: it is checked again against the
// manager (`attachableLabel()`, `associableLabel()`, the options query) before anything is written.
import { Action, ActionHalt, type ActionCallContext } from '@navette-js/actions';
import { Field, Select, TableSelect, saveSchemaRelationships, type TableConfiguration } from '@navette-js/forms';
import type { Schema } from '@navette-js/schemas';
import { configured, icons, js } from '@navette-js/support';
import { t, tc } from '@navette-js/support/i18n';
import { TrashedFilter } from '@navette-js/tables';
import type { DataAdapter } from '@navette-js/database';
import { Notification } from './notifications.ts';
import { can, type RelationManager, type Resource } from './index.ts';

type Context = ActionCallContext & Record<string, unknown>;
type ResourceLike = typeof Resource | any;
const ucfirst = (s: string) => s.replace(/^./, (c) => c.toUpperCase());
const titleCase = (s: unknown) => String(s).split(' ').map(ucfirst).join(' ');
const isSafeUrl = (url: unknown): url is string => typeof url === 'string' && /^(\/(?!\/)|https?:\/\/)/.test(url);
const managerOf = (livewire: any) => livewire.constructor as typeof RelationManager;
const attributesOf = (record: any): Record<string, unknown> => (typeof record?.toJSON === 'function' ? record.toJSON() : { ...(record ?? {}) });

/** Value of the table's trashed filter: `'1'` with deleted records, `'0'` only deleted records, `null` without. */
const trashedFilterValue = (livewire: any): string | null => {
    const filter = livewire.getTable?.().getFilters().find((candidate: any) => candidate instanceof TrashedFilter);
    const value = filter ? livewire.tableFilters?.[filter.name]?.value : null;
    return value === '1' || value === '0' ? value : null;
};

/**
 * Success outcome of a prebuilt action: its notification (`successNotificationTitle()`, `successNotification()`), then the
 * redirect (`successRedirectUrl()`, or `fallbackUrl`). Only local or http(s) URLs are followed.
 */
export async function sendActionSuccess(action: Action, ctx: Context, defaultTitle: string | null, fallbackUrl: string | null = null): Promise<void> {
    let notification: any = Notification.make().success().title(action.getSuccessNotificationTitle() ?? defaultTitle ?? '');
    const customize = action.getSuccessNotificationCustomizer();
    if (customize) notification = customize(notification, ctx);
    if (notification && notification.getData().title) notification.send();
    const url = (await action.getSuccessRedirectUrl(ctx)) ?? fallbackUrl;
    if (isSafeUrl(url)) ctx.livewire.redirect(url, true);
}

/**
 * Failure outcome of a prebuilt action: the failure notification (`failureNotificationTitle()`, `failureNotification()`), sent
 * when it has a title, then `failureRedirectUrl()`. For a bulk action, `ctx` carries the counts (`successCount`, `totalCount`…).
 */
export async function sendActionFailure(action: Action, ctx: Context, counts: { success: number; total: number } = { success: 0, total: 1 }, body: string | null = null, fallbackTitle: string | null = null): Promise<void> {
    if (!action.isFailureNotificationDisabled()) {
        let notification: any = Notification.make().title(action.getFailureNotificationTitle(counts.success, counts.total) ?? fallbackTitle ?? '').persistent();
        (counts.success ? notification.warning() : notification.danger());
        if (body) notification.body(body);
        const customize = action.getFailureNotificationCustomizer();
        if (customize) notification = customize(notification, ctx);
        if (notification && notification.getData().title) notification.send();
    }
    const url = await action.getFailureRedirectUrl(ctx);
    if (isSafeUrl(url)) ctx.livewire.redirect(url, true);
}

/** Counts of a bulk run, as Filament injects them into the failure notification and its title. */
export type BulkOutcome = { total: number; success: number; unauthorized: number; failed: number };

/**
 * Outcome of a bulk action: the success notification and redirect when every record was processed, otherwise the failure
 * notification (with the lines for unauthorized and failed records) and redirect. Then clears the selection if asked.
 */
export async function sendBulkActionOutcome(action: Action, ctx: Context, outcome: BulkOutcome): Promise<void> {
    const { total, success, unauthorized, failed } = outcome;
    const counts = { successCount: success, failureCount: total - success, totalCount: total, isAll: success === 0, missingAuthorizationFailureMessageCount: unauthorized, missingProcessingFailureMessageCount: failed, records: undefined };
    const context: Context = { ...ctx, ...counts };
    if (unauthorized + failed === 0) await sendActionSuccess(action, context, null);
    else {
        const body = [unauthorized ? action.getMissingBulkAuthorizationFailureNotificationMessage(unauthorized, total) : null, failed ? action.getMissingBulkProcessingFailureNotificationMessage(failed, total) : null].filter(Boolean).join(' ');
        // Without a failure title, the success title keeps the user informed.
        await sendActionFailure(action, context, { success, total }, body || null, action.getSuccessNotificationTitle());
    }
    if (action.shouldDeselectRecordsAfterCompletion()) ctx.livewire.deselectAllTableRecords?.();
}

/**
 * Base of the prebuilt actions whose process can be replaced with `using()` (Filament's `CanCustomizeProcess`): the default
 * process (creating, saving, deleting…) is skipped, the notifications and redirects stay.
 */
export class CustomizableAction extends Action {
    private _using: ((ctx: Context) => unknown) | null = null;
    /**
     * Replaces the action's process. The function receives the context (`data`, `record`, `livewire`; `records` and `keys`
     * for a bulk action; `recordKeys` and `pivot` for attach) and returns what the default process would: the created record
     * (create), `false` for a failure (delete, restore…).
     */
    using(callback: ((ctx: Context) => unknown) | null): this { this._using = callback; return this; }
    hasCustomProcess(): boolean { return this._using !== null; }
    /** Runs `using()` when set, otherwise the default process. */
    async process<T>(fallback: (ctx: Context) => T | Promise<T>, ctx: Context): Promise<T> {
        return (this._using ? await this._using({ ...ctx, action: this }) : await fallback(ctx)) as T;
    }
}

/** A modal footer button submitting the mounted action with `{ another: true }` ("… & create another"). */
const anotherAction = (name: string, label: string) => Action.make(name).label(label).color('gray').action(`callMountedAction(${js({ another: true })})`);

/**
 * The "… & … another" footer button of a prebuilt action: it is rebuilt when the option changes, and replaced (like Filament)
 * when `extraModalFooterActions()` is called with other actions.
 */
class AnotherFooter {
    enabled = true;
    modify: ((action: Action) => Action | void) | null = null;
    custom: Action[] | null = null;
    private readonly name: string;
    private readonly label: () => string;
    constructor(name: string, label: () => string) { this.name = name; this.label = label; }
    build(): Action | null {
        if (!this.enabled) return null;
        const action = anotherAction(this.name, this.label());
        return (this.modify?.(action) as Action | undefined) ?? action;
    }
    actions(): Action[] { return this.custom ?? [this.build()].filter((action): action is Action => action !== null); }
}

/** Create in a modal with the resource form. */
export class CreateAction extends CustomizableAction {
    private readonly _another = new AnotherFooter('createAnother', () => t('filament-actions::create.single.modal.actions.create_another.label'));
    /**
     * Without a resource, the resource (or relation manager) is the host component's. A name (`CreateAction.make('createPost')`)
     * replaces the default one.
     */
    static make(resourceOrName: ResourceLike | string | null = null, name: string | null = null): CreateAction {
        const resource = typeof resourceOrName === 'string' ? null : resourceOrName;
        const action = new CreateAction((typeof resourceOrName === 'string' ? resourceOrName : name) ?? 'create');
        const of = (livewire: any) => resource ?? livewire.resource;
        action.authorize(({ livewire, record }) => can(livewire, 'create', record))
            .label(({ livewire }) => t('filament-actions::create.single.label', { label: of(livewire).modelLabel }))
            .modalHeading(({ livewire }) => t('filament-actions::create.single.modal.heading', { label: titleCase(of(livewire).modelLabel) }))
            .modalSubmitActionLabel(t('filament-actions::create.single.modal.actions.create.label'))
            .groupedIcon(icons.resolve('actions::create-action.grouped') ?? 'm-plus')
            // A relation manager with a related resource: its create page instead of the modal.
            .url(({ livewire }) => (resource ? null : ((livewire as any)?.resource?.getRelatedResourceUrl?.('create') ?? null)))
            .schema((schema: Schema) => of(schema.livewire).form(schema))
            .action(async (ctx) => {
                const record = await action.process((c) => of(c.livewire).adapter.create(c.data), ctx as Context);
                if (ctx.schema && record) await saveSchemaRelationships(ctx.schema, record);
                await sendActionSuccess(action, { ...ctx, record } as Context, t('filament-actions::create.single.notifications.created.title'));
            });
        action.refreshFooter();
        // `configureUsing()` setups run after the default setup, as in Filament.
        return configured(action);
    }
    /** `false`: no "Create & create another" button in the modal. */
    createAnother(condition = true): this { this._another.enabled = condition; return this.refreshFooter(); }
    canCreateAnother(): boolean { return this._another.enabled; }
    /** Customizes the "Create & create another" button: `(action) => action.label('Save and add another')`. */
    createAnotherAction(callback: ((action: Action) => Action | void) | null): this { this._another.modify = callback; return this.refreshFooter(); }
    /** The "Create & create another" button (to place it in custom footer actions). */
    getCreateAnotherAction(): Action { return this._another.build() ?? anotherAction('createAnother', t('filament-actions::create.single.modal.actions.create_another.label')); }
    extraModalFooterActions(actions: Action[]): this { if (this._another) this._another.custom = actions; return super.extraModalFooterActions(actions); }
    private refreshFooter(): this { return super.extraModalFooterActions(this._another.actions()); }
}

/** Attributes of a record, changed by `mutateRecordDataUsing()`. */
type MutateRecordData = (data: Record<string, unknown>, ctx: Context) => Record<string, unknown> | Promise<Record<string, unknown>>;

/** Edit a table row in a modal, with the resource form. */
export class EditAction extends CustomizableAction {
    private _mutateRecordData: MutateRecordData | null = null;
    /** Without an argument, the resource (or relation manager) is the host component's. */
    static make(resourceOrName: ResourceLike | string | null = null, name: string | null = null): EditAction {
        const resource = typeof resourceOrName === 'string' ? null : resourceOrName;
        const action = new EditAction((typeof resourceOrName === 'string' ? resourceOrName : name) ?? 'edit');
        const of = (livewire: any) => resource ?? livewire.resource;
        action.authorize(({ livewire, record }) => can(livewire, 'update', record))
            .label(t('filament-actions::edit.single.label')).tableIcon(icons.resolve('actions::edit-action') ?? 'c-pencil-square').groupedIcon(icons.resolve('actions::edit-action.grouped') ?? 'm-pencil-square')
            .modalHeading(({ livewire, record }) => t('filament-actions::edit.single.modal.heading', { label: of(livewire).getRecordTitle(record) }))
            .modalSubmitActionLabel(t('filament-actions::edit.single.modal.actions.save.label'))
            // A relation manager with a related resource: its edit page instead of the modal.
            .url(({ livewire, record }) => (resource || !record ? null : ((livewire as any)?.resource?.getRelatedResourceUrl?.('edit', (livewire as any).resource.adapter.getKey(record)) ?? null)))
            .schema((schema: Schema) => of(schema.livewire).form(schema))
            .fillForm(async (ctx) => action.mutateRecordData(attributesOf(ctx.record), ctx as Context))
            .action(async (ctx) => {
                const adapter = of(ctx.livewire).adapter;
                const saved = await action.process(async (c) => {
                    const pivotNames: string[] = of(c.livewire).pivotFieldNames?.() ?? [];
                    let data = c.data;
                    if (pivotNames.length) {
                        const pivot = Object.fromEntries(Object.entries(data ?? {}).filter(([name]) => pivotNames.includes(name)));
                        data = Object.fromEntries(Object.entries(data ?? {}).filter(([name]) => !pivotNames.includes(name)));
                        await managerOf(c.livewire).updatePivot(c.livewire.ownerRecord, adapter.getKey(c.record), pivot);
                    }
                    return Object.keys(data ?? {}).length ? adapter.update(adapter.getKey(c.record), data) : c.record;
                }, ctx as Context);
                if (ctx.schema) await saveSchemaRelationships(ctx.schema, saved ?? ctx.record);
                await sendActionSuccess(action, ctx as Context, t('filament-actions::edit.single.notifications.saved.title'));
            });
        // `configureUsing()` setups run after the default setup, as in Filament.
        return configured(action);
    }
    /** Changes the record's attributes before they fill the form: `(data) => ({ ...data, name: data.name.trim() })`. */
    mutateRecordDataUsing(callback: MutateRecordData | null): this { this._mutateRecordData = callback; return this; }
    /** @internal */
    async mutateRecordData(data: Record<string, unknown>, ctx: Context): Promise<Record<string, unknown>> { return this._mutateRecordData ? ((await this._mutateRecordData(data, ctx)) ?? data) : data; }
}

/**
 * Link to the record's view page (when the resource has one). Otherwise the record opens in a modal: the resource's
 * infolist, or its form with every field disabled and filled with the record's attributes.
 */
export class ViewAction extends Action {
    private _mutateRecordData: MutateRecordData | null = null;
    static make(resourceOrName: ResourceLike | string | null = null, name: string | null = null): ViewAction {
        const resource = typeof resourceOrName === 'string' ? null : resourceOrName;
        const action = new ViewAction((typeof resourceOrName === 'string' ? resourceOrName : name) ?? 'view');
        const of = (livewire: any) => resource ?? livewire.resource;
        action.authorize(({ livewire, record }) => can(livewire, 'view', record))
            .label(t('filament-actions::view.single.label')).color('gray').tableIcon(icons.resolve('actions::view-action') ?? 'c-eye').groupedIcon(icons.resolve('actions::view-action.grouped') ?? 'm-eye')
            .url(({ livewire, record }) => (record && of(livewire).hasViewPage ? of(livewire).getUrl('view', of(livewire).adapter.getKey(record)) : null))
            .modalHeading(({ livewire, record }) => t('filament-actions::view.single.modal.heading', { label: of(livewire).getRecordTitle(record) }))
            .modalSubmitAction(false).modalCancelActionLabel(t('filament-actions::view.single.modal.actions.close.label'))
            .schema((schema: Schema) => {
                const owner = of(schema.livewire);
                if (owner.hasViewPage) return null;
                const infolist = owner.infolist ? owner.infolist(schema.operation('view')) : null;
                if (infolist && infolist.getComponents().length) return infolist;
                if (!owner.form) return infolist;
                // No infolist: the form, read-only.
                const form = owner.form(schema.operation('view'));
                for (const component of form.getFlatComponents()) if (component instanceof Field) component.disabled();
                return form;
            })
            .fillForm(async (ctx) => action.mutateRecordData(attributesOf(ctx.record), ctx as Context));
        // `configureUsing()` setups run after the default setup, as in Filament.
        return configured(action);
    }
    /** Changes the record's attributes before they fill the (read-only) form. */
    mutateRecordDataUsing(callback: MutateRecordData | null): this { this._mutateRecordData = callback; return this; }
    /** @internal */
    async mutateRecordData(data: Record<string, unknown>, ctx: Context): Promise<Record<string, unknown>> { return this._mutateRecordData ? ((await this._mutateRecordData(data, ctx)) ?? data) : data; }
}

/** Duplicates a table row: the copy takes the record's attributes, except its key, timestamps and excluded ones. */
export class ReplicateAction extends CustomizableAction {
    private _excluded: string[] = [];
    private _mutateRecordData: MutateRecordData | null = null;
    private _beforeSaved: ((ctx: { replica: Record<string, unknown>; data: Record<string, unknown>; record: unknown }) => unknown) | null = null;
    private _afterSaved: ((ctx: { replica: unknown; data: Record<string, unknown>; record: unknown }) => unknown) | null = null;
    static make(name: string | null = null): ReplicateAction {
        const action = new ReplicateAction(name ?? 'replicate');
        action.authorize(({ livewire, record }) => can(livewire, 'replicate', record))
            .label(t('filament-actions::replicate.single.label')).tableIcon(icons.resolve('actions::replicate-action') ?? 'c-square-2-stack').groupedIcon(icons.resolve('actions::replicate-action.grouped') ?? 'm-square-2-stack')
            .modalHeading(({ livewire, record }) => t('filament-actions::replicate.single.modal.heading', { label: livewire.resource.getRecordTitle(record) }))
            .modalSubmitActionLabel(t('filament-actions::replicate.single.modal.actions.replicate.label'))
            // With a modal form (`schema()`), it is filled with the record's attributes; its data overrides them in the copy.
            .fillForm(async (ctx) => action.mutateRecordData(action.sourceAttributes(ctx.record), ctx as Context))
            .action(async (ctx) => {
                const { livewire, record } = ctx;
                const saved = await action.process(async (c) => {
                    const source = action.sourceAttributes(record);
                    // Without a modal form, `mutateRecordDataUsing()` changes the copied attributes.
                    let data = c.data ?? {};
                    if (!c.schema && !Object.keys(data).length && action._mutateRecordData) data = await action.mutateRecordData(source, c);
                    const replica: Record<string, unknown> = { ...source, ...data };
                    await action._beforeSaved?.({ replica, data, record });
                    return livewire.getDataAdapter().create(replica);
                }, ctx as Context);
                await action._afterSaved?.({ replica: saved, data: ctx.data ?? {}, record });
                await sendActionSuccess(action, { ...ctx, replica: saved } as Context, t('filament-actions::replicate.single.notifications.replicated.title'));
            });
        // `configureUsing()` setups run after the default setup, as in Filament.
        return configured(action);
    }
    /** Attributes not copied (besides the key and timestamps). */
    excludeAttributes(attributes: string[]): this { this._excluded = attributes; return this; }
    getExcludedAttributes(): string[] { return this._excluded; }
    /** Changes the copied attributes: they fill the modal form, or (without a form) become the copy. */
    mutateRecordDataUsing(callback: MutateRecordData | null): this { this._mutateRecordData = callback; return this; }
    /** Runs before the copy is saved, with its attributes (`replica`, changeable) and the modal form's data. */
    beforeReplicaSaved(callback: ((ctx: { replica: Record<string, unknown>; data: Record<string, unknown>; record: unknown }) => unknown) | null): this { this._beforeSaved = callback; return this; }
    /** Runs after the copy is saved, with the saved record. */
    afterReplicaSaved(callback: ((ctx: { replica: unknown; data: Record<string, unknown>; record: unknown }) => unknown) | null): this { this._afterSaved = callback; return this; }
    /** @internal */
    async mutateRecordData(data: Record<string, unknown>, ctx: Context): Promise<Record<string, unknown>> { return this._mutateRecordData ? ((await this._mutateRecordData(data, ctx)) ?? data) : data; }
    private sourceAttributes(record: unknown): Record<string, unknown> {
        const source = attributesOf(record);
        // No primary key, no created/updated timestamps.
        for (const attribute of ['id', 'created_at', 'updated_at', ...this._excluded]) delete source[attribute];
        return source;
    }
}

/** Shared by the single record actions run on the page's record or on a table row. */
const targetOf = (livewire: any, record: unknown) => record ?? livewire._record;
const inTable = (livewire: any) => typeof livewire.getTable === 'function';

/** Delete action with confirmation. On an edit page, deletes the page's record and returns to the list. On a table row, deletes the row. */
export class DeleteAction extends CustomizableAction {
    static make(name: string | null = null): DeleteAction {
        const action = new DeleteAction(name ?? 'delete');
        action.authorize(({ livewire, record }) => can(livewire, 'delete', record))
            .label(t('filament-actions::delete.single.label')).color('danger').keyBindings(['mod+d']).tableIcon(icons.resolve('actions::delete-action') ?? 'c-trash').groupedIcon(icons.resolve('actions::delete-action.grouped') ?? 'm-trash')
            .requiresConfirmation().modalIcon(icons.resolve('actions::delete-action.modal') ?? 'o-trash')
            // Hidden for an already soft-deleted record.
            .hidden(({ livewire, record }) => { const target = targetOf(livewire, record); return target ? (livewire as any).getDataAdapter().isTrashed(target) : false; })
            .modalHeading(({ livewire, record }) => t('filament-actions::delete.single.modal.heading', { label: livewire.resource.getRecordTitle(targetOf(livewire, record)) }))
            .modalSubmitActionLabel(t('filament-actions::delete.single.modal.actions.delete.label'))
            .action(async (ctx) => {
                const { livewire, record } = ctx;
                const adapter = livewire.getDataAdapter();
                const table = inTable(livewire);
                const result = await action.process((c) => adapter.delete(table ? adapter.getKey(c.record) : c.livewire.recordKey), { ...ctx, record: targetOf(livewire, record) } as Context);
                if (result === false) { await sendActionFailure(action, ctx as Context); return; }
                await sendActionSuccess(action, ctx as Context, t('filament-actions::delete.single.notifications.deleted.title'), table ? null : livewire.resource.getUrl());
            });
        // `configureUsing()` setups run after the default setup, as in Filament.
        return configured(action);
    }
}

/** Restores a soft-deleted record: the page's record, or a table row. Only visible when the record is deleted. */
export class RestoreAction extends CustomizableAction {
    static make(name: string | null = null): RestoreAction {
        const action = new RestoreAction(name ?? 'restore');
        action.authorize(({ livewire, record }) => can(livewire, 'restore', targetOf(livewire, record)))
            .label(t('filament-actions::restore.single.label')).color('gray').tableIcon(icons.resolve('actions::restore-action') ?? 'c-arrow-uturn-left').groupedIcon(icons.resolve('actions::restore-action.grouped') ?? 'm-arrow-uturn-left')
            .requiresConfirmation().modalIcon(icons.resolve('actions::restore-action.modal') ?? 'o-arrow-uturn-left')
            .hidden(({ livewire, record }) => { const target = targetOf(livewire, record); return !target || !(livewire as any).getDataAdapter().isTrashed(target); })
            .modalHeading(({ livewire, record }) => t('filament-actions::restore.single.modal.heading', { label: livewire.resource.getRecordTitle(targetOf(livewire, record)) }))
            .modalSubmitActionLabel(t('filament-actions::restore.single.modal.actions.restore.label'))
            .action(async (ctx) => {
                const { livewire, record } = ctx;
                const adapter = livewire.getDataAdapter();
                const table = inTable(livewire);
                const result = await action.process((c) => adapter.restore(table ? adapter.getKey(c.record) : c.livewire.recordKey), { ...ctx, record: targetOf(livewire, record) } as Context);
                if (!table) await livewire.hydrate();
                if (result === false) { await sendActionFailure(action, ctx as Context); return; }
                await sendActionSuccess(action, ctx as Context, t('filament-actions::restore.single.notifications.restored.title'));
            });
        // `configureUsing()` setups run after the default setup, as in Filament.
        return configured(action);
    }
}

/** Permanently deletes a soft-deleted record. Only visible when the record is deleted. */
export class ForceDeleteAction extends CustomizableAction {
    static make(name: string | null = null): ForceDeleteAction {
        const action = new ForceDeleteAction(name ?? 'forceDelete');
        action.authorize(({ livewire, record }) => can(livewire, 'forceDelete', targetOf(livewire, record)))
            .label(t('filament-actions::force-delete.single.label')).color('danger').tableIcon(icons.resolve('actions::force-delete-action') ?? 'c-trash').groupedIcon(icons.resolve('actions::force-delete-action.grouped') ?? 'm-trash')
            .requiresConfirmation().modalIcon(icons.resolve('actions::force-delete-action.modal') ?? 'o-trash')
            .hidden(({ livewire, record }) => { const target = targetOf(livewire, record); return !target || !(livewire as any).getDataAdapter().isTrashed(target); })
            .modalHeading(({ livewire, record }) => t('filament-actions::force-delete.single.modal.heading', { label: livewire.resource.getRecordTitle(targetOf(livewire, record)) }))
            .modalSubmitActionLabel(t('filament-actions::force-delete.single.modal.actions.delete.label'))
            .action(async (ctx) => {
                const { livewire, record } = ctx;
                const adapter = livewire.getDataAdapter();
                const table = inTable(livewire);
                const result = await action.process((c) => adapter.forceDelete(table ? adapter.getKey(c.record) : c.livewire.recordKey), { ...ctx, record: targetOf(livewire, record) } as Context);
                if (result === false) { await sendActionFailure(action, ctx as Context); return; }
                await sendActionSuccess(action, ctx as Context, t('filament-actions::force-delete.single.notifications.deleted.title'), table ? null : livewire.resource.getUrl());
            });
        // `configureUsing()` setups run after the default setup, as in Filament.
        return configured(action);
    }
}

/**
 * Runs a prebuilt bulk action: with `fetchSelectedRecords()` (the default), each selected record is loaded, checked with
 * `authorizeIndividualRecords()` and processed by `each` (`false` or an exception counts as a failure); with
 * `fetchSelectedRecords(false)`, the selected keys go to `many` at once, which returns how many were processed. `using()`
 * replaces both, receiving `records` (or only `keys`).
 */
async function runBulk(action: CustomizableAction, ctx: Context, each: (record: any) => unknown, many: (keys: string[]) => Promise<number>): Promise<void> {
    const livewire = ctx.livewire;
    if (action.shouldFetchSelectedRecords()) {
        if (action.hasCustomProcess()) {
            const keys: string[] = await livewire.getSelectedRecordKeys();
            const adapter = livewire.getDataAdapterForTable();
            const records = (await Promise.all(keys.map((key) => adapter.find(key)))).filter(Boolean);
            const result = await action.process(() => null, { ...ctx, keys, records } as Context);
            await sendBulkActionOutcome(action, ctx, { total: keys.length, success: result === false ? 0 : keys.length, unauthorized: 0, failed: result === false ? keys.length : 0 });
            return;
        }
        await livewire.processSelectedRecords(action, each);
        return;
    }
    const keys: string[] = await livewire.getSelectedRecordKeys();
    let processed = 0;
    try {
        const result = await action.process(() => many(keys), { ...ctx, keys, records: null } as Context);
        processed = typeof result === 'number' ? result : result === false ? 0 : keys.length;
    } catch (error) {
        console.error(error);
    }
    const success = Math.max(0, Math.min(processed, keys.length));
    await sendBulkActionOutcome(action, ctx, { total: keys.length, success, unauthorized: 0, failed: keys.length - success });
}

/**
 * Deletes the records selected in a table, one by one (adapter hooks and `authorizeIndividualRecords()` apply), or in one
 * query with `fetchSelectedRecords(false)`; the notification reports the records that could not be deleted.
 */
export class DeleteBulkAction extends CustomizableAction {
    static make(name: string | null = null): DeleteBulkAction {
        const action = new DeleteBulkAction(name ?? 'delete');
        action.authorize(({ livewire, record }) => can(livewire, 'deleteAny', record))
            .label(t('filament-actions::delete.multiple.label')).color('danger').icon(icons.resolve('actions::delete-action') ?? 'm-trash')
            .requiresConfirmation().modalIcon(icons.resolve('actions::delete-action.modal') ?? 'o-trash')
            // Showing only deleted records: there is nothing left to delete.
            .hidden(({ livewire }) => trashedFilterValue(livewire) === '0')
            .modalHeading(({ livewire }) => t('filament-actions::delete.multiple.modal.heading', { label: livewire.resource.getTitleCasePluralModelLabel() }))
            .modalSubmitActionLabel(t('filament-actions::delete.multiple.modal.actions.delete.label'))
            .successNotificationTitle(t('filament-actions::delete.multiple.notifications.deleted.title'))
            .failureNotificationTitle((success, total) => (success ? tc('filament-actions::delete.multiple.notifications.deleted_partial.title', success, { count: success, total }) : tc('filament-actions::delete.multiple.notifications.deleted_none.title', total, { count: total, total })))
            .missingBulkAuthorizationFailureNotificationMessage((count, total) => tc(`filament-actions::delete.multiple.notifications.${count === total ? 'deleted_none' : 'deleted_partial'}.missing_authorization_failure_message`, count, { count }))
            .missingBulkProcessingFailureNotificationMessage((count, total) => tc(`filament-actions::delete.multiple.notifications.${count === total ? 'deleted_none' : 'deleted_partial'}.missing_processing_failure_message`, count, { count }))
            .deselectRecordsAfterCompletion()
            .action(async (ctx) => {
                const adapter = ctx.livewire.getDataAdapterForTable();
                await runBulk(action, ctx as Context, (record) => adapter.delete(adapter.getKey(record)), (keys) => adapter.deleteMany(keys));
            });
        // `configureUsing()` setups run after the default setup, as in Filament.
        return configured(action);
    }
}

/** Restores the soft-deleted records selected in a table, each one checked with the `restore` ability. */
export class RestoreBulkAction extends CustomizableAction {
    static make(name: string | null = null): RestoreBulkAction {
        const action = new RestoreBulkAction(name ?? 'restore');
        action.authorize(({ livewire, record }) => can(livewire, 'restoreAny', record))
            .label(t('filament-actions::restore.multiple.label')).color('gray').icon(icons.resolve('actions::restore-action') ?? 'm-arrow-uturn-left')
            .requiresConfirmation().modalIcon(icons.resolve('actions::restore-action.modal') ?? 'o-arrow-uturn-left')
            .hidden(({ livewire }) => trashedFilterValue(livewire) === null)
            .modalHeading(({ livewire }) => t('filament-actions::restore.multiple.modal.heading', { label: livewire.resource.getTitleCasePluralModelLabel() }))
            .modalSubmitActionLabel(t('filament-actions::restore.multiple.modal.actions.restore.label'))
            .authorizeIndividualRecords('restore')
            .successNotificationTitle(t('filament-actions::restore.multiple.notifications.restored.title'))
            .failureNotificationTitle((success, total) => (success ? tc('filament-actions::restore.multiple.notifications.restored_partial.title', success, { count: success, total }) : tc('filament-actions::restore.multiple.notifications.restored_none.title', total, { count: total, total })))
            .missingBulkAuthorizationFailureNotificationMessage((count, total) => tc(`filament-actions::restore.multiple.notifications.${count === total ? 'restored_none' : 'restored_partial'}.missing_authorization_failure_message`, count, { count }))
            .missingBulkProcessingFailureNotificationMessage((count, total) => tc(`filament-actions::restore.multiple.notifications.${count === total ? 'restored_none' : 'restored_partial'}.missing_processing_failure_message`, count, { count }))
            .deselectRecordsAfterCompletion()
            .action(async (ctx) => {
                const adapter: DataAdapter = ctx.livewire.getDataAdapterForTable();
                // Only deleted records are restored; the others count as failures.
                await runBulk(action, ctx as Context, (record) => adapter.isTrashed(record) && adapter.restore(adapter.getKey(record)),
                    async (keys) => (adapter.restoreMany ? adapter.restoreMany(keys) : (await Promise.all(keys.map((key) => adapter.restore(key)))).filter(Boolean).length));
            });
        // `configureUsing()` setups run after the default setup, as in Filament.
        return configured(action);
    }
}

/** Permanently deletes the soft-deleted records selected in a table, each one checked with the `forceDelete` ability. */
export class ForceDeleteBulkAction extends CustomizableAction {
    static make(name: string | null = null): ForceDeleteBulkAction {
        const action = new ForceDeleteBulkAction(name ?? 'forceDelete');
        action.authorize(({ livewire, record }) => can(livewire, 'forceDeleteAny', record))
            .label(t('filament-actions::force-delete.multiple.label')).color('danger').icon(icons.resolve('actions::force-delete-action') ?? 'm-trash')
            .requiresConfirmation().modalIcon(icons.resolve('actions::force-delete-action.modal') ?? 'o-trash')
            .hidden(({ livewire }) => trashedFilterValue(livewire) === null)
            .modalHeading(({ livewire }) => t('filament-actions::force-delete.multiple.modal.heading', { label: livewire.resource.getTitleCasePluralModelLabel() }))
            .modalSubmitActionLabel(t('filament-actions::force-delete.multiple.modal.actions.delete.label'))
            .authorizeIndividualRecords('forceDelete')
            .successNotificationTitle(t('filament-actions::force-delete.multiple.notifications.deleted.title'))
            .failureNotificationTitle((success, total) => (success ? tc('filament-actions::force-delete.multiple.notifications.deleted_partial.title', success, { count: success, total }) : tc('filament-actions::force-delete.multiple.notifications.deleted_none.title', total, { count: total, total })))
            .missingBulkAuthorizationFailureNotificationMessage((count, total) => tc(`filament-actions::force-delete.multiple.notifications.${count === total ? 'deleted_none' : 'deleted_partial'}.missing_authorization_failure_message`, count, { count }))
            .missingBulkProcessingFailureNotificationMessage((count, total) => tc(`filament-actions::force-delete.multiple.notifications.${count === total ? 'deleted_none' : 'deleted_partial'}.missing_processing_failure_message`, count, { count }))
            .deselectRecordsAfterCompletion()
            .action(async (ctx) => {
                const adapter: DataAdapter = ctx.livewire.getDataAdapterForTable();
                await runBulk(action, ctx as Context, (record) => adapter.forceDelete(adapter.getKey(record)),
                    async (keys) => (adapter.forceDeleteMany ? adapter.forceDeleteMany(keys) : (await Promise.all(keys.map((key) => adapter.forceDelete(key)))).filter(Boolean).length));
            });
        // `configureUsing()` setups run after the default setup, as in Filament.
        return configured(action);
    }
}

// --- relationship actions

/**
 * How the attach and associate selects look for records, handed to the relation manager's `searchAttachable()`,
 * `attachableLabel()`, `searchAssociable()` and `associableLabel()`.
 */
export type RecordSelectOptions = {
    /** `recordSelectOptionsQuery()`: constraints on the records offered *and accepted*, applied to the adapter's query. */
    modifyQuery: ((query: any, search: string | null) => unknown) | null;
    /** `recordSelectSearchColumns()`; `null`: the manager's `recordTitleAttribute`. */
    searchColumns: string[] | null;
    /** Maximum number of options returned. */
    limit: number;
    /** The table's `allowDuplicates()`: records already attached are offered (and accepted) again. */
    allowsDuplicates: boolean;
};

type RelationKind = 'attach' | 'associate';
const isKey = (value: unknown): value is string | number => (typeof value === 'string' && value !== '' && value.length <= 255) || (typeof value === 'number' && Number.isFinite(value));

/** Attach and associate: a select (or a table) of records to relate to the owner, and the "… & … another" button. */
export class RecordSelectAction extends CustomizableAction {
    private _kind: RelationKind = 'attach';
    private _modifyRecordSelect: ((select: Select) => Select | void) | null = null;
    private _modifyOptionsQuery: ((query: any, search: string | null) => unknown) | null = null;
    private _preload = false;
    private _multiple = false;
    private _searchColumns: string[] | null = null;
    private _tableConfiguration: TableConfiguration | null = null;
    private _another: AnotherFooter | null = null;
    /** @internal */
    protected setUpRecordSelect(kind: RelationKind): this {
        this._kind = kind;
        this._another = new AnotherFooter(`${kind}Another`, () => t(`filament-actions::${kind}.single.modal.actions.${kind}_another.label`));
        this.label(t(`filament-actions::${kind}.single.label`)).color('gray').modalWidth('lg')
            .modalHeading(({ livewire }) => t(`filament-actions::${kind}.single.modal.heading`, { label: titleCase(livewire.resource.modelLabel) }))
            .modalSubmitActionLabel(t(`filament-actions::${kind}.single.modal.actions.${kind}.label`))
            .successNotificationTitle(t(`filament-actions::${kind}.single.notifications.${kind === 'attach' ? 'attached' : 'associated'}.title`));
        return this.refreshFooter();
    }
    /** Customizes the select of the modal: `(select) => select.placeholder('Select a post')`. */
    recordSelect(callback: ((select: Select) => Select | void) | null): this { this._modifyRecordSelect = callback; return this; }
    /**
     * Restricts the records offered *and accepted*: `(query, search) => query.where('team_id', user.teamId)`, on the query
     * of the manager's `relatedAdapter()` (or handed to your `searchAttachable()` / `attachableLabel()`).
     */
    recordSelectOptionsQuery(callback: ((query: any, search: string | null) => unknown) | null): this { this._modifyOptionsQuery = callback; return this; }
    /** Loads the first options with the modal, instead of on search only. */
    preloadRecordSelect(condition = true): this { this._preload = condition; return this; }
    isRecordSelectPreloaded(): boolean { return this._preload; }
    /** Several records can be selected and related at once. */
    multiple(condition = true): this { this._multiple = condition; return this; }
    isMultiple(): boolean { return this._multiple; }
    /** Columns searched for options (the manager's `recordTitleAttribute` by default). */
    recordSelectSearchColumns(columns: string[] | null): this { this._searchColumns = columns; return this; }
    getRecordSelectSearchColumns(): string[] | null { return this._searchColumns; }
    /**
     * Picks the records in a table instead of a select: a table configuration (a class or object with a `name` and a
     * `configure(table)` method). Its query and filters only change what is displayed: the records accepted are still the
     * manager's attachable (or associable) records, within `recordSelectOptionsQuery()`.
     */
    tableSelect(configuration: TableConfiguration | null): this { this._tableConfiguration = configuration; return this; }
    getTableSelectConfiguration(): TableConfiguration | null { return this._tableConfiguration; }
    extraModalFooterActions(actions: Action[]): this { if (this._another) this._another.custom = actions; return super.extraModalFooterActions(actions); }
    /** @internal */
    protected setAnother(condition: boolean): this { this._another!.enabled = condition; return this.refreshFooter(); }
    /** @internal */
    protected canRelateAnother(): boolean { return this._another?.enabled ?? false; }
    private refreshFooter(): this { return this._another ? super.extraModalFooterActions(this._another.actions()) : this; }

    /** Options handed to the manager for a request of this component. */
    getRecordSelectOptions(livewire: any, limit = 50): RecordSelectOptions {
        return { modifyQuery: this._modifyOptionsQuery, searchColumns: this._searchColumns, limit, allowsDuplicates: this._kind === 'attach' && livewire?.getTable?.().allowsDuplicates?.() === true };
    }
    private search(livewire: any, search: string, limit: number): Promise<[string, string][]> {
        const manager = managerOf(livewire);
        const options = this.getRecordSelectOptions(livewire, limit);
        return this._kind === 'attach' ? manager.searchAttachable(livewire.ownerRecord, search, options) : manager.searchAssociable(livewire.ownerRecord, search, options);
    }
    /** Label of a record that may be related, or `null` if it may not (the server-side check of every submitted key). */
    async getRelatableLabel(livewire: any, key: unknown): Promise<string | null> {
        if (!isKey(key)) return null;
        const manager = managerOf(livewire);
        const options = this.getRecordSelectOptions(livewire);
        return this._kind === 'attach' ? manager.attachableLabel(livewire.ownerRecord, String(key), options) : manager.associableLabel(livewire.ownerRecord, String(key), options);
    }
    /** The submitted keys that may be related (unknown, forged or excluded keys are dropped). */
    async getRelatableKeys(livewire: any, value: unknown): Promise<string[]> {
        const keys = [...new Set((Array.isArray(value) ? value : [value]).filter(isKey).map(String))].slice(0, 1000);
        const allowed: string[] = [];
        for (const key of keys) if ((await this.getRelatableLabel(livewire, key)) !== null) allowed.push(key);
        return allowed;
    }

    /** The field picking the records (`recordId`): a searchable select, or a table with `tableSelect()`. */
    getRecordSelect(): Field {
        const kind = this._kind;
        const label = t(`filament-actions::${kind}.single.modal.fields.record_id.label`);
        if (this._tableConfiguration) {
            const configuration = this._tableConfiguration;
            return TableSelect.make('recordId').label(label).hiddenLabel().required().multiple(this._multiple)
                .tableConfiguration(async (ctx) => this.tableConfigurationFor(ctx.livewire, configuration));
        }
        const limitOf = (select: Select) => Number((select as any)._optionsLimit ?? 50);
        let select: Select = Select.make('recordId').label(label).hiddenLabel().required().multiple(this._multiple).searchable()
            .getSearchResultsUsing((search, ctx) => this.search(ctx.livewire, search, limitOf(select)))
            .getOptionLabelUsing((value, ctx) => this.getRelatableLabel(ctx.livewire, value))
            .getOptionLabelsUsing(async (values, ctx) => {
                const labels: [string, string][] = [];
                for (const value of values.slice(0, 1000)) { const text = await this.getRelatableLabel(ctx.livewire, value); if (text !== null) labels.push([value, text]); }
                return labels;
            });
        if (this._preload) select.options((ctx) => this.search(ctx.livewire, '', limitOf(select)), { dynamic: false });
        if (this._modifyRecordSelect) select = (this._modifyRecordSelect(select) as Select | undefined) ?? select;
        return select;
    }
    /**
     * Table configuration of `tableSelect()` for this owner: the records of the manager's `relatedAdapter()`, within
     * `recordSelectOptionsQuery()`, without the records already related (unless the table allows duplicates).
     */
    private async tableConfigurationFor(livewire: any, configuration: TableConfiguration): Promise<TableConfiguration> {
        const manager = managerOf(livewire);
        const owner = String(livewire.ownerRecord);
        const related = manager.relatedAdapter(owner);
        const options = this.getRecordSelectOptions(livewire);
        const excluded = options.allowsDuplicates ? [] : await manager.adapterFor(owner).listKeys({ trashed: 'with' });
        const modify = this._modifyOptionsQuery;
        const own = configuration as any;
        return {
            // One definition per manager, owner and action: the excluded records differ from one owner to another.
            name: `${configuration.name}.${manager.name}.${this._kind}.${owner}`,
            ...(own.can ? { can: (ability: string, user: unknown, record?: unknown) => own.can(ability, user, record) } : {}),
            ...(own.getPluralModelLabel ? { getPluralModelLabel: () => own.getPluralModelLabel() } : own.pluralModelLabel ? { pluralModelLabel: own.pluralModelLabel } : {}),
            ...(related ? { getDataAdapter: () => related } : own.getDataAdapter ? { getDataAdapter: () => own.getDataAdapter() } : { adapter: own.adapter }),
            configure: (table: any) => {
                const configure = typeof own.configure === 'function' ? own.configure : own.table;
                const result = configure.call(own, table) ?? table;
                return result.modifyQueryUsing((query: any) => {
                    if (modify) modify(query, null);
                    if (excluded.length) excludeKeys(query, excluded);
                });
            },
        };
    }
    /** @internal Relates the submitted records, after checking them; `false` when none could be. */
    protected async relate(ctx: Context): Promise<boolean> {
        const { livewire } = ctx;
        const manager = managerOf(livewire);
        const { recordId, ...pivot } = ctx.data ?? {};
        // Keys come from the browser: only records the manager offers (within the options query) are related.
        const recordKeys = await this.getRelatableKeys(livewire, recordId);
        if (!recordKeys.length) return false;
        await this.process(async () => {
            for (const key of recordKeys) {
                if (this._kind === 'attach') await manager.attach(livewire.ownerRecord, key, pivot);
                else await manager.associate(livewire.ownerRecord, key);
            }
        }, { ...ctx, recordKeys, pivot } as Context);
        return true;
    }
}

/** `whereNotIn` on the key column of an Objection query (other query builders are left alone). */
function excludeKeys(query: any, keys: string[]): void {
    const model = typeof query?.modelClass === 'function' ? query.modelClass() : null;
    if (model) query.whereNotIn(`${model.tableName}.${model.idColumn}`, keys);
}

/** Attaches existing records to a relation manager's owner (many-to-many). */
export class AttachAction extends RecordSelectAction {
    static make(name: string | null = null): AttachAction {
        const action = new AttachAction(name ?? 'attach').setUpRecordSelect('attach');
        action.schema((schema: Schema) => [action.getRecordSelect(), ...managerOf(schema.livewire).pivotForm(schema)])
            .action(async (ctx) => {
                if (!(await action.relate(ctx as Context))) { await sendActionFailure(action, ctx as Context); action.halt(); }
                await sendActionSuccess(action, ctx as Context, null);
            });
        // `configureUsing()` setups run after the default setup, as in Filament.
        return configured(action);
    }
    /** `false`: no "Attach & attach another" button in the modal. */
    attachAnother(condition = true): this { return this.setAnother(condition); }
    canAttachAnother(): boolean { return this.canRelateAnother(); }
}

/** Gives existing records to the owner of a one-to-many relation manager (their foreign key). */
export class AssociateAction extends RecordSelectAction {
    static make(name: string | null = null): AssociateAction {
        const action = new AssociateAction(name ?? 'associate').setUpRecordSelect('associate');
        action.schema(() => [action.getRecordSelect()])
            .action(async (ctx) => {
                if (!(await action.relate(ctx as Context))) { await sendActionFailure(action, ctx as Context); action.halt(); }
                await sendActionSuccess(action, ctx as Context, null);
            });
        // `configureUsing()` setups run after the default setup, as in Filament.
        return configured(action);
    }
    /** `false`: no "Associate & associate another" button in the modal. */
    associateAnother(condition = true): this { return this.setAnother(condition); }
    canAssociateAnother(): boolean { return this.canRelateAnother(); }
}

/** Detaches a row from the owner without deleting it. */
export class DetachAction extends CustomizableAction {
    static make(name: string | null = null): DetachAction {
        const action = new DetachAction(name ?? 'detach');
        action.label(t('filament-actions::detach.single.label')).color('danger').icon(icons.resolve('actions::detach-action') ?? 'c-x-mark').groupedIcon(icons.resolve('actions::detach-action') ?? 'm-x-mark')
            .requiresConfirmation().modalIcon(icons.resolve('actions::detach-action.modal') ?? 'o-x-mark')
            .modalHeading(({ livewire, record }) => t('filament-actions::detach.single.modal.heading', { label: livewire.resource.getRecordTitle(record) }))
            .modalSubmitActionLabel(t('filament-actions::detach.single.modal.actions.detach.label'))
            .successNotificationTitle(t('filament-actions::detach.single.notifications.detached.title'))
            .action(async (ctx) => {
                const { livewire, record } = ctx;
                const result = await action.process<unknown>(() => managerOf(livewire).detach(livewire.ownerRecord, [livewire.resource.adapter.getKey(record)]), ctx as Context);
                if (result === false) { await sendActionFailure(action, ctx as Context); return; }
                await sendActionSuccess(action, ctx as Context, null);
            });
        // `configureUsing()` setups run after the default setup, as in Filament.
        return configured(action);
    }
}
/** Detaches the selected rows: one by one, or at once with `fetchSelectedRecords(false)`. */
export class DetachBulkAction extends CustomizableAction {
    static make(name: string | null = null): DetachBulkAction {
        const action = new DetachBulkAction(name ?? 'detach');
        action.label(t('filament-actions::detach.multiple.label')).color('danger').icon(icons.resolve('actions::detach-action') ?? 'm-x-mark')
            .requiresConfirmation().modalIcon(icons.resolve('actions::detach-action.modal') ?? 'o-x-mark')
            .modalHeading(({ livewire }) => t('filament-actions::detach.multiple.modal.heading', { label: livewire.resource.getPluralModelLabel() }))
            .modalSubmitActionLabel(t('filament-actions::detach.multiple.modal.actions.detach.label'))
            .successNotificationTitle(t('filament-actions::detach.multiple.notifications.detached.title'))
            .deselectRecordsAfterCompletion()
            .action(async (ctx) => {
                const { livewire } = ctx;
                const adapter = livewire.resource.adapter;
                // Selected keys come from the manager's current query, so they belong to the owner.
                await runBulk(action, ctx as Context, async (record) => { await managerOf(livewire).detach(livewire.ownerRecord, [adapter.getKey(record)]); },
                    async (keys) => { await managerOf(livewire).detach(livewire.ownerRecord, keys); return keys.length; });
            });
        // `configureUsing()` setups run after the default setup, as in Filament.
        return configured(action);
    }
}

/** Removes a row from the owner (clears its foreign key) without deleting it. */
export class DissociateAction extends CustomizableAction {
    static make(name: string | null = null): DissociateAction {
        const action = new DissociateAction(name ?? 'dissociate');
        action.label(t('filament-actions::dissociate.single.label')).color('danger').icon(icons.resolve('actions::dissociate-action') ?? 'c-x-mark').groupedIcon(icons.resolve('actions::dissociate-action') ?? 'm-x-mark')
            .requiresConfirmation().modalIcon(icons.resolve('actions::dissociate-action.modal') ?? 'o-x-mark')
            .modalHeading(({ livewire, record }) => t('filament-actions::dissociate.single.modal.heading', { label: livewire.resource.getRecordTitle(record) }))
            .modalSubmitActionLabel(t('filament-actions::dissociate.single.modal.actions.dissociate.label'))
            .successNotificationTitle(t('filament-actions::dissociate.single.notifications.dissociated.title'))
            .action(async (ctx) => {
                const { livewire, record } = ctx;
                const result = await action.process<unknown>(() => managerOf(livewire).dissociate(livewire.ownerRecord, [livewire.resource.adapter.getKey(record)]), ctx as Context);
                if (result === false) { await sendActionFailure(action, ctx as Context); return; }
                await sendActionSuccess(action, ctx as Context, null);
            });
        // `configureUsing()` setups run after the default setup, as in Filament.
        return configured(action);
    }
}
/** Dissociates the selected rows: one by one, or at once with `fetchSelectedRecords(false)`. */
export class DissociateBulkAction extends CustomizableAction {
    static make(name: string | null = null): DissociateBulkAction {
        const action = new DissociateBulkAction(name ?? 'dissociate');
        action.label(t('filament-actions::dissociate.multiple.label')).color('danger').icon(icons.resolve('actions::dissociate-action') ?? 'm-x-mark')
            .requiresConfirmation().modalIcon(icons.resolve('actions::dissociate-action.modal') ?? 'o-x-mark')
            .modalHeading(({ livewire }) => t('filament-actions::dissociate.multiple.modal.heading', { label: livewire.resource.getPluralModelLabel() }))
            .modalSubmitActionLabel(t('filament-actions::dissociate.multiple.modal.actions.dissociate.label'))
            .successNotificationTitle(t('filament-actions::dissociate.multiple.notifications.dissociated.title'))
            .deselectRecordsAfterCompletion()
            .action(async (ctx) => {
                const { livewire } = ctx;
                const adapter = livewire.resource.adapter;
                // Selected keys come from the manager's current query, so they belong to the owner.
                await runBulk(action, ctx as Context, async (record) => { await managerOf(livewire).dissociate(livewire.ownerRecord, [adapter.getKey(record)]); },
                    async (keys) => { await managerOf(livewire).dissociate(livewire.ownerRecord, keys); return keys.length; });
            });
        // `configureUsing()` setups run after the default setup, as in Filament.
        return configured(action);
    }
}

// --- default attach / associate options of a relation manager with a `relatedAdapter()`

/**
 * Records of the manager's `relatedAdapter()` matching the search (in the search columns), within the options query, without
 * the records already related to the owner (unless duplicates are allowed): `[key, label]` pairs.
 */
export async function searchRelatedRecords(manager: typeof RelationManager, ownerKey: string, search: string, options: RecordSelectOptions): Promise<[string, string][]> {
    const adapter = requireRelatedAdapter(manager, ownerKey);
    const related = manager.adapterFor(ownerKey);
    const title = manager.recordTitleAttribute;
    const columns = options.searchColumns ?? (title ? [title] : []);
    const term = search.trim().slice(0, 1000);
    const modifiers = options.modifyQuery ? [(query: any) => { options.modifyQuery!(query, term || null); }] : [];
    const limit = Math.max(1, Math.min(options.limit, 1000));
    const found: [string, string][] = [];
    // Records already related are skipped page by page, so that the select still offers up to `limit` options.
    for (let page = 1; found.length < limit && page <= 20; page++) {
        const result = await adapter.paginate({ search: term || null, searchColumns: columns, modifiers, sort: title ? { column: title, direction: 'asc' } : null, page, perPage: limit });
        const keys = result.records.map((record: any) => adapter.getKey(record));
        const taken = options.allowsDuplicates ? new Set<string>() : new Set(await related.keysInScope(keys));
        for (const record of result.records) {
            const key = adapter.getKey(record);
            if (!taken.has(key)) found.push([key, relatedRecordTitle(manager, record, key)]);
        }
        if (page >= result.lastPage) break;
    }
    return found.slice(0, limit);
}

/** Label of a record that may be related to the owner (in the related adapter, within the options query, not already related), or `null`. */
export async function relatedRecordLabel(manager: typeof RelationManager, ownerKey: string, recordKey: string, options: RecordSelectOptions): Promise<string | null> {
    if (!isKey(recordKey)) return null;
    const adapter = requireRelatedAdapter(manager, ownerKey);
    const modifiers = options.modifyQuery ? [(query: any) => { options.modifyQuery!(query, null); }] : [];
    const [record] = (await adapter.paginate({ keys: [String(recordKey)], modifiers, page: 1, perPage: 1 })).records;
    if (!record) return null;
    const key = adapter.getKey(record);
    if (!options.allowsDuplicates && (await manager.adapterFor(ownerKey).keysInScope([key])).length) return null;
    return relatedRecordTitle(manager, record, key);
}

function requireRelatedAdapter(manager: typeof RelationManager, ownerKey: string): DataAdapter {
    const adapter = manager.relatedAdapter(ownerKey);
    if (!adapter) throw new Error(`${manager.name}: define relatedAdapter() (or searchAttachable() / attachableLabel(), searchAssociable() / associableLabel()).`);
    return adapter;
}
const relatedRecordTitle = (manager: typeof RelationManager, record: any, key: string): string => {
    const title = manager.recordTitleAttribute;
    if (title) return String(record?.[title] ?? key);
    const resource = manager.getRelatedResource?.();
    return resource && resource.recordTitleAttribute ? resource.getRecordTitle(record) : key;
};

// `ActionHalt` is re-exported for hooks written against this module.
export { ActionHalt };
