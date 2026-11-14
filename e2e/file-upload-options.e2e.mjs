// FileUpload options in the lab panel's "Fields lab" form: minFiles(), a crop editor opened automatically for images
// without the required aspect ratio, moveFiles() with a directory computed by a function, and custom open and download URLs
// for a file listed without reading it (fetchFileInformation(false)). Run by e2e/run.mjs, on a throwaway copy of the database.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { login, openDatabase, reporter, specArgs } from './support.mjs';

const { base: BASE, user, dbFile, tmpDir } = specArgs();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
const { step, exitCode } = reporter({ errorLines: 5 });
const db = openDatabase(dbFile);
const until = async (check, label) => { for (let i = 0; i < 60; i++) { if (await check()) return; await page.waitForTimeout(250); } throw new Error(`timed out waiting for: ${label}`); };

const field = (name) => page.locator(`[id="form.${name}"].nv-fo-file-upload`);
const wrapper = (name) => page.locator('.nv-fo-field', { has: field(name) });
const completed = (name) => field(name).locator('.filepond--item[data-filepond-item-state="processing-complete"]');
const submit = () => page.locator('.nv-sc-form button[type=submit]').first().click();

await login(page, BASE, user);
// Real JPEG files to upload: a square and a 16:9 screenshot.
const square = path.join(tmpDir, 'square.jpg');
const wide = path.join(tmpDir, 'wide.jpg');
await page.screenshot({ type: 'jpeg', path: square, clip: { x: 0, y: 0, width: 300, height: 300 } });
await page.screenshot({ type: 'jpeg', path: wide, clip: { x: 0, y: 0, width: 320, height: 180 } });
const name = `Upload lab ${Date.now()}`;

try {
    await step('minFiles(): one document is refused on save', async () => {
        await page.goto(`${BASE}/lab/fields/create`);
        await field('documents').locator('.filepond--root').waitFor({ timeout: 15000 });
        await page.locator('[id="form.name"]').fill(name);
        await page.locator('.nv-fo-repeater input[type="text"], .nv-fo-repeater input:not([type])').first().fill('Ada');
        await field('documents').locator('input[type=file]').setInputFiles(square);
        await completed('documents').first().waitFor({ timeout: 15000 });
        await submit();
        await wrapper('documents').locator('.nv-fo-field-wrp-error-message', { hasText: 'The documents field must have at least 2 items.' }).waitFor({ timeout: 8000 });
        assert.equal(db.prepare('select count(*) n from brands where name = ?').get(name).n, 0);
    });

    await step('automaticallyOpenImageEditorForAspectRatio(): a square image opens the crop-only editor', async () => {
        await field('banner').locator('input[type=file]').setInputFiles(square);
        const editor = field('banner').locator('.nv-fo-file-upload-editor.nv-fo-file-upload-editor-crop-only');
        await editor.waitFor({ state: 'visible', timeout: 15000 });
        assert.equal(await editor.locator('.nv-fo-file-upload-editor-control-panel-main').count(), 0, 'no full editing controls');
        await editor.locator('.cropper-container').waitFor({ timeout: 10000 });
        await editor.getByRole('button', { name: 'Save' }).click();
        await editor.waitFor({ state: 'hidden', timeout: 10000 });
        await completed('banner').first().waitFor({ timeout: 15000 });
    });

    await step('a 16:9 image does not open the editor', async () => {
        await field('documents').locator('input[type=file]').setInputFiles(wide);
        await until(async () => (await completed('documents').count()) === 2, 'two documents');
        assert.equal(await field('banner').locator('.nv-fo-file-upload-editor').isVisible(), false);
    });

    let brand;
    await step('moveFiles() and a directory computed by a function: the saved file lands in lab-brands/create', async () => {
        await field('seo_description').locator('input[type=file]').setInputFiles(square);
        await completed('seo_description').first().waitFor({ timeout: 15000 });
        // The slug field of this lab form is read-only: set through Livewire.
        await page.evaluate(async (slug) => { await window.Livewire.all().find((c) => c.el.querySelector('.nv-sc-form')).$wire.$set('data.slug', slug); }, `upload-lab-${Date.now()}`);
        await submit();
        await page.waitForURL(/\/lab\/fields\/\d+\/edit/, { timeout: 10000 });
        brand = db.prepare('select * from brands where name = ?').get(name);
        assert.ok(brand, 'brand created');
        assert.match(brand.seo_description, /^lab-brands\/create\/[0-9a-f-]{36}\.jpg$/);
        assert.ok(fs.existsSync(path.join(tmpDir, 'uploads', 'public', ...brand.seo_description.split('/'))), 'stored file');
    });

    await step('open and download buttons use the URLs of getOpenableFileUrlUsing() and getDownloadableFileUrlUsing()', async () => {
        assert.ok(brand);
        await page.goto(`${BASE}/lab/fields/${brand.id}/edit`);
        const item = field('seo_description').locator('.filepond--item');
        await item.first().waitFor({ timeout: 15000 });
        const open = item.locator('a.filepond--open-icon');
        const download = item.locator('a.filepond--download-icon');
        await open.waitFor({ state: 'attached', timeout: 10000 });
        assert.equal(await open.getAttribute('href'), `/storage/${brand.seo_description}?view=open`);
        assert.equal(await open.getAttribute('target'), '_blank');
        assert.equal(await download.getAttribute('href'), `/storage/${brand.seo_description}?view=download`);
        // The stored key is kept when the form is saved again (the lab's contacts repeater has a required field).
        await page.locator('.nv-fo-repeater input[type="text"], .nv-fo-repeater input:not([type])').first().fill('Ada');
        await page.getByRole('button', { name: 'Save changes' }).click();
        await page.locator('.nv-no-notification', { hasText: 'Saved' }).first().waitFor({ timeout: 10000 });
        assert.equal(db.prepare('select seo_description from brands where id = ?').get(brand.id).seo_description, brand.seo_description);
    });

    await step('a forged stored key is refused on save', async () => {
        assert.ok(brand);
        const status = await page.evaluate(async () => {
            const wire = window.Livewire.all().find((c) => c.el.querySelector('.nv-sc-form')).$wire;
            await wire.$set('data.seo_description', { forged: 'lab-brands/create/someone-else.jpg' });
            return 'set';
        });
        assert.equal(status, 'set');
        await submit();
        await wrapper('seo_description').locator('.nv-fo-field-wrp-error-message', { hasText: 'contains a file path that is not permitted' }).waitFor({ timeout: 8000 });
        assert.equal(db.prepare('select seo_description from brands where id = ?').get(brand.id).seo_description, brand.seo_description);
    });

    await step('no JavaScript error', async () => assert.deepEqual(errors, []));
} catch (error) {
    await page.screenshot({ path: path.join(tmpDir, 'file-upload-options.png') }).catch(() => {});
    throw error;
} finally {
    await browser.close();
}
process.exit(exitCode());
