import assert from 'node:assert/strict';
import { test } from 'node:test';
import { richDocumentToHtml, richHtmlToDocument } from '../src/index.ts';

test('rich text: stored HTML becomes a TipTap document, and back', () => {
    const document = richHtmlToDocument('<p>Hello <strong>world</strong></p><ul><li><p>one</p></li></ul>');
    assert.equal(document.type, 'doc');
    assert.deepEqual((document.content as any[]).map((node) => node.type), ['paragraph', 'bulletList']);
    assert.equal((document.content as any[])[0].attrs.textAlign, 'start');
    assert.equal(richDocumentToHtml(document), '<p>Hello <strong>world</strong></p><ul><li><p>one</p></li></ul>');
});

test('rich text: an empty or malformed document yields nothing to save', () => {
    assert.equal(richDocumentToHtml(richHtmlToDocument('')), null);
    assert.equal(richDocumentToHtml(richHtmlToDocument('<p>   </p>')), null);
    assert.equal(richDocumentToHtml(null), null);
    assert.equal(richDocumentToHtml('<p>plain text</p>'), null);
    assert.equal(richDocumentToHtml({ type: 'doc', content: [{ type: 'unknown-node' }] }), null);
});

test('rich text: scripts, event attributes and javascript: links do not survive', () => {
    const html = richDocumentToHtml(richHtmlToDocument('<script>alert(1)</script><p onclick="x()">a</p><p><a href="javascript:alert(1)">trap</a></p><img src="x" onerror="alert(1)">'))!;
    assert.equal(/script|onclick|onerror|javascript:/i.test(html), false);
    assert.match(html, /<p>a<\/p>/);
    // Browser-forged document: the link mark carries an executable URL.
    const forged = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'click', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] };
    assert.equal(/javascript:/i.test(richDocumentToHtml(forged) ?? ''), false);
});
