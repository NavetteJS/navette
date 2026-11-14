// Documentation site behaviour: theme, mobile navigation, code copy, active table of contents, search (local JSON index).
(() => {
    const base = document.body.dataset.base || '';
    const html = document.documentElement;

    // ------------------------------------------------------------------ light / dark theme
    document.querySelector('.theme-button')?.addEventListener('click', () => {
        const dark = html.classList.toggle('dark');
        try { localStorage.setItem('navette-docs-theme', dark ? 'dark' : 'light'); } catch {}
    });

    // ------------------------------------------------------------------ mobile navigation
    const menu = document.querySelector('.menu-button');
    const overlay = document.querySelector('.sidebar-overlay');
    const setNav = (open) => {
        document.body.classList.toggle('nav-open', open);
        menu?.setAttribute('aria-expanded', String(open));
        if (overlay) overlay.hidden = !open;
    };
    menu?.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
    overlay?.addEventListener('click', () => setNav(false));
    // Bring the current page into view in the sidebar without scrolling the document (scrollIntoView would).
    const sidebar = document.querySelector('.sidebar');
    const active = sidebar?.querySelector('.active');
    if (sidebar && active) {
        const top = active.getBoundingClientRect().top - sidebar.getBoundingClientRect().top;
        if (top > sidebar.clientHeight - 80) sidebar.scrollTop = top - sidebar.clientHeight / 2;
    }

    // ------------------------------------------------------------------ code copy
    document.querySelectorAll('.code-block .copy').forEach((button) => button.addEventListener('click', async () => {
        const code = button.closest('.code-block')?.querySelector('code')?.innerText ?? '';
        try { await navigator.clipboard.writeText(code); button.textContent = 'Copied'; } catch { button.textContent = 'Error'; }
        setTimeout(() => { button.textContent = 'Copy'; }, 1500);
    }));

    // ------------------------------------------------------------------ copy the page as Markdown (its .md twin)
    const copyText = async (text) => {
        if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
        const area = Object.assign(document.createElement('textarea'), { value: text });
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.append(area);
        area.select();
        const copied = document.execCommand('copy');
        area.remove();
        if (!copied) throw new Error('Copy refused');
    };
    document.querySelectorAll('.page-copy').forEach((button) => button.addEventListener('click', async () => {
        const actions = button.closest('.page-actions');
        const label = button.querySelector('span');
        const status = actions?.querySelector('[role="status"]');
        const href = actions?.querySelector('.page-markdown')?.getAttribute('href');
        if (!href || !label) return;
        button.disabled = true;
        try {
            const response = await fetch(href);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            await copyText(await response.text());
            label.textContent = 'Copied';
            if (status) status.textContent = 'Page copied as Markdown.';
        } catch {
            label.textContent = 'Copy failed';
            if (status) status.textContent = 'The page could not be copied: open "View as Markdown" instead.';
        }
        setTimeout(() => { label.textContent = 'Copy page'; button.disabled = false; if (status) status.textContent = ''; }, 2000);
    }));

    // ------------------------------------------------------------------ table of contents: highlight the visible heading
    const tocLinks = [...document.querySelectorAll('.toc a')];
    if (tocLinks.length && 'IntersectionObserver' in window) {
        const byId = new Map(tocLinks.map((link) => [decodeURIComponent(link.hash.slice(1)), link]));
        const visible = new Set();
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) entry.isIntersecting ? visible.add(entry.target.id) : visible.delete(entry.target.id);
            const first = [...byId.keys()].find((id) => visible.has(id));
            if (!first) return;
            tocLinks.forEach((link) => link.classList.toggle('active', link === byId.get(first)));
        }, { rootMargin: '-64px 0px -60% 0px' });
        byId.forEach((_, id) => { const heading = document.getElementById(id); if (heading) observer.observe(heading); });
    }

    // ------------------------------------------------------------------ search
    const dialog = document.querySelector('.search-dialog');
    const input = dialog?.querySelector('input');
    const list = dialog?.querySelector('.search-results');
    const empty = dialog?.querySelector('.search-empty');
    let index = null;
    let selected = 0;
    const escapeHtml = (value) => value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const mark = (text, words) => {
        let out = escapeHtml(text);
        for (const word of words) if (word.length > 1) out = out.replace(new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>');
        return out;
    };
    const load = async () => { if (!index) index = await (await fetch(`${base}/search.json`)).json(); return index; };
    const search = async () => {
        const query = input.value.trim().toLowerCase();
        const words = query.split(/\s+/).filter(Boolean);
        if (!words.length) { list.innerHTML = ''; empty.hidden = true; return; }
        const entries = await load();
        const results = entries.map((entry) => {
            const title = entry.t.toLowerCase(), section = entry.s.toLowerCase(), text = entry.x.toLowerCase();
            let score = 0;
            for (const word of words) {
                if (title.includes(word)) score += title.startsWith(word) ? 12 : 8;
                else if (section.includes(word)) score += 3;
                else if (text.includes(word)) score += 1;
                else return null;
            }
            if (title === query) score += 20;
            if (!entry.u.includes('#')) score += 2;
            return { entry, score };
        }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 12);
        selected = 0;
        empty.hidden = results.length > 0;
        list.innerHTML = results.map(({ entry }, position) => `<li><a href="${base}${entry.u}" role="option" aria-selected="${position === 0}"><span class="result-title">${mark(entry.t, words)}</span><span class="result-section">${escapeHtml(entry.s)}</span></a></li>`).join('');
    };
    const open = () => { if (!dialog) return; dialog.hidden = false; input.value = ''; list.innerHTML = ''; empty.hidden = true; input.focus(); load(); };
    const close = () => { if (dialog) dialog.hidden = true; };
    const move = (step) => {
        const links = [...list.querySelectorAll('a')];
        if (!links.length) return;
        selected = (selected + step + links.length) % links.length;
        links.forEach((link, position) => link.setAttribute('aria-selected', String(position === selected)));
        links[selected].scrollIntoView({ block: 'nearest' });
    };
    document.querySelector('.search-button')?.addEventListener('click', open);
    dialog?.addEventListener('click', (event) => { if (event.target === dialog) close(); });
    input?.addEventListener('input', search);
    input?.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
        else if (event.key === 'Enter') { const link = list.querySelectorAll('a')[selected]; if (link) { location.href = link.href; close(); } }
    });
    list?.addEventListener('click', close);
    document.addEventListener('keydown', (event) => {
        if ((event.key === 'k' && (event.ctrlKey || event.metaKey)) || (event.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName ?? ''))) { event.preventDefault(); open(); }
        else if (event.key === 'Escape') { close(); setNav(false); }
    });
})();
