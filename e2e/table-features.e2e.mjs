// Table-level features of the lab panel (apps/demo/lab-table-features.ts): description, striped rows and the row loop,
// the page in the URL (query string identifier), extreme links and records per page kept in the session, search and sort
// options, a live reorderable column manager kept in the session, paginated reordering with a custom trigger, keyboard
// moves and an "after reordering" callback, record links in a new tab; then lazy loading, a custom header, cursor
// pagination and the column manager in a modal.
// Run by e2e/run.mjs, on a throwaway copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile } = specArgs();
const db = openDatabase(dbFile);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const { step, exitCode } = reporter({ errorLines: 3 });
const toolbar = () => page.locator('.nv-ta-header-toolbar');
const rows = () => page.locator('.nv-ta-records > tr.nv-ta-row');
const headers = async () => (await page.locator('thead tr:last-child th.nv-ta-header-cell').allInnerTexts()).map((text) => text.trim());
const cellTexts = async (name) => (await page.locator(`.nv-ta-records td.nv-ta-cell-${name}`).allInnerTexts()).map((text) => text.trim());
const notification = (title) => page.locator('.nv-no-notification-title', { hasText: title });
/** Waits for the next Livewire answer whose request mentions `text`. */
const answer = (text) => page.waitForResponse((response) => response.url().includes('/livewire') && (response.request().postData() ?? '').includes(text));
const settle = async (promise) => { await promise; await page.waitForLoadState('networkidle'); };

