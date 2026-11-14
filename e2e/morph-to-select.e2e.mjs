// `MorphToSelect` on the lab panel's "Comments" resource: the type select shows the saved type, the searchable key select
// the saved record; changing the type clears the key; the chosen type and key are saved in `commentable_type` /
// `commentable_id`; the type is required. Run by e2e/run.mjs, on a throwaway copy of the database.
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
const PRODUCT_TYPE = 'App\\Models\\Shop\\Product';
const POST_TYPE = 'App\\Models\\Blog\\Post';
const COMMENT = db.prepare('select id, commentable_id from comments where commentable_type = ? order by id limit 1').get(PRODUCT_TYPE);
const comment = (id) => db.prepare('select * from comments where id = ?').get(id);
const field = (id) => page.locator(`[id="form.${id}"]`);
const wrapperOf = (id) => page.locator('[data-field-wrapper]', { has: page.locator(`[id="form.${id}"]`) });
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const until = async (check, label) => { for (let i = 0; i < 40; i++) { if (await check()) return; await page.waitForTimeout(250); } throw new Error(`timed out waiting for: ${label}`); };
const submit = async (name, method) => {
    const answered = page.waitForResponse((response) => response.url().includes('/livewire') && response.request().method() === 'POST' && (response.request().postData() ?? '').includes(`"${method}"`));
    await page.getByRole('button', { name, exact: true }).click();
    await answered;
    await page.waitForLoadState('networkidle');
};
/** Picks a record in the searchable key select. */
const pick = async (search, label) => {
    await wrapperOf('commentable_id').locator('.nv-select-input-btn').click();
    await wrapperOf('commentable_id').locator('.nv-select-input input').fill(search);
    const option = wrapperOf('commentable_id').locator('.nv-select-input-option', { hasText: label }).first();
    await option.waitFor({ timeout: 8000 });
    await option.click();
};
const chooseType = async (type) => {
    const answered = page.waitForResponse((response) => response.url().includes('/livewire') && response.request().method() === 'POST');
    await field('commentable_type').selectOption(type);
    await answered;
    await page.waitForLoadState('networkidle');
};

await login(page, BASE, user);
try {
    await step('edit: the fieldset shows the saved type and the label of the saved record', async () => {
        const product = db.prepare('select name from products where id = ?').get(COMMENT.commentable_id);
        await page.goto(`${BASE}/lab/comments/${COMMENT.id}/edit`);
        await field('title').waitFor();
        await page.waitForLoadState('networkidle');
        assert.equal((await page.locator('fieldset.nv-fieldset legend').first().innerText()).replace('*', '').trim(), 'Commented record');
        assert.equal(await field('commentable_type').inputValue(), PRODUCT_TYPE);
        assert.match(await wrapperOf('commentable_id').locator('.nv-select-input-btn').innerText(), new RegExp(escape(product.name)));
    });

    await step('changing the type clears the key; a blog post is searched, picked and saved', async () => {
        const post = db.prepare("select id, title from posts where title <> '' order by id desc limit 1").get();
        // The seed repeats some titles: any post with that title is the one picked.
        const ids = db.prepare('select id from posts where title = ?').all(post.title).map((row) => row.id);
        await chooseType(POST_TYPE);
        await until(async () => !(await wrapperOf('commentable_id').locator('.nv-select-input-btn').innerText()).includes(String(COMMENT.commentable_id)), 'key cleared');
        await pick(post.title, post.title);
        await submit('Save changes', 'save');
        const saved = comment(COMMENT.id);
        assert.equal(saved.commentable_type, POST_TYPE);
        assert.ok(ids.includes(saved.commentable_id), `saved ${saved.commentable_id}, expected one of ${ids}`);
        await page.reload();
        await page.waitForLoadState('networkidle');
        assert.match(await wrapperOf('commentable_id').locator('.nv-select-input-btn').innerText(), new RegExp(escape(post.title)));
    });

    await step('create: the type is required; the type and the record are saved', async () => {
        const product = db.prepare("select min(id) as id, name from products where name <> '' group by name having count(*) = 1 order by id limit 1").get();
        await page.goto(`${BASE}/lab/comments/create`);
        await field('title').waitFor();
        await page.waitForLoadState('networkidle');
        await field('title').fill('Morph comment');
        // The type select is required: the browser does not submit the form without it.
        await page.getByRole('button', { name: 'Create', exact: true }).click();
        assert.equal(await field('commentable_type').evaluate((select) => select.validity.valueMissing), true);
        assert.equal(db.prepare("select count(*) as n from comments where title = 'Morph comment'").get().n, 0);
        await chooseType(PRODUCT_TYPE);
        await pick(product.name.split(' ')[0], product.name);
        await submit('Create', 'create');
        const created = db.prepare("select * from comments where title = 'Morph comment'").get();
        assert.ok(created, 'comment created');
        assert.equal(created.commentable_type, PRODUCT_TYPE);
        assert.equal(created.commentable_id, product.id);
    });

    await step('no page errors', async () => { assert.deepEqual(errors, []); });
} finally {
    await browser.close();
    db.close();
}
process.exit(exitCode(errors));
