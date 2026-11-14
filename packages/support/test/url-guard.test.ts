import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocalOrHttpUrl, localOrHttpUrl } from '../src/index.ts';

test('isLocalOrHttpUrl(): site paths and http(s) URLs only', () => {
    for (const url of ['/', '/admin/posts?page=2#top', '/a\\b', 'http://example.com', 'https://example.com/x', 'HTTPS://example.com']) {
        assert.equal(isLocalOrHttpUrl(url), true, url);
    }
    for (const url of ['', 'javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,x', 'mailto:a@example.com', 'relative/path', '//evil.example', '/\\evil.example', '\\\\evil.example', '\\/evil.example', ' /x', 'ftp://example.com']) {
        assert.equal(isLocalOrHttpUrl(url), false, url);
    }
    for (const value of [null, undefined, 42, {}, ['/x']]) assert.equal(isLocalOrHttpUrl(value), false);
});

test('isLocalOrHttpUrl(): control characters, which browsers drop, are refused', () => {
    for (const url of ['/\t/evil.example', '/\n/evil.example', '/\r/evil.example', '/x\u0000', 'https://exa\u007fmple.com', 'java\tscript:alert(1)']) {
        assert.equal(isLocalOrHttpUrl(url), false, JSON.stringify(url));
    }
    // What the browser makes of the refused paths: another site.
    assert.equal(new URL('/\\evil.example', 'https://site.example').host, 'evil.example');
    assert.equal(new URL('/\t/evil.example', 'https://site.example').host, 'evil.example');
});

test('isLocalOrHttpUrl(): extra schemes and localOrHttpUrl()', () => {
    assert.equal(isLocalOrHttpUrl('mailto:a@example.com', { extraSchemes: ['mailto'] }), true);
    assert.equal(isLocalOrHttpUrl('MAILTO:a@example.com', { extraSchemes: ['mailto'] }), true);
    assert.equal(isLocalOrHttpUrl('mailto:a@example.com\n', { extraSchemes: ['mailto'] }), false);
    assert.equal(isLocalOrHttpUrl('javascript:alert(1)', { extraSchemes: ['mailto'] }), false);
    assert.equal(localOrHttpUrl('/ok'), '/ok');
    assert.equal(localOrHttpUrl('/\\evil.example'), null);
    assert.equal(localOrHttpUrl(7), null);
});
