// Employees: stats, tabs, filters, the "View profile" slide-over, row and bulk actions, tabbed form, relation managers.
// Run by e2e/run.mjs, which provides a throwaway instance on a copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile } = specArgs();
const db = openDatabase(dbFile);
const one = (sql, ...params) => db.prepare(sql).get(...params);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const { step, exitCode } = reporter({ errorLines: 4 });
const until = async (check, label) => { for (let i = 0; i < 40; i++) { if (check()) return; await page.waitForTimeout(250); } throw new Error(`timed out waiting for: ${label}`); };
const rows = page.locator('.fi-page > .fi-page-header-main-ctn .fi-ta-records tr.fi-ta-row');
const stats = async () => (await page.locator('.fi-wi-stats-overview-stat-value').allInnerTexts()).map((x) => x.trim());
const menuOf = async (row) => { await row.locator('.fi-dropdown-trigger button').click(); const panel = page.locator('.fi-dropdown-panel:visible'); await panel.waitFor({ timeout: 5000 }); return panel; };
const modal = page.locator('.fi-modal.fi-modal-open .fi-modal-window');
const total = (where = '1=1') => one(`select count(*) n from employees where deleted_at is null and ${where}`).n;

await login(page, BASE, user);

await step('stats and the "Leave requests" header badge', async () => {
    await page.goto(`${BASE}/hr/employees`);
    await page.locator('.fi-wi-stats-overview-stat-value').first().waitFor({ timeout: 10000 });
    const salary = one('select avg(salary) a from employees where deleted_at is null and salary is not null').a;
    const values = await stats();
    assert.equal(values[0], String(total()));
    assert.equal(values[1], String(total('is_active = 1')));
    assert.equal(values[2], `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(salary)}`);
    assert.match(values[3], /^\d+\.\d years$/);
    assert.equal((await page.locator('.fi-header-actions-ctn .fi-btn-badge-ctn').innerText()).trim(), String(one("select count(*) n from leave_requests where status = 'pending'").n));
});

await step('"Inactive" tab: table and stats restricted', async () => {
    await page.locator('.fi-sc-tabs .fi-tabs-item', { hasText: 'Inactive' }).click();
    const n = total('is_active = 0');
    await page.waitForFunction((expected) => document.querySelector('.fi-wi-stats-overview-stat-value')?.textContent.trim() === expected, String(n), { timeout: 10000 });
    assert.equal((await stats())[1], '0');
    await page.locator('.fi-sc-tabs .fi-tabs-item', { hasText: 'All' }).click();
    await page.waitForFunction((expected) => document.querySelector('.fi-wi-stats-overview-stat-value')?.textContent.trim() === expected, String(total()), { timeout: 10000 });
});

await step('filters: employment type, department, active', async () => {
    await page.locator('.fi-ta-filters-dropdown .fi-dropdown-trigger button, .fi-ta-header-toolbar button[title="Filter"]').first().click();
    const filter = (name) => page.locator(`[id="tableFiltersForm.${name}.value"]`);
    await filter('employment_type').selectOption('contractor');
    const department = one('select department_id id, count(*) n from employees where deleted_at is null and employment_type = ? and department_id is not null group by 1 order by n desc limit 1', 'contractor');
    await filter('department').selectOption(String(department.id));
    await filter('is_active').selectOption('1');
    await page.locator('.fi-ta-filters-actions-ctn button, .fi-ta-filters button', { hasText: /Apply/ }).first().click();
    const expected = total(`employment_type = 'contractor' and department_id = ${department.id} and is_active = 1`);
    await page.waitForFunction((n) => document.querySelector('.fi-wi-stats-overview-stat-value')?.textContent.trim() === n, String(expected), { timeout: 10000 });
    assert.equal(await rows.count(), Math.min(expected, 10));
    // Forged filter values: ignored or matching nothing, never an error.
    const status = await page.evaluate(async () => {
        const wire = window.Livewire.all().find((c) => c.el.querySelector('.fi-ta')).$wire;
        try { await wire.$set('tableDeferredFilters', { employment_type: { value: "x' or 1=1 --" }, department: { value: { $ne: null } }, is_active: { value: 'maybe' }, unknown: { value: 1 } }); await wire.applyTableFilters(); return 'ok'; } catch (e) { return 'error'; }
    });
    assert.equal(status, 'ok');
    await page.goto(`${BASE}/hr/employees`);
    await rows.first().waitFor({ timeout: 10000 });
});

