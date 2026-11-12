import assert from 'node:assert/strict';
import { test } from 'node:test';
import { richDocumentToHtml, richHtmlToDocument } from '../src/index.ts';

test('texte riche : le HTML enregistré devient un document TipTap, et inversement', () => {
    const document = richHtmlToDocument('<p>Bonjour <strong>le monde</strong></p><ul><li><p>un</p></li></ul>');
    assert.equal(document.type, 'doc');
    assert.deepEqual((document.content as any[]).map((node) => node.type), ['paragraph', 'bulletList']);
    assert.equal((document.content as any[])[0].attrs.textAlign, 'start');
    assert.equal(richDocumentToHtml(document), '<p>Bonjour <strong>le monde</strong></p><ul><li><p>un</p></li></ul>');
});

test('texte riche : un document vide ou mal formé ne donne rien à enregistrer', () => {
    assert.equal(richDocumentToHtml(richHtmlToDocument('')), null);
    assert.equal(richDocumentToHtml(richHtmlToDocument('<p>   </p>')), null);
    assert.equal(richDocumentToHtml(null), null);
    assert.equal(richDocumentToHtml('<p>texte brut</p>'), null);
    assert.equal(richDocumentToHtml({ type: 'doc', content: [{ type: 'nœud-inconnu' }] }), null);
});

test('texte riche : scripts, attributs d\'événement et liens javascript: ne survivent pas', () => {
    const html = richDocumentToHtml(richHtmlToDocument('<script>alert(1)</script><p onclick="x()">a</p><p><a href="javascript:alert(1)">piège</a></p><img src="x" onerror="alert(1)">'))!;
    assert.equal(/script|onclick|onerror|javascript:/i.test(html), false);
    assert.match(html, /<p>a<\/p>/);
    // Document forgé par le navigateur : la marque de lien porte une adresse exécutable.
    const forged = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'clic', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] };
    assert.equal(/javascript:/i.test(richDocumentToHtml(forged) ?? ''), false);
});
