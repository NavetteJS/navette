import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { ColorManager } from '@navette-js/support';
import { useColorManager } from '@navette-js/support/ui';
import { Page, Panel } from '../src/index.ts';

useColorManager(new ColorManager());
const dir = mkdtempSync(path.join(tmpdir(), 'navette-page-view-'));
const file = path.join(dir, 'report.ejs');
writeFileSync(file, `<x-section :heading="'Report for ' + page.getTitle()"><p><%= total %> orders</p><x-button wire:click="refresh">Refresh</x-button></x-section>`);

class Report extends Page {
    static slug = 'report';
    static title = 'Sales';
    static view = pathToFileURL(file);
    getViewData() { return { total: 3 }; }
}

test('a page renders its own EJS view with its data and component tags', async () => {
    const page = new Report() as any;
    page._ctx = { panel: Panel.make().id('admin'), user: { id: 1, name: 'A', email: 'a@example.com' } };
    const html: string = await page.renderContent();
    assert.match(html, /<h2 class="fi-section-header-heading">Report for Sales<\/h2>/);
    assert.match(html, /<p>3 orders<\/p>/);
    assert.match(html, /<button [^>]*wire:click="refresh"/);
});

test('a page without a view renders its content schema', async () => {
    class Plain extends Page { static slug = 'plain'; }
    const page = new Plain() as any;
    page._ctx = { panel: Panel.make().id('admin'), user: { id: 1, name: 'A', email: 'a@example.com' } };
    assert.equal(typeof (await page.renderContent()), 'string');
});