await login(page, BASE, user);
try {
    await page.goto(`${BASE}/lab/tasks`);
    await rows().first().waitFor();

    await step('heading with its description, striped rows and row numbers from the row loop', async () => {
        assert.equal((await page.locator('.nv-ta-header-description').innerText()).trim(), 'Drag rows to reorder them; the column manager reorders columns.');
        assert.deepEqual(await Promise.all([0, 1, 2, 3].map(async (index) => /nv-striped/.test(await rows().nth(index).getAttribute('class')))), [false, true, false, true]);
        assert.deepEqual((await cellTexts('position')).slice(0, 3), ['1', '2', '3']);
    });

    await step('rows link to the edit page in a new tab', async () => {
        const link = rows().first().locator('td.nv-ta-cell-title a.nv-ta-col');
        assert.equal(await link.getAttribute('target'), '_blank');
        assert.match(await link.getAttribute('href'), /\/lab\/tasks\/\d+\/edit$/);
    });

    await step('the page goes in the URL as `tasksPage`, with first and last page links, and survives a reload', async () => {
        const total = db.prepare('select count(*) c from tasks').get().c;
        await settle(Promise.all([answer('nextPage'), page.locator('.nv-pagination-item[rel="next"] button').click()]));
        await page.waitForURL(/tasksPage=2/);
        assert.equal(await page.locator('.nv-pagination-item[rel="first"]').count(), 1);
        assert.equal(await page.locator('.nv-pagination-item[rel="last"]').count(), 1);
        await page.reload();
        await rows().first().waitFor();
        assert.equal((await page.locator('.nv-pagination-item.nv-active').innerText()).trim(), '2');
        // The row loop counts the rows of the page; the eleventh task (by position) opens page 2.
        assert.deepEqual((await cellTexts('position')).slice(0, 1), ['1']);
        assert.equal((await cellTexts('sort'))[0], String(db.prepare('select sort from tasks order by sort, id limit 1 offset 10').get().sort));
        await settle(Promise.all([answer('gotoPage'), page.locator('.nv-pagination-item[rel="last"] button').click()]));
        assert.equal((await page.locator('.nv-pagination-item.nv-active').innerText()).trim(), String(Math.ceil(total / 10)));
    });

    await step('records per page are kept in the session', async () => {
        await settle(Promise.all([answer('tableRecordsPerPage'), page.locator('.nv-pagination-records-per-page-select:not(.nv-compact) select').selectOption('25')]));
        assert.equal(await rows().count(), 25);
        await page.goto(`${BASE}/lab/tasks`);
        await rows().first().waitFor();
        assert.equal(await rows().count(), 25);
        await settle(Promise.all([answer('tableRecordsPerPage'), page.locator('.nv-pagination-records-per-page-select:not(.nv-compact) select').selectOption('10')]));
    });

    await step('the search field has its placeholder and searches the title and the description', async () => {
        const input = toolbar().locator('input[type="search"]');
        assert.equal(await input.getAttribute('placeholder'), 'Search tasks');
        assert.match(await input.getAttribute('wire:model.live.debounce.300ms') ?? 'missing', /tableSearch/);
        const row = db.prepare("select id, title, description from tasks where description is not null and description != '' order by id limit 1").get();
        const word = row.description.split(/\s+/).find((candidate) => candidate.length > 6 && /^[A-Za-z]+$/.test(candidate));
        const expected = db.prepare("select count(*) c from tasks where lower(title) like ? or lower(description) like ?").get(`%${word.toLowerCase()}%`, `%${word.toLowerCase()}%`).c;
        const searched = answer('tableSearch');
        await input.fill(word);
        await settle(searched);
        assert.equal(await rows().count(), Math.min(expected, 10));
        const cleared = answer('tableSearch');
        await input.fill('');
        await settle(cleared);
    });

    await step('priorities sort by their rank through the column sort query', async () => {
        await settle(Promise.all([answer('sortTable'), page.locator('th.nv-ta-header-cell-priority button').click()]));
        const ranks = (await cellTexts('priority')).map((priority) => ['low', 'medium', 'high', 'urgent'].indexOf(priority.toLowerCase()));
        assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
        assert.equal(ranks[0], 0);
        await settle(Promise.all([answer('sortTable'), page.locator('th.nv-ta-header-cell-priority button').click()]));
        await settle(Promise.all([answer('sortTable'), page.locator('th.nv-ta-header-cell-priority button').click()]));
    });

    await step('the column manager is live and reorderable, and its state is kept in the session', async () => {
        const manager = toolbar().locator('.nv-ta-col-manager-dropdown');
        await manager.locator('.nv-dropdown-trigger button').click();
        const panel = manager.locator('.nv-dropdown-panel');
        await panel.waitFor();
        assert.equal(await panel.getByRole('button', { name: 'Apply columns' }).count(), 0, 'no "Apply" button when live');
        assert.match(await panel.locator('.nv-ta-col-manager-items').getAttribute('style'), /--cols-lg: 2;/);
        const hidden = answer('applyTableColumnManager');
        await panel.locator('label', { hasText: 'Status' }).locator('input').uncheck();
        await settle(hidden);
        assert.equal((await headers()).includes('Status'), false);
        // "Move up" on the last column, then on the group: the group moves as a whole.
        const moved = answer('applyTableColumnManager');
        // The move buttons are for assistive technologies (visually hidden): clicked from the page.
        await panel.getByTestId('column-manager-sort-move-up').evaluate((button) => button.click());
        await settle(moved);
        const before = await headers();
        assert.ok(before.indexOf('Position') < before.indexOf('Estimated'), before.join(','));
        await page.goto(`${BASE}/lab/tasks`);
        await rows().first().waitFor();
        const after = await headers();
        assert.deepEqual(after, before, `${after.join(',')} / ${before.join(',')}`);
        // "Reset" (in the footer) restores the declared columns.
        await toolbar().locator('.nv-ta-col-manager-dropdown .nv-dropdown-trigger button').click();
        const reset = answer('resetTableColumnManager');
        await toolbar().locator('.nv-ta-col-manager-actions-ctn').getByRole('button', { name: 'Reset' }).click();
        await settle(reset);
        const restored = await headers();
        assert.deepEqual(restored, ['#', 'Title', 'Status', 'Priority', 'Estimated', 'Position'], restored.join(','));
        await page.keyboard.press('Escape');
    });

    await step('reordering: custom trigger, paginated, a keyboard move saves the order and runs the callback', async () => {
        await settle(toolbar().getByRole('button', { name: 'Reorder tasks' }).click());
        await toolbar().getByRole('button', { name: 'Done reordering' }).waitFor();
        assert.equal(await page.locator('.nv-pagination').count(), 1, 'paginated while reordering');
        assert.equal(await rows().count(), 10);
        const keys = await rows().evaluateAll((elements) => elements.map((element) => element.getAttribute('x-sortable-item')));
        const firstSort = db.prepare('select sort from tasks where id = ?').get(keys[0]).sort;
        const moved = answer('moveTableRecord');
        await rows().first().locator('button[data-table-reorder-direction="down"]').evaluate((button) => button.click());
        await settle(moved);
        await notification('Moved 10 tasks').waitFor();
        assert.equal(db.prepare('select sort from tasks where id = ?').get(keys[1]).sort, 1);
        assert.equal(db.prepare('select sort from tasks where id = ?').get(keys[0]).sort, 2);
        assert.ok(firstSort !== null);
        await settle(toolbar().getByRole('button', { name: 'Done reordering' }).click());
    });

    await page.goto(`${BASE}/lab/timesheets`);

    await step('lazy loading: the records arrive after the page, under the custom header', async () => {
        await page.locator('[data-cy="timesheets-header"]').waitFor();
        await rows().first().waitFor();
        assert.equal(await page.locator('.nv-ta.nv-loading').count(), 0);
        assert.equal(await page.locator('.nv-ta-content-ctn').evaluate((element) => element.hasAttribute('wire:poll.60s')), true, 'polls every 60 seconds');
    });

    await step('cursor pagination: previous / next only, pages follow the date order', async () => {
        const ordered = db.prepare('select id from timesheets order by date desc, id asc limit 20').all().map((row) => String(row.id));
        const keys = async () => rows().evaluateAll((elements) => elements.map((element) => element.getAttribute('wire:key').split('.').pop()));
        assert.deepEqual(await keys(), ordered.slice(0, 10));
        assert.equal(await page.locator('.nv-pagination-overview').count(), 0);
        await settle(Promise.all([answer('setPage'), page.locator('.nv-pagination-next-btn').click()]));
        assert.deepEqual(await keys(), ordered.slice(10, 20));
        await settle(Promise.all([answer('setPage'), page.locator('.nv-pagination-previous-btn').click()]));
        assert.deepEqual(await keys(), ordered.slice(0, 10));
        assert.equal(await page.locator('.nv-pagination-previous-btn').count(), 0);
    });

    await step('the column manager opens in a modal, and applies with its footer button', async () => {
        await toolbar().getByRole('button', { name: 'Columns' }).click();
        const modal = page.locator('.nv-modal.nv-modal-open .nv-modal-window');
        await modal.waitFor();
        await modal.locator('label', { hasText: 'Hours' }).locator('input').uncheck();
        const applied = answer('applyTableColumnManager');
        await modal.getByRole('button', { name: 'Apply columns' }).click();
        await settle(applied);
        assert.equal((await headers()).includes('Hours'), false);
    });
} finally {
    await browser.close();
    db.close();
}
process.exit(exitCode(errors));
