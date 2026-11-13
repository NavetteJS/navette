import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSafeUrl, markdownToHtml, sanitizeHtml } from '../src/index.ts';

test('`sanitizeHtml()` keeps formatting elements and safe attributes', () => {
    assert.equal(sanitizeHtml('<p>Hello <strong>world</strong> &amp; <em>friends</em></p>'), '<p>Hello <strong>world</strong> &amp; <em>friends</em></p>');
    assert.equal(sanitizeHtml('<a href="https://example.com/a?b=1&amp;c=2" title="Go" onclick="x()">link</a>'), '<a href="https://example.com/a?b=1&amp;c=2" title="Go" rel="noopener noreferrer nofollow">link</a>');
    assert.equal(sanitizeHtml('<ul><li>One<li>Two</ul>'), '<ul><li>One<li>Two</li></li></ul>');
    assert.equal(sanitizeHtml('<p>unclosed <b>bold'), '<p>unclosed <b>bold</b></p>');
});

test('`sanitizeHtml()` removes scripts, handlers, styles and dangerous URLs', () => {
    const vectors: [string, RegExp][] = [
        ['<script>alert(1)</script>ok', /^ok$/],
        ['<img src=x onerror=alert(1)>', /^$/],
        ['<svg onload=alert(1)><circle/></svg>after', /^after$/],
        ['<a href="javascript:alert(1)">x</a>', /^<a>x<\/a>$/],
        ['<a href="jav&#x09;ascript:alert(1)">x</a>', /^<a>x<\/a>$/],
        ['<a href="&#106;avascript:alert(1)">x</a>', /^<a>x<\/a>$/],
        ['<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>', /^<a>x<\/a>$/],
        ['<a href="//evil.test">x</a>', /^<a>x<\/a>$/],
        ['<p style="background:url(x)" class="admin">x</p>', /^<p>x<\/p>$/],
        ['<iframe src="https://evil.test"></iframe>text', /^text$/],
        ['<style>body{display:none}</style>visible', /^visible$/],
        ['<!-- <script>alert(1)</script> -->kept', /^kept$/],
        ['<p title="a" title="b">x</p>', /^<p>x<\/p>$/],
        ['< script>alert(1)</ script>', /^&lt; script&gt;alert\(1\)&lt;\/ script&gt;$/],
        ['<scr<script>ipt>alert(1)</script>', /^&lt;scr$/],
        ['"><img src=x onerror=alert(1)>', /^"&gt;$/],
        ['<form action="/x"><input name="a"></form>t', /^t$/],
    ];
    for (const [input, expected] of vectors) assert.match(sanitizeHtml(input), expected, input);
    for (const output of vectors.map(([input]) => sanitizeHtml(input))) assert.doesNotMatch(output, /<(script|img|svg|iframe|style|form|input)|on\w+=|javascript:/i);
});

test('`isSafeUrl()`', () => {
    for (const url of ['https://a.test', 'http://a.test', 'mailto:a@b.test', '/path', '#anchor', 'relative/page', '?q=1']) assert.equal(isSafeUrl(url), true, url);
    for (const url of ['javascript:x', ' javascript:x', 'JaVaScRiPt:x', 'vbscript:x', 'data:x', '//evil.test', 'java\nscript:x', '&#106;avascript:x']) assert.equal(isSafeUrl(url), false, url);
});

test('`markdownToHtml()`: blocks, inline formatting, escaped HTML, safe links', () => {
    assert.equal(markdownToHtml('# Title\n\nSome **bold** and *italic* and `code`.'), '<h1>Title</h1><p>Some <strong>bold</strong> and <em>italic</em> and <code>code</code>.</p>');
    assert.equal(markdownToHtml('- one\n- two\n\n3. three\n4. four'), '<ul><li>one</li><li>two</li></ul><ol start="3"><li>three</li><li>four</li></ol>');
    assert.equal(markdownToHtml('> quoted'), '<blockquote><p>quoted</p></blockquote>');
    assert.equal(markdownToHtml('```\n<b>x</b>\n```'), '<pre><code>&lt;b&gt;x&lt;/b&gt;</code></pre>');
    assert.equal(markdownToHtml('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
    assert.equal(markdownToHtml('[site](https://a.test) [bad](javascript:alert(1))'), '<p><a href="https://a.test" rel="noopener noreferrer nofollow">site</a> bad)</p>');
    assert.equal(markdownToHtml('[x](https://a.test" onclick="y)'), '<p>[x](<a href="https://a.test" rel="noopener noreferrer nofollow">https://a.test</a>&quot; onclick=&quot;y)</p>', 'the quote stays text');
});
