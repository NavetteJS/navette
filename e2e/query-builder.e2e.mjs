// The products list query builder: text / number / boolean / date rules, OR block, removal, Reset, forged state.
// Expected results are computed from the disposable copy of the database.
// Run by e2e/run.mjs, which provides a throwaway instance on a copy of the database.
import { chromium } from 'playwright';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base, user, dbFile } = specArgs();
const db = openDatabase(dbFile, { readonly: true });
const count = (where, ...params) => Number(db.prepare(`select count(*) as n from products where ${where}`).get(...params).n);
const { check: step, fail, exitCode } = reporter();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const refusals = [];
page.on('response', async (res) => { if (!res.url().includes('/livewire')) return; if (res.status() >= 500) errors.push(`HTTP ${res.status()}`); else if (res.status() >= 400) refusals.push(`HTTP ${res.status()} ${(await res.text().catch(() => '')).slice(0, 200)}`); });
try {
    await login(page, base, user);
    await page.goto(base + '/shop/products');
    await page.waitForSelector('.nv-wi-stats-overview-stat-value');
    const total = count('1 = 1');
    const shown = async () => Number((await page.locator('.nv-ta-content-ctn > .nv-sr-only').first().innerText()).replace(/\D/g, ''));
    const stat = async () => Number((await page.locator('.nv-wi-stats-overview-stat-value').first().innerText()).replace(/\D/g, ''));
    const settle = async (expected) => { await page.waitForFunction((n) => Number(document.querySelector('.nv-ta-content-ctn > .nv-sr-only')?.textContent.replace(/\D/g, '')) === n, expected, { timeout: 15000 }).catch(() => {}); return shown(); };
    const filters = page.locator('.nv-ta-filters');
    // The root block picker is the last one in the form (those of the OR groups come before it).
    const add = async (label, picker = filters.locator('.nv-fo-builder-block-picker').last()) => {
        const before = await filters.locator('.nv-fo-builder-item').count();
        await picker.locator('.nv-dropdown-trigger button').click();
        await picker.locator('.nv-dropdown-list-item', { hasText: label }).first().click();
        await page.waitForFunction((n) => document.querySelectorAll('.nv-ta-filters .nv-fo-builder-item').length > n, before);
    };
    const apply = () => page.locator('[data-table-filter-action=apply]').click();
    const indicators = async () => (await page.locator('.nv-ta-filter-indicators .nv-badge-label').allInnerTexts()).map((s) => s.trim());
    const badge = async () => (await page.locator('.nv-ta-filters-trigger-action-ctn .nv-badge').innerText()).trim();

    step((await shown()) === total && (await stat()) === total, 'no filter: the table and the widget count every product', String(total));
    step(!(await filters.isVisible()), 'the filters start collapsed');
    await page.locator('.nv-ta-filters-trigger-action-ctn button').click();
    await filters.waitFor({ state: 'visible' });
    step((await filters.locator('.nv-fo-builder-block-picker .nv-dropdown-list-item').count()) === 16, 'the picker offers the 15 constraints and the OR block');

    // --- text
    await add('Name');
    const firstRule = filters.locator('.nv-fo-builder-item').first();
    step((await firstRule.locator('select').first().inputValue()) === 'contains', 'the "Name" rule comes with the "Contains" operator');
    await firstRule.locator('input[type=text]').fill('Alpine');
    await apply();
    const alpine = count("name like '%Alpine%'");
    step((await settle(alpine)) === alpine && alpine > 0 && alpine < total, '"Name contains Alpine" narrows the table', `${alpine} / ${total}`);
    await page.waitForFunction((n) => Number(document.querySelector('.nv-wi-stats-overview-stat-value')?.textContent.replace(/\D/g, '')) === n, alpine, { timeout: 15000 }).catch(() => {});
    step((await stat()) === alpine, 'the stats widget follows the filter', String(await stat()));
    step(JSON.stringify(await indicators()) === JSON.stringify(['Name contains Alpine']) && (await badge()) === '1', '"Name contains Alpine" indicator and badge at 1', (await indicators()).join(' | '));

    // --- inverse operator
    await firstRule.locator('select').first().selectOption('contains.inverse');
    await page.waitForTimeout(600);
    await apply();
    step((await settle(total - alpine)) === total - alpine, '"Does not contain" inverts the result', String(total - alpine));
    await firstRule.locator('select').first().selectOption('contains');
    await page.waitForTimeout(600);

    // --- number
    await add('Quantity');
    const second = filters.locator('.nv-fo-builder-item').nth(1);
    await second.locator('input').first().fill('50');
    await apply();
    const alpineQty = count("name like '%Alpine%' and qty >= 50");
    step((await settle(alpineQty)) === alpineQty, 'number rule "Quantity is minimum 50" (AND)', String(alpineQty));
    step((await indicators()).includes('Quantity is minimum 50'), 'indicator of the number rule', (await indicators()).join(' | '));
    step((await filters.locator('.nv-fo-builder-label-between-items').first().innerText()).trim() === 'AND', '"AND" label between the rules');

    // --- removing a rule from its indicator, then with its button
    await page.locator('.nv-ta-filter-indicators .nv-badge', { hasText: 'Name contains Alpine' }).locator('.nv-badge-delete-btn').click();
    const qty = count('qty >= 50');
    step((await settle(qty)) === qty, 'removing the "Name" indicator removes the rule', String(qty));
    step((await filters.locator('.nv-fo-builder-item').count()) === 1, 'the rule is also gone from the form');
    await filters.locator('.nv-fo-builder-item').first().locator('button[title=Delete]').click();
    await page.waitForFunction(() => document.querySelectorAll('.nv-ta-filters .nv-fo-builder-item').length === 0);
    await apply();
    step((await settle(total)) === total, 'deleting the last rule then applying shows the whole table');

    // --- boolean and date
    await add('Visibility');
    await apply();
    const visible = count('is_visible = 1');
    step((await settle(visible)) === visible && (await indicators()).includes('Visibility is true'), 'boolean rule "Visibility is true"', String(visible));
    await add('Publishing date');
    const dateRule = filters.locator('.nv-fo-builder-item').nth(1);
    await dateRule.locator('input[type=date]').fill('2026-06-01');
    await apply();
    const dated = count("is_visible = 1 and date(published_at) >= '2026-06-01'");
    step((await settle(dated)) === dated, 'date rule "Publishing date is after" (fixed date)', String(dated));
    step((await indicators()).includes('Publishing date is after Jun 1, 2026'), 'indicator of the date rule', (await indicators()).join(' | '));
    await dateRule.locator('select').first().selectOption('isYear');
    await dateRule.locator('input[type=text], input[type=number]').first().waitFor();
    await dateRule.locator('input[type=text], input[type=number]').first().fill('2026');
    await apply();
    const year = count("is_visible = 1 and strftime('%Y', published_at) = '2026'");
    step((await settle(year)) === year, 'changing the operator ("Is year") replaces the settings form', String(year));
    await dateRule.locator('select').first().selectOption('isAfter');
    await dateRule.locator('select').nth(1).waitFor();
    await dateRule.locator('select').nth(1).selectOption('relative');
    await dateRule.locator('select').nth(2).waitFor();
    await apply();
    const monthAgo = new Date(); monthAgo.setUTCMonth(monthAgo.getUTCMonth() - 1);
    const rolling = count('is_visible = 1 and date(published_at) >= ?', monthAgo.toISOString().slice(0, 10));
    step((await settle(rolling)) === rolling, 'rolling window "Past month"', String(rolling));

    // --- Reset
    await page.locator('[data-table-filter-action=reset]').click();
    step((await settle(total)) === total && (await filters.locator('.nv-fo-builder-item').count()) === 0 && (await badge()) === '0', 'Reset empties the form and the whole table comes back');

    // --- OR block
    await add('OR condition');
    const groups = filters.locator('.nv-fo-repeater-item');
    step((await groups.count()) === 2, 'the OR block comes with two groups');
    await add('Name', groups.nth(0).locator('.nv-fo-builder-block-picker'));
    await groups.nth(0).locator('input[type=text]').fill('Alpine');
    await add('Name', groups.nth(1).locator('.nv-fo-builder-block-picker'));
    await groups.nth(1).locator('input[type=text]').fill('Kit');
    await apply();
    const either = count("name like '%Alpine%' or name like '%Kit%'");
    step((await settle(either)) === either && either > alpine, 'OR block: "Alpine" or "Kit"', `${either}`);
    step(JSON.stringify(await indicators()) === JSON.stringify(['Name contains Alpine OR Name contains Kit']), 'indicator of the OR block', (await indicators()).join(' | '));
    await add('Visibility');
    await apply();
    const eitherVisible = count("(name like '%Alpine%' or name like '%Kit%') and is_visible = 1");
    step((await settle(eitherVisible)) === eitherVisible, 'the OR block combines with another rule with AND', String(eitherVisible));
    await page.locator('.nv-ta-filter-indicators button[aria-label="Remove all filters"]').click();
    step((await settle(total)) === total, '"Remove all filters" removes everything');

    // --- forged state: unknown types, operators and settings are ignored, without an error
    const forged = await page.evaluate(async () => {
        const wire = window.Livewire.all().find((c) => c.el.querySelector('.nv-ta'))?.$wire;
        // Nested OR block without a rule (the runtime already refuses values nested too deep; OR block depth is covered by unit tests).
        let deep = { type: 'or', data: { groups: {} } };
        for (let level = 0; level < 1; level++) deep = { type: 'or', data: { groups: { g: { rules: { r: deep } } } } };
        try {
            await wire.$set('tableDeferredFilters.queryBuilder.rules', {
                a: { type: 'password', data: { operator: 'contains', settings: { text: 'x' } } },
                b: { type: 'name', data: { operator: "contains'; drop table products; --", settings: { text: 'Alpine' } } },
                c: { type: 'qty', data: { operator: 'isMin', settings: { number: { $gt: 0 }, 'qty) or (1=1': 1 } } },
                d: { type: 'name; drop table products', data: { operator: 'equals', settings: { text: 'x' } } },
                e: { type: 'published_at', data: { operator: 'isMonth', settings: { month: ['1', '2'] } } },
                f: deep,
            });
            await wire.applyTableFilters();
            return 'ok';
        } catch (error) { return 'error: ' + (error?.message ?? JSON.stringify(error)); }
    });
    step(forged === 'ok' && (await settle(total)) === total && (await indicators()).length === 0, 'a forged state is ignored: no error, no filter', forged);
    step(count('1 = 1') === total, 'the products table is intact');
    const direct = await page.evaluate(async () => {
        const wire = window.Livewire.all().find((c) => c.el.querySelector('.nv-ta'))?.$wire;
        try { await wire.$set('tableFilters.queryBuilder.rules', { z: { type: 'name', data: { operator: 'equals', settings: { text: "x' or '1'='1" } } } }); return 'ok'; } catch (error) { return 'error: ' + (error?.message ?? JSON.stringify(error)); }
    });
    step(direct === 'ok' && (await settle(0)) === 0, 'a booby-trapped value stays a bound value: no product has that name', direct);
    step(errors.length === 0, 'no page error nor 5xx response', errors.join(' | '));
    if (refusals.length) console.log('    refused:', refusals.join(' | '));
} catch (error) {
    fail(`spec stopped: ${String(error?.message ?? error).split('\n')[0]}`);
} finally {
    await browser.close();
    db.close();
}
process.exit(exitCode());
