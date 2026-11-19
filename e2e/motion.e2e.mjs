// Motion: a removed Repeater line fades out in place before it goes (motion.js), and nothing is saved.
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
const ORDER = db.prepare('select order_id as id from order_items group by order_id having count(*) >= 2 order by order_id limit 1').get();
const until = async (check, label) => { for (let i = 0; i < 40; i++) { if (await check()) return; await page.waitForTimeout(100); } throw new Error(`timed out waiting for: ${label}`); };

await login(page, BASE, user);
try {
    await step('a deleted Repeater line fades out (class nv-leaving) and is then removed', async () => {
        await page.goto(`${BASE}/lab/repeater-options/${ORDER.id}/edit`);
        const rows = page.locator('.nv-fo-table-repeater tbody > tr');
        await rows.first().waitFor();
        await page.waitForLoadState('networkidle');
        const before = await rows.count();
        // Record that a row received the class: it only lasts a fraction of a second.
        await page.evaluate(() => {
            window.__nvLeft = false;
            new MutationObserver((mutations) => { for (const mutation of mutations) if (mutation.target.classList?.contains('nv-leaving')) window.__nvLeft = true; })
                .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
        });
        await rows.last().getByRole('button', { name: 'Delete' }).click();
        await until(() => page.evaluate(() => window.__nvLeft), 'the leaving class');
        await until(async () => (await rows.count()) === before - 1, 'the row removed');
        assert.equal(await page.locator('.nv-leaving').count(), 0, 'no row left half removed');
    });

    await step('with reduced motion, the line goes at once', async () => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(`${BASE}/lab/repeater-options/${ORDER.id}/edit`);
        const rows = page.locator('.nv-fo-table-repeater tbody > tr');
        await rows.first().waitFor();
        await page.waitForLoadState('networkidle');
        const before = await rows.count();
        await page.evaluate(() => { window.__nvLeft = false; new MutationObserver((m) => { for (const x of m) if (x.target.classList?.contains('nv-leaving')) window.__nvLeft = true; }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] }); });
        await rows.last().getByRole('button', { name: 'Delete' }).click();
        await until(async () => (await rows.count()) === before - 1, 'the row removed');
        assert.equal(await page.evaluate(() => window.__nvLeft), false);
    });

    assert.deepEqual(errors, [], 'no page error');
} finally { await browser.close(); }
process.exit(exitCode());
