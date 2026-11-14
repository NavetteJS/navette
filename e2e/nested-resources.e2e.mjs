// Nested and singular resources: tasks created and edited on full pages under their project (from the project's Tasks
// relation manager), forged URLs refused, and the lab's site settings edited at the resource URL and created on first save.
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
const [project, other] = db.prepare('select id, name from projects where deleted_at is null order by id limit 2').all();
const foreignTask = db.prepare('select id from tasks where project_id = ? order by id limit 1').get(other.id);
const crumbs = async () => (await page.locator('.fi-breadcrumbs-item').allInnerTexts()).map((text) => text.trim()).filter(Boolean);
const until = async (check, label) => { for (let i = 0; i < 40; i++) { if (await check()) return; await page.waitForTimeout(250); } throw new Error(`timed out waiting for: ${label}`); };
const title = `Nested task ${Date.now()}`;
let created = null;

await login(page, BASE, user);
try {
    await step('the Tasks relation manager links "New task" to the create page under the project', async () => {
        await page.goto(`${BASE}/projects/${project.id}?relation=tasks`);
        const create = page.locator('[id$="relationManagerTabs"] a.fi-btn', { hasText: 'New task' }).first();
        await create.waitFor({ timeout: 10000 });
        assert.equal(new URL(await create.getAttribute('href'), BASE).pathname, `/projects/${project.id}/tasks/create`);
        await create.click();
        await page.waitForURL((url) => url.pathname === `/projects/${project.id}/tasks/create`);
        assert.deepEqual(await crumbs(), ['Projects', project.name, 'Tasks', 'Create']);
        assert.equal(await page.locator('[id="form.project_id"]').count(), 0, 'no project field: the project comes from the URL');
    });
    await step('creating the task attaches it to the project and opens its nested edit page', async () => {
        await page.locator('[id="form.title"]').fill(title);
        await page.locator('form#form button[type=submit]').first().click();
        await page.waitForURL((url) => /\/projects\/\d+\/tasks\/\d+\/edit$/.test(url.pathname), { timeout: 10000 });
        created = db.prepare('select id, project_id from tasks where title = ?').get(title);
        assert.ok(created, 'the task is in the database');
        assert.equal(created.project_id, project.id);
        assert.equal(new URL(page.url()).pathname, `/projects/${project.id}/tasks/${created.id}/edit`);
        assert.deepEqual(await crumbs(), ['Projects', project.name, 'Tasks', title, 'Edit']);
    });
    await step('the edit page saves the task, and its breadcrumbs lead back to the project', async () => {
        await page.locator('[id="form.title"]').fill(`${title} (edited)`);
        await page.locator('form#form button[type=submit]').first().click();
        await page.getByText('Saved').first().waitFor({ timeout: 10000 });
        assert.equal(db.prepare('select title, project_id from tasks where id = ?').get(created.id).title, `${title} (edited)`);
        const tasksCrumb = page.locator('.fi-breadcrumbs-item a', { hasText: 'Tasks' });
        const href = new URL(await tasksCrumb.getAttribute('href'), BASE);
        assert.equal(`${href.pathname}${href.search}`, `/projects/${project.id}?relation=tasks`);
    });
    await step('a row of the relation manager opens the task under its project', async () => {
        await page.goto(`${BASE}/projects/${project.id}?relation=tasks`);
        const search = page.locator('[id$="relationManagerTabs"] .fi-ta-search-field input').first();
        await search.waitFor({ timeout: 10000 });
        await search.fill(`${title} (edited)`);
        const row = page.locator('[id$="relationManagerTabs"] .fi-ta-row', { hasText: `${title} (edited)` }).first();
        await row.waitFor({ timeout: 10000 });
        await row.locator('.fi-ta-cell a').first().click();
        await page.waitForURL((url) => url.pathname === `/projects/${project.id}/tasks/${created.id}/edit`, { timeout: 10000 });
    });
    await step('a forged URL with a task of another project, or an unknown project, is refused (404)', async () => {
        assert.equal((await page.goto(`${BASE}/projects/${project.id}/tasks/${foreignTask.id}/edit`)).status(), 404);
        assert.equal((await page.goto(`${BASE}/projects/999999/tasks/${created.id}/edit`)).status(), 404);
        assert.equal((await page.goto(`${BASE}/projects/999999/tasks/create`)).status(), 404);
        assert.equal((await page.goto(`${BASE}/projects/${other.id}/tasks/${foreignTask.id}/edit`)).status(), 200, 'the right project works');
    });
    await step('deleting the task goes back to the project, on its Tasks tab', async () => {
        await page.goto(`${BASE}/projects/${project.id}/tasks/${created.id}/edit`);
        await page.locator('.fi-header .fi-btn', { hasText: 'Delete' }).first().click();
        await page.locator('.fi-modal.fi-modal-open .fi-modal-footer .fi-btn', { hasText: 'Delete' }).click();
        await page.waitForURL((url) => url.pathname === `/projects/${project.id}` && url.search === '?relation=tasks', { timeout: 10000 });
        assert.equal(db.prepare('select count(*) as n from tasks where id = ?').get(created.id).n, 0);
    });

    const settingsCount = () => db.prepare("select count(*) as n from settings where \"group\" = 'site' and name = 'general'").get().n;
    await step('singular resource: the site settings are a menu item opening the edit page at the resource URL', async () => {
        db.prepare("delete from settings where \"group\" = 'site' and name = 'general'").run();
        await page.goto(`${BASE}/lab`);
        await page.locator('.fi-sidebar-item a', { hasText: 'Site Settings' }).click();
        await page.waitForURL((url) => url.pathname === '/lab/site-settings');
        assert.equal((await page.locator('.fi-header-heading').innerText()).trim(), 'Site Settings');
        assert.equal(await page.locator('[id="form.site_name"]').inputValue(), 'Navette Lab', 'the defaults, as there is no record yet');
        assert.equal(await page.locator('form#form button', { hasText: 'Cancel' }).count(), 0);
    });
    await step('singular resource: the first save creates the record, the next ones update it', async () => {
        await page.locator('[id="form.site_name"]').fill('Navette Lab (renamed)');
        await page.locator('[id="form.contact_email"]').fill('lab@example.test');
        await page.locator('form#form button[type=submit]').first().click();
        await page.getByText('Saved').first().waitFor({ timeout: 10000 });
        assert.equal(settingsCount(), 1);
        const payload = JSON.parse(db.prepare("select payload from settings where \"group\" = 'site' and name = 'general'").get().payload);
        assert.equal(payload.site_name, 'Navette Lab (renamed)');
        await page.reload();
        await until(async () => (await page.locator('[id="form.site_name"]').inputValue()) === 'Navette Lab (renamed)', 'the saved value');
        await page.locator('[id="form.tagline"]').fill('Experiments');
        await page.locator('form#form button[type=submit]').first().click();
        await until(async () => JSON.parse(db.prepare("select payload from settings where \"group\" = 'site' and name = 'general'").get().payload).tagline === 'Experiments', 'the update');
        assert.equal(settingsCount(), 1, 'still a single record');
    });
    await step('no JavaScript error', async () => assert.deepEqual(errors, []));
} finally {
    await browser.close();
}
process.exit(exitCode());
