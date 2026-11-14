// Busy state: `html[data-nv-busy]` while a request takes a while, so reloading areas can fade (see motion.css).
// The page-level indicator is page-loading.js.
// A Navette addition, turned off with `Panel.motion(false)`. No dependency: it relies on Livewire's hooks.
(() => {
    const DELAY = 350; // below this, the response arrives before an indicator would help
    let pending = 0;
    let timer = null;

    const update = () => {
        if (pending > 0) {
            if (timer === null && !document.documentElement.hasAttribute('data-nv-busy')) {
                timer = setTimeout(() => { timer = null; if (pending > 0) document.documentElement.setAttribute('data-nv-busy', ''); }, DELAY);
            }
            return;
        }
        if (timer !== null) { clearTimeout(timer); timer = null; }
        document.documentElement.removeAttribute('data-nv-busy');
    };
    const begin = () => { pending++; update(); };
    const end = () => { pending = Math.max(0, pending - 1); update(); };

    document.addEventListener('livewire:init', () => {
        // Every update request of a component.
        window.Livewire.hook('commit', ({ succeed, fail }) => {
            begin();
            let done = false;
            const finish = () => { if (!done) { done = true; end(); } };
            succeed(finish);
            fail(finish);
        });
    });
    // Navigation between pages.
    document.addEventListener('livewire:navigate', begin);
    document.addEventListener('livewire:navigated', () => { pending = 0; update(); });
})();
