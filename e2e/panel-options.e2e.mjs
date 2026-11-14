// Panel options: SPA prefetching, the unsaved changes alert, and saving in a database transaction.
// Run by e2e/run.mjs, on a throwaway copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile } = specArgs();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const { step, exitCode } = reporter({ errorLines: 5 });
const db = openDatabase(dbFile);
const project = db.prepare('select id, name from projects where deleted_at is null order by id limit 1').get();

/** Whether the page's form data matches the hash remembered by the server (no unsaved changes). */
const isSaved = () => page.evaluate(() => {
    const component = window.Livewire.all().find((candidate) => typeof candidate.$wire.savedDataHash === 'string');
    return window.jsMd5(JSON.stringify(component.$wire.data).replace(/\\/g, '')) === component.$wire.savedDataHash;
});
const firstKey = (table) => db.prepare(`select id from ${table} order by id limit 1`).get().id;

await login(page, BASE, user);
try {
    await step('links prefetch their page on hover', async () => {
        await page.goto(`${BASE}/projects/${project.id}/edit`);
        await page.locator('[id="form.name"]').waitFor();
        assert.ok(await page.locator('.nv-sidebar-item a[wire\\:navigate\\.hover]').count() > 0);
        assert.equal(await page.locator('.nv-sidebar-item a[wire\\:navigate]').count(), 0);
    });
    await step('untouched forms have no unsaved changes, whatever their fields', async () => {
        const pages = [
            `/projects/${project.id}/edit`, '/projects/create',
            `/shop/products/${firstKey('products')}/edit`, '/shop/products/create',
            `/shop/orders/${firstKey('orders')}/edit`, '/shop/orders/create',
            `/blog/posts/${firstKey('posts')}/edit`, `/shop/customers/${firstKey('customers')}/edit`,
            // Not the employee: its phone mask reformats the value as the page loads.
        ];
        for (const url of pages) {
            await page.goto(`${BASE}${url}`);
            await page.waitForFunction(() => window.Livewire?.all().some((candidate) => typeof candidate.$wire.savedDataHash === 'string'));
            assert.ok(await isSaved(), url);
        }
    });
    await step('leaving with unsaved changes asks first; dismissing stays on the page', async () => {
        await page.goto(`${BASE}/projects/${project.id}/edit`);
        await page.locator('[id="form.name"]').fill(`${project.name} (draft)`);
        assert.equal(await isSaved(), false);
        const messages = [];
        page.once('dialog', (dialog) => { messages.push(dialog.message()); dialog.dismiss(); });
        await page.locator('.nv-sidebar-item a', { hasText: 'Tasks' }).first().click();
        await page.waitForTimeout(500);
        assert.equal(messages.length, 1);
        assert.match(messages[0], /unsaved changes/i);
        assert.match(page.url(), new RegExp(`/projects/${project.id}/edit$`));
    });
    await step('accepting leaves the page', async () => {
        page.once('dialog', (dialog) => dialog.accept());
        await page.locator('.nv-sidebar-item a', { hasText: 'Tasks' }).first().click();
        await page.waitForURL((url) => url.pathname.endsWith('/tasks'));
    });
    await step('once saved, the page can be left without a question', async () => {
        await page.goto(`${BASE}/projects/${project.id}/edit`);
        await page.locator('[id="form.name"]').fill(`${project.name} (kept)`);
        await page.locator('form#form button[type=submit]').first().click();
        await page.getByText('Saved').first().waitFor({ timeout: 10000 });
        assert.ok(await isSaved());
        assert.equal(db.prepare('select name from projects where id = ?').get(project.id).name, `${project.name} (kept)`);
        let asked = false;
        page.once('dialog', (dialog) => { asked = true; dialog.dismiss(); });
        await page.locator('.nv-sidebar-item a', { hasText: 'Tasks' }).first().click();
        await page.waitForURL((url) => url.pathname.endsWith('/tasks'));
        assert.equal(asked, false);
    });
    await step('no JavaScript error', async () => assert.deepEqual(errors, []));
} finally {
    await browser.close();
}
process.exit(exitCode());
