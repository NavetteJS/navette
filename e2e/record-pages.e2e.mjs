// Record pages: the project form combined with its relation managers in tabs, with icons and a badge.
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
const openTasks = db.prepare("select count(*) as n from tasks where project_id = ? and status != 'done'").get(project.id).n;

await login(page, BASE, user);
try {
    await step('the edit form is the first tab, next to the managers with their icon and badge', async () => {
        await page.goto(`${BASE}/projects/${project.id}/edit`);
        const tabs = page.locator('[id$="relationManagerTabs"] > .fi-tabs .fi-tabs-item');
        await tabs.first().waitFor();
        assert.deepEqual((await tabs.allInnerTexts()).map((text) => text.replace(/\s+/g, ' ').trim()), ['Edit', `Tasks ${openTasks}`, 'Timesheets']);
        assert.equal(await tabs.first().getAttribute('aria-selected'), 'true');
        assert.equal(await tabs.nth(1).locator('svg').count(), 1, 'icon');
        await page.locator('[id="form.name"]').waitFor();
    });
    await step('switching to a manager loads its table; back on the form, it saves', async () => {
        const tabs = page.locator('[id$="relationManagerTabs"] > .fi-tabs .fi-tabs-item');
        await tabs.nth(1).click();
        await page.locator('[id$="relationManagerTabs"] .fi-ta').first().waitFor({ timeout: 10000 });
        await tabs.first().click();
        await page.locator('[id="form.name"]').fill(`${project.name} (edited)`);
        await page.locator('form#form button[type=submit]').first().click();
        await page.getByText('Saved').first().waitFor({ timeout: 10000 });
        assert.equal(db.prepare('select name from projects where id = ?').get(project.id).name, `${project.name} (edited)`);
    });
    await step('no JavaScript error', async () => assert.deepEqual(errors, []));
} finally {
    await browser.close();
}
process.exit(exitCode());