const first = one('select * from employees where deleted_at is null order by name limit 1');
await step('"View profile": read-only slide-over, without a submit button', async () => {
    const panel = await menuOf(rows.first());
    await panel.locator('.fi-dropdown-list-item', { hasText: 'View profile' }).click();
    await modal.waitFor({ timeout: 8000 });
    assert.ok(await page.locator('.fi-modal.fi-modal-slide-over').count());
    const entries = Object.fromEntries(await modal.locator('.fi-in-entry').evaluateAll((els) => els.map((el) => [el.querySelector('.fi-in-entry-label').textContent.trim(), el.querySelector('.fi-in-entry-content').textContent.trim().replace(/\s+/g, ' ')])));
    assert.equal(entries.Name, first.name);
    assert.equal(entries.Email, first.email);
    assert.equal(entries.Department, one('select name from departments where id = ?', first.department_id)?.name ?? 'No department');
    assert.equal(await modal.locator('button[type=submit]').count(), 0);
    await modal.locator('.fi-modal-footer button', { hasText: 'Cancel' }).click();
    await modal.waitFor({ state: 'hidden', timeout: 8000 });
});

await step('"Deactivate" with confirmation', async () => {
    const panel = await menuOf(rows.first());
    await panel.locator('.fi-dropdown-list-item', { hasText: first.is_active ? 'Deactivate' : 'Activate' }).click();
    await modal.waitFor({ timeout: 8000 });
    await modal.locator('button[type=submit]').click();
    await until(() => one('select is_active v from employees where id = ?', first.id).v === (first.is_active ? 0 : 1), 'toggle');
});

await step('"Change department" on a row', async () => {
    await modal.waitFor({ state: 'hidden', timeout: 8000 });
    const target = one('select id, name from departments where id <> ? order by name limit 1', first.department_id ?? 0);
    const panel = await menuOf(rows.first());
    await panel.locator('.fi-dropdown-list-item', { hasText: 'Change department' }).click();
    await modal.waitFor({ timeout: 8000 });
    await modal.locator('.fi-select-input-btn').click();
    await page.locator('.fi-select-input-option', { hasText: target.name }).first().click();
    await modal.locator('button[type=submit]').click();
    await until(() => one('select department_id d from employees where id = ?', first.id).d === target.id, 'department');
});

await step('"Toggle active" bulk action on two rows', async () => {
    await page.goto(`${BASE}/hr/employees`);
    await page.locator('.fi-wi-stats-overview-stat-value').first().waitFor({ timeout: 10000 });
    const ids = db.prepare('select id from employees where deleted_at is null order by name limit 2').all().map((r) => r.id);
    await rows.nth(0).locator('.fi-ta-record-checkbox').click();
    await rows.nth(1).locator('.fi-ta-record-checkbox').click();
    await page.locator('.fi-ta-selection-indicator', { hasText: '2 records selected' }).waitFor({ timeout: 8000 });
    await page.locator('.fi-dropdown', { has: page.locator('.fi-dropdown-list-item', { hasText: 'Toggle active' }) }).locator('.fi-dropdown-trigger button:visible').first().click();
    await page.locator('.fi-dropdown-list-item', { hasText: 'Toggle active' }).click();
    await modal.waitFor({ timeout: 8000 });
    await modal.locator('label', { hasText: 'Inactive' }).click();
    await modal.locator('button[type=submit]').click();
    await until(() => db.prepare(`select is_active v from employees where id in (${ids.join(',')})`).all().every((r) => r.v === 0), 'bulk deactivation');
});

