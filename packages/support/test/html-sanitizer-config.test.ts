import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ColorManager, cspNonce, cspNonceAttribute, getHtmlSanitizerConfig, HtmlSanitizerConfig, isSafeUrl, runWithCspNonce, sanitizeHtml, sanitizeUrl, useCspNonce, useHtmlSanitizerConfig } from '../src/index.ts';

afterEach(() => useHtmlSanitizerConfig(null));

const attacks = [
    '<a href="javascript:alert(1)">x</a>', '<a href="JaVaScRiPt:alert(1)">x</a>', '<a href="java&#x09;script:alert(1)">x</a>', '<a href="&#106;avascript:alert(1)">x</a>',
    '<a href="javascript&colon;alert(1)">x</a>', '<a href=" javascript:alert(1)">x</a>', '<a href="vbscript:x">x</a>', '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    '<img src="javascript:alert(1)">', '<a href="//evil.example">x</a>', '<a href="\\\\evil.example">x</a>',
];

test('the allow-lists cannot re-enable javascript: URLs, unless the scheme itself is allowed', () => {
    const permissive = HtmlSanitizerConfig.make().allowSafeElements().allowRelativeLinks().allowRelativeMedias()
        .allowAttribute('class', '*').allowAttribute('style', '*').allowAttribute('href', '*').allowAttribute('src', '*').allowElement('a', '*').allowElement('img', '*');
    for (const attack of attacks) {
        const html = sanitizeHtml(attack, permissive);
        assert.doesNotMatch(html, /javascript|vbscript|data:text|evil/i, `${attack} → ${html}`);
    }
    // Only listing the scheme allows it.
    assert.match(sanitizeHtml('<a href="javascript:void(0)">x</a>', permissive.allowLinkSchemes(['https', 'javascript'])), /href="javascript:void\(0\)"/);
    // Event handlers, scripts, styles and forms can never be allowed.
    assert.throws(() => permissive.allowAttribute('onclick'), /event handler/);
    assert.throws(() => permissive.allowAttribute('onmouseover', 'a'), /event handler/);
    assert.throws(() => permissive.allowElement('script'), /cannot be allowed/);
    assert.throws(() => permissive.allowElement('iframe'), /cannot be allowed/);
    assert.throws(() => permissive.allowAttribute('srcset', 'img'), /cannot be allowed/);
    assert.equal(sanitizeHtml('<p onclick="x()" class="a">Hi<script>alert(1)</script><style>p{}</style></p>', permissive), '<p class="a">Hi</p>');
});

test('HtmlSanitizerConfig: allow, block and drop elements and attributes, force attributes, maximum input length', () => {
    const config = HtmlSanitizerConfig.make().allowSafeElements().allowRelativeLinks().allowAttribute('data-id', '*').dropAttribute('title', '*').blockElement('div').dropElement('aside')
        .forceAttribute('a', 'target', '_blank');
    assert.equal(sanitizeHtml('<div title="t"><p data-id="1" title="t">a</p><aside>gone</aside><a href="/x" target="_top">l</a></div>', config), '<p data-id="1">a</p><a href="/x" target="_blank">l</a>');
    assert.equal(sanitizeHtml('<p>' + 'a'.repeat(100) + '</p>', config.withMaxInputLength(80)), '<p>' + 'a'.repeat(77) + '</p>');
    // Each method returns a new configuration.
    assert.notEqual(config, config.allowAttribute('lang'));
    assert.deepEqual(HtmlSanitizerConfig.make().getAllowedElements(), {});
    assert.equal(sanitizeHtml('<p>x</p>', HtmlSanitizerConfig.make()), 'x');
    // Images: media schemes, hosts, https.
    const media = HtmlSanitizerConfig.make().allowElement('img', ['src', 'alt']).allowMediaSchemes(['https']).allowMediaHosts(['cdn.example.com']).forceHttpsUrls();
    assert.equal(sanitizeHtml('<img src="https://cdn.example.com/a.png" alt="a"><img src="https://other.example/b.png"><img src="data:image/png;base64,AA">', media), '<img src="https://cdn.example.com/a.png" alt="a"><img><img>');
});

test('the process-wide configuration: default, extended, reset', () => {
    assert.equal(sanitizeHtml('<p class="x">a</p>'), '<p>a</p>');
    useHtmlSanitizerConfig((config) => config.allowAttribute('class', '*'));
    assert.equal(sanitizeHtml('<p class="x">a</p>'), '<p class="x">a</p>');
    assert.equal(sanitizeHtml('<a href="javascript:x" class="y">a</a>'), '<a class="y">a</a>');
    useHtmlSanitizerConfig(null);
    assert.equal(getHtmlSanitizerConfig().getLinkSchemes().join(','), 'http,https,mailto');
});

test('sanitizeUrl() and isSafeUrl() with allowed schemes', () => {
    assert.equal(sanitizeUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
    assert.equal(sanitizeUrl('/orders/1'), '/orders/1');
    assert.equal(sanitizeUrl('javascript:alert(1)'), null);
    assert.equal(sanitizeUrl('java\tscript:alert(1)'), null);
    assert.equal(sanitizeUrl('mailto:ada@example.com'), null);
    assert.equal(sanitizeUrl('mailto:ada@example.com', ['mailto']), 'mailto:ada@example.com');
    assert.equal(sanitizeUrl('https://example.com', ['mailto']), null, 'the list replaces the default');
    assert.equal(isSafeUrl('tel:+331'), false);
    assert.equal(isSafeUrl('tel:+331', { schemes: ['tel'] }), true);
    assert.equal(isSafeUrl('page.html', { allowRelative: false }), false);
});

test('CSP nonce: per request, checked, and on the color variables', () => {
    assert.equal(cspNonce(), null);
    assert.equal(cspNonceAttribute(), '');
    const res = { locals: {} as Record<string, any> };
    useCspNonce(res, 'abcdefgh12345678');
    assert.equal(res.locals.cspNonce, 'abcdefgh12345678');
    assert.throws(() => useCspNonce(res, '"><script>'), /Invalid CSP nonce/);
    runWithCspNonce('abcdefgh12345678', () => {
        assert.equal(cspNonceAttribute(), ' nonce="abcdefgh12345678"');
        assert.match(new ColorManager().renderCssVariables(), /^<style nonce="abcdefgh12345678">/);
    });
    assert.match(new ColorManager().renderCssVariables(), /^<style>/);
});
