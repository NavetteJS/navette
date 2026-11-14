// Nested Livewire components in a schema (`Livewire.make()`), in the lab panel's "Fields lab" form: the record is passed
// to the component, which handles its own requests and keeps its state when the page renders again; a lazy one loads
// when it enters the viewport. Run by e2e/run.mjs, on a throwaway copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile, tmpDir } = specArgs();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const { step, exitCode } = reporter({ errorLines: 5 });
const db = openDatabase(dbFile, { readonly: true });
const brand = db.prepare('select id, name from brands order by id limit 1').get();
const notes = () => page.locator('.lab-brand-notes').first();

await login(page, BASE, user);
try {
    await step('the nested component receives the record and handles its own requests', async () => {
        await page.goto(`${BASE}/lab/fields/${brand.id}/edit`);
        await notes().waitFor({ timeout: 10000 });
        assert.equal(await notes().locator('p').innerText(), `Notes for ${brand.name}`);
        await notes().getByRole('button', { name: 'Like' }).click();
        await page.waitForFunction(() => document.querySelector('.lab-brand-notes [data-likes]')?.textContent === '1', null, { timeout: 8000 });
        await notes().getByRole('button', { name: 'Like' }).click();
        await page.waitForFunction(() => document.querySelector('.lab-brand-notes [data-likes]')?.textContent === '2', null, { timeout: 8000 });
    });

    await step('the page renders again: the nested component keeps its state', async () => {
        // A request of the page itself: the repeater adds an item and the whole form is rendered again.
        await page.locator('.nv-fo-repeater').getByRole('button', { name: 'Add to contacts' }).click();
        await page.waitForFunction(() => document.querySelectorAll('.nv-fo-repeater-item').length === 2, null, { timeout: 8000 });
        assert.equal(await notes().locator('[data-likes]').innerText(), '2');
    });

    await step('a lazy nested component loads when it enters the viewport, with its data', async () => {
        const lazy = page.locator('.lab-brand-notes', { hasText: '(lazy)' });
        await page.locator('.lab-brand-notes-placeholder, .lab-brand-notes').last().scrollIntoViewIfNeeded();
        await lazy.waitFor({ timeout: 10000 });
        assert.equal(await lazy.locator('p').innerText(), `Notes for ${brand.name} (lazy)`);
        await lazy.getByRole('button', { name: 'Like' }).click();
        await page.waitForFunction(() => [...document.querySelectorAll('.lab-brand-notes')].some((el) => el.textContent.includes('(lazy)') && el.querySelector('[data-likes]').textContent === '1'), null, { timeout: 8000 });
    });

    await step('no JavaScript error', async () => assert.deepEqual(errors, []));
} catch (error) {
    await page.screenshot({ path: path.join(tmpDir, 'schema-livewire.png') }).catch(() => {});
    throw error;
} finally {
    await browser.close();
}
process.exit(exitCode());
