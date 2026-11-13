// Departments: a simple resource (modal create and edit) and its row action menu.
// Run by e2e/run.mjs, which provides a throwaway instance on a copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile } = specArgs();
const db = openDatabase(dbFile);
const count = () => db.prepare('select count(*) as n from departments').get().n;
const first = db.prepare('select id, name, is_active from departments order by name limit 1').get();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const { step, exitCode } = reporter();
const openMenu = async (rowIndex = 0) => {
    await page.locator('.fi-ta-records tr').nth(rowIndex).locator('.fi-dropdown-trigger button').click();
    const panel = page.locator('.fi-dropdown-panel:visible');
    await panel.waitFor({ timeout: 5000 });
    return panel;
};

await login(page, BASE, user);

await step('list: 10 departments sorted by name, columns and color swatches', async () => {
    await page.goto(`${BASE}/hr/departments`);
    assert.equal(await page.locator('.fi-ta-records tr').count(), 10);
    assert.deepEqual((await page.locator('.fi-ta-header-cell').allInnerTexts()).map((x) => x.trim()).filter(Boolean), ['Name', 'Parent', 'Headcount', 'Budget', 'Color', 'Active']);
    assert.equal((await page.locator('.fi-ta-records tr').first().locator('.fi-ta-cell-name').innerText()).trim(), first.name);
    assert.equal(await page.locator('.fi-ta-color-item').count(), 10);
    assert.match(await page.locator('.fi-ta-cell-budget').first().innerText(), /^\s*\$[\d,]+\.\d\d\s*$/);
});
await step('compiled theme: rows over their headcount limit have a red background', async () => {
    const sheet = await page.locator('link[rel=stylesheet][href*="theme.css"]').count();
    assert.equal(sheet, 1, 'the compiled theme is not loaded (npm run build:theme -w @navette-js/demo)');
    const over = db.prepare('select d.name from departments d where d.headcount_limit > 0 and (select count(*) from employees e where e.department_id = d.id and e.deleted_at is null) > d.headcount_limit order by d.name').all().map((r) => r.name);
    assert.ok(over.length > 0, 'no department over its limit in the test database');
    const red = await page.evaluate(() => [...document.querySelectorAll('.fi-ta-row')].filter((r) => r.className.includes('bg-danger-50')).map((r) => [r.querySelector('.fi-ta-cell-name').innerText.trim(), getComputedStyle(r).backgroundColor]));
    assert.deepEqual(red.map((r) => r[0]), over);
    for (const [, color] of red) assert.notEqual(color, 'rgba(0, 0, 0, 0)');
});
await step('row menu: Edit, Adjust budget, (De)activate, Replicate, Delete', async () => {
    const panel = await openMenu();
    assert.deepEqual((await panel.locator('.fi-dropdown-list-item-label').allInnerTexts()).map((x) => x.trim()), ['Edit', 'Adjust budget', first.is_active ? 'Deactivate' : 'Activate', 'Replicate', 'Delete']);
    await page.keyboard.press('Escape');
});
const modal = page.locator('.fi-modal.fi-modal-open .fi-modal-window');
const wire = (fn) => page.evaluate(fn);
await step('"Edit" modal: form filled in (click on the row)', async () => {
    await page.locator('.fi-ta-records tr').first().locator('.fi-ta-cell-name button').click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal((await modal.locator('.fi-modal-heading').innerText()).trim(), `Edit ${first.name}`);
    assert.equal(await modal.locator('input[id$=".name"]').inputValue(), first.name);
    assert.equal(await modal.locator('input[id$=".slug"]').isDisabled(), true);
    await modal.locator('.fi-select-input-btn').waitFor({ timeout: 5000 });
    await modal.locator('.fi-modal-footer button', { hasText: 'Cancel' }).click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
});
await step('"New department" modal: default values, three buttons', async () => {
    await page.locator('.fi-header-actions-ctn button', { hasText: 'New department' }).click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal((await modal.locator('.fi-modal-heading').innerText()).trim(), 'Create Department');
    assert.deepEqual((await modal.locator('.fi-modal-footer button').allInnerTexts()).map((x) => x.trim()), ['Create', 'Create & create another', 'Cancel']);
    assert.equal(await modal.locator('input[id$=".budget"]').inputValue(), '0');
    assert.equal(await modal.locator('.fi-fo-toggle').getAttribute('aria-checked'), 'true');
});
await step('create: the slug follows the name when the field loses focus', async () => {
    // Accented on purpose: the slug must be transliterated.
    await modal.locator('input[id$=".name"]').fill('Navette Test Création');
    await modal.locator('input[id$=".name"]').blur();
    await page.waitForFunction(() => document.querySelector('.fi-modal-window input[id$=".slug"]')?.value === 'navette-test-creation', null, { timeout: 5000 });
});
await step('create: the searchable select queries the server', async () => {
    await modal.locator('.fi-select-input-btn').click();
    await page.locator('.fi-select-input-search-ctn input, .fi-select-input input[type=search], .fi-select-input input').first().fill('fin');
    const option = page.locator('.fi-select-input-option', { hasText: 'Finance' });
    await option.waitFor({ timeout: 8000 });
    await option.click();
});
await step('create: record saved, notification, modal closed', async () => {
    const n = count();
    await modal.locator('.fi-modal-footer button[type=submit]').click();
    await page.locator('.fi-no-notification', { hasText: 'Created' }).waitFor({ timeout: 5000 });
    assert.equal(count(), n + 1);
    const row = db.prepare("select * from departments where slug = 'navette-test-creation'").get();
    assert.equal(row.name, 'Navette Test Création');
    assert.equal(row.is_active, 1);
    assert.equal(row.parent_id, db.prepare("select id from departments where name = 'Finance'").get().id);
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
});
await step('create: a slug already in use is refused by the server', async () => {
    const n = count();
    await page.locator('.fi-header-actions-ctn button', { hasText: 'New department' }).click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    await modal.locator('input[id$=".name"]').fill('Navette Test Création');
    await modal.locator('input[id$=".name"]').blur();
    await page.waitForFunction(() => document.querySelector('.fi-modal-window input[id$=".slug"]')?.value === 'navette-test-creation', null, { timeout: 5000 });
    await modal.locator('.fi-modal-footer button[type=submit]').click();
    await modal.locator('.fi-fo-field-wrp-error-message', { hasText: 'already been taken' }).waitFor({ timeout: 5000 });
    assert.equal(count(), n);
    await modal.locator('.fi-modal-footer button', { hasText: 'Cancel' }).click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
});
await step('edit: description and toggle saved', async () => {
    await page.locator('.fi-ta-header-toolbar .fi-ta-search-field input').fill('Navette Test');
    await page.locator('.fi-ta-records tr').nth(0).locator('.fi-ta-cell-name', { hasText: 'Navette Test Création' }).waitFor({ timeout: 5000 });
    await page.waitForFunction(() => document.querySelectorAll('.fi-ta-records tr').length === 1, null, { timeout: 5000 });
    await page.locator('.fi-ta-records tr').first().locator('.fi-ta-cell-name button').click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    await modal.locator('textarea').fill('Test description');
    await modal.locator('.fi-fo-toggle').click();
    await modal.locator('.fi-modal-footer button[type=submit]').click();
    await page.locator('.fi-no-notification', { hasText: 'Saved' }).waitFor({ timeout: 5000 });
    const row = db.prepare("select * from departments where slug = 'navette-test-creation'").get();
    assert.equal(row.description, 'Test description');
    assert.equal(row.is_active, 0);
    assert.equal(row.name, 'Navette Test Création');
    db.prepare("delete from departments where slug = 'navette-test-creation'").run();
    await page.locator('.fi-ta-header-toolbar .fi-ta-search-field input').fill('');
    await page.waitForFunction(() => document.querySelectorAll('.fi-ta-records tr').length === 10, null, { timeout: 5000 });
});
await step('field method that is not exposed: a forged call has no effect', async () => {
    await page.locator('.fi-header-actions-ctn button', { hasText: 'New department' }).click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    const result = await wire(async () => { const c = window.Livewire.all().find((x) => x.el.querySelector('.fi-ta')); return [await c.$wire.callSchemaComponentMethod('mountedActionSchema0.parent_id', 'validate', []), (await c.$wire.callSchemaComponentMethod('mountedActionSchema0.parent_id', 'getOptionsForJs', [])).length]; });
    assert.equal(result[0], null);
    assert.ok(result[1] >= 4);
    await modal.locator('.fi-modal-footer button', { hasText: 'Cancel' }).click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
});
await step('"Deactivate" toggles the state in the database and the row icon', async () => {
    const panel = await openMenu();
    await panel.locator('.fi-dropdown-list-item', { hasText: first.is_active ? 'Deactivate' : 'Activate' }).click();
    await page.locator('.fi-ta-records tr').first().locator(first.is_active ? '.fi-ta-icon .fi-color-danger' : '.fi-ta-icon .fi-color-success').waitFor({ timeout: 5000 });
    assert.equal(db.prepare('select is_active from departments where id = ?').get(first.id).is_active, first.is_active ? 0 : 1);
});
await step('"Replicate": confirmation, copy created, notification', async () => {
    const before = count();
    const panel = await openMenu();
    await panel.locator('.fi-dropdown-list-item', { hasText: 'Replicate' }).click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal((await modal.locator('.fi-modal-heading').innerText()).trim(), `Replicate ${first.name}`);
    await modal.locator('.fi-modal-footer button[type=submit]').click();
    await page.locator('.fi-no-notification', { hasText: 'Replicated' }).waitFor({ timeout: 5000 });
    assert.equal(count(), before + 1);
    await page.locator('.fi-pagination-overview', { hasText: 'of 11' }).waitFor({ timeout: 5000 });
});
await step('"Delete": confirmation then the demo\'s notification, nothing is deleted', async () => {
    const before = count();
    const panel = await openMenu();
    await panel.locator('.fi-dropdown-list-item', { hasText: 'Delete' }).click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal((await modal.locator('.fi-modal-heading').innerText()).trim(), `Delete ${first.name}`);
    await modal.locator('.fi-modal-footer button[type=submit]').click();
    await page.locator('.fi-no-notification', { hasText: 'cheeky' }).waitFor({ timeout: 5000 });
    assert.equal(count(), before);
});
await step('"Adjust budget": form modal filled in', async () => {
    const before = db.prepare('select budget from departments where id = ?').get(first.id).budget;
    const panel = await openMenu();
    await panel.locator('.fi-dropdown-list-item', { hasText: 'Adjust budget' }).click();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal((await modal.locator('.fi-modal-heading').innerText()).trim(), 'Adjust budget');
    assert.equal(Number(await modal.locator('input').inputValue()), Number(before));
});
await step('"Adjust budget": server validation refuses a negative amount, nothing is written', async () => {
    const before = db.prepare('select budget from departments where id = ?').get(first.id).budget;
    // Bypasses the browser's HTML5 validation to reach the server's.
    await page.evaluate(async () => { const c = window.Livewire.all().find((x) => x.el.querySelector('.fi-ta')); await c.$wire.set('mountedActions.0.data.budget', -5, false); await c.$wire.callMountedAction(); });
    await page.locator('.fi-modal-window .fi-fo-field-wrp-error-message', { hasText: 'at least 0' }).waitFor({ timeout: 5000 });
    assert.equal(db.prepare('select budget from departments where id = ?').get(first.id).budget, before);
});
await step('"Adjust budget": saved, the cell and the database are updated', async () => {
    await modal.locator('input').fill('1234.5');
    await modal.locator('.fi-modal-footer button[type=submit]').click();
    await page.locator('.fi-ta-records tr').first().locator('.fi-ta-cell-budget', { hasText: '$1,234.50' }).waitFor({ timeout: 5000 });
    assert.equal(db.prepare('select budget from departments where id = ?').get(first.id).budget, 1234.5);
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
});
await step('forged row action on a record that does not exist: refused', async () => {
    const status = await page.evaluate(async () => {
        const component = window.Livewire.all().find((c) => c.el.querySelector('.fi-ta'));
        const response = await fetch('/livewire/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _token: document.querySelector('[data-csrf]').dataset.csrf, components: [{ snapshot: component.snapshotEncoded, updates: {}, calls: [{ method: 'mountAction', params: ['toggle_active', {}, { table: true, recordKey: '999999' }], metadata: {} }] }] }) });
        return response.status;
    });
    assert.equal(status, 404);
});
await step('no JavaScript error', async () => { assert.deepEqual(errors, []); });

await browser.close();
process.exit(exitCode());
