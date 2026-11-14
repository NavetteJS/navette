import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import { Panel, panelRouter, type AuthProvider, type User } from '@navette-js/panels';
import { Schema } from '@navette-js/schemas';
import { WireRuntime } from '@navette-js/wire';
import { generatePlugin } from '../src/generators.ts';

// Generated packages are written inside the repository, so that they resolve the @navette-js packages like a project would.
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), `.tmp-${randomBytes(4).toString('hex')}`);
after(() => rmSync(root, { recursive: true, force: true }));
const writePackage = (id: string, files: Record<string, string>) => {
    for (const [file, content] of Object.entries(files)) {
        const target = path.join(root, id, ...file.split('/'));
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, content);
    }
    return pathToFileURL(path.join(root, id, 'src', 'index.ts')).href;
};

test('make:plugin generates a panel plugin package that registers its page, view and translations', async () => {
    const { id, className, files } = generatePlugin('BlogPlugin');
    assert.equal(id, 'blog');
    assert.equal(className, 'BlogPlugin');
    assert.deepEqual(Object.keys(files).sort(), ['README.md', 'lang/en/blog.json', 'package.json', 'src/BlogPage.ts', 'src/BlogPlugin.ts', 'src/index.ts', 'views/page.ejs']);
    assert.deepEqual(JSON.parse(files['package.json']).exports, { '.': './src/index.ts' });
    const module = await import(writePackage(id, files));
    const ada: User = { id: 1, name: 'Ada', email: 'ada@example.com' };
    const auth: AuthProvider = { attempt: async () => null, find: async () => ada };
    const panel = Panel.make().id('generated-plugin').key('generated-key').authGuard('generated').auth(auth).plugin(module.BlogPlugin.make());
    assert.equal(panel.getPlugin<any>('blog').hasPage(), true);
    assert.deepEqual(panel.getPages().map((page) => page.slug), ['blog']);
    assert.equal(Panel.make().id('without-page').plugin(module.BlogPlugin.make().page(false)).getPages().length, 0);
    const app = express();
    app.use(panelRouter(panel, new WireRuntime({ key: 'k' })));
    const server = app.listen(0);
    try {
        let cookie = '';
        panel.logIn({ cookie: (name: string, value: string) => { cookie = `${name}=${value}`; }, req: {} } as any, ada, false);
        const html = await (await fetch(`http://127.0.0.1:${(server.address() as any).port}/blog`, { headers: { cookie } })).text();
        assert.match(html, /<title>\s*Blog\s*-/);
        assert.match(html, /This page is added by the Blog plugin\./);
    } finally { server.close(); }
});

test('make:plugin --standalone generates a schema component package', async () => {
    const { id, className, files } = generatePlugin('PriceTag', { standalone: true });
    assert.equal(id, 'price-tag');
    assert.equal(className, 'PriceTag');
    assert.deepEqual(Object.keys(files).sort(), ['README.md', 'package.json', 'src/PriceTag.ts', 'src/index.ts', 'views/price-tag.ejs']);
    const module = await import(writePackage(id, files));
    const host: any = { id: 'test', _errors: {}, data: {}, getSchema: () => null, dispatch() {}, getActionMountContext: () => ({}) };
    const html = await Schema.make(host).components([module.PriceTag.make().content('<b>9.99</b>')]).toHtml();
    assert.ok(html.includes('<div class="price-tag">&lt;b&gt;9.99&lt;/b&gt;</div>'));
});