let created = null;
await step('create: three tabs, skills, an employment type that changes the fields, metadata', async () => {
    await page.goto(`${BASE}/hr/employees/create`);
    await page.locator('[id="form.name"]').fill('Nina Navette');
    await page.locator('[id="form.email"]').fill('nina.navette@example.test');
    await page.locator('[id="form.phone"]').pressSequentially('5551234567');
    assert.equal(await page.locator('[id="form.phone"]').inputValue(), '(555) 123-4567');
    for (const skill of ['TypeScript', 'SQL']) await page.locator('.fi-fo-checkbox-list-option', { hasText: skill }).locator('input').check();
    await page.locator('.fi-sc-tabs .fi-tabs-item', { hasText: 'Employment' }).click();
    await page.locator('[id="form.job_title"]').fill('Cable Car Operator');
    assert.ok(await page.locator('[id="form.salary"]').isVisible());
    await page.locator('.fi-fo-toggle-buttons label, .fi-fo-toggle-buttons-btn-ctn label', { hasText: 'Contractor' }).first().click();
    await page.locator('[id="form.hourly_rate"]').waitFor({ timeout: 8000 });
    assert.equal(await page.locator('[id="form.salary"]').count(), 0);
    await page.locator('[id="form.hourly_rate"]').fill('85.5');
    await page.locator('.fi-sc-tabs .fi-tabs-item', { hasText: 'Documents' }).click();
    await page.locator('.fi-fo-key-value-add-action-ctn button').click();
    const inputs = page.locator('.fi-fo-key-value-table tbody input');
    await inputs.nth(0).fill('office');
    await inputs.nth(1).fill('Chamonix');
    await page.waitForTimeout(800);
    await page.locator('.fi-sc-form button[type=submit]').first().click();
    await page.waitForURL(/\/hr\/employees\/\d+\/edit/, { timeout: 10000 });
    created = one("select * from employees where email = 'nina.navette@example.test'");
    assert.equal(created.employment_type, 'contractor');
    assert.equal(created.hourly_rate, 85.5);
    assert.equal(created.salary, null);
    assert.deepEqual(JSON.parse(created.skills), ['TypeScript', 'SQL']);
    assert.deepEqual(JSON.parse(created.metadata), { office: 'Chamonix' });
});

await step('edit: values read back in the tabs, an email already in use is refused', async () => {
    assert.ok(created);
    assert.ok(await page.locator('.fi-fo-checkbox-list-option', { hasText: 'TypeScript' }).locator('input').isChecked());
    assert.equal(await page.locator('.fi-fo-checkbox-list-option', { hasText: 'PHP' }).locator('input').isChecked(), false);
    await page.locator('[id="form.email"]').fill(first.email);
    await page.locator('.fi-sc-form button[type=submit]').first().click();
    await page.locator('.fi-fo-field-wrp-error-message', { hasText: 'already been taken' }).waitFor({ timeout: 8000 });
});

await step('relation managers: timesheets then leave requests, read-only', async () => {
    const employee = one('select employee_id id, count(*) n from timesheets group by 1 order by n desc limit 1');
    await page.goto(`${BASE}/hr/employees/${employee.id}/edit`);
    const manager = page.locator('.fi-resource-relation-manager');
    await manager.locator('.fi-ta-records tr.fi-ta-row').first().waitFor({ timeout: 15000 });
    assert.match((await manager.locator('.fi-pagination-overview').innerText()).trim(), new RegExp(`of ${employee.n} results`));
    assert.equal(await manager.locator('.fi-ta-record-checkbox').count(), 0);
    assert.match(await manager.locator('.fi-ta-cell-hours').first().innerText(), /^\s*\d+\.\d\s*$/);
    const leave = one('select count(*) n from leave_requests where employee_id = ?', employee.id).n;
    await page.locator('.fi-sc-tabs .fi-tabs-item', { hasText: /Leave requests/i }).last().click();
    if (leave > 0) {
        await manager.locator('.fi-ta-cell-type .fi-badge').first().waitFor({ timeout: 15000 });
        assert.equal(await manager.locator('.fi-ta-records tr.fi-ta-row').count(), Math.min(leave, 10));
    } else await manager.locator('.fi-ta-empty-state').waitFor({ timeout: 15000 });
});

await browser.close();
db.close();
if (errors.length) console.log('JavaScript errors:\n' + errors.slice(0, 5).join('\n'));
process.exit(exitCode());
