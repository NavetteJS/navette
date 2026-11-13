// Navette activity pill: signals a request that takes a while, so that the screen never looks frozen.
// A deliberate difference from FilamentPHP, turned off with `Panel.motion(false)`. No dependency: it relies on Livewire's hooks.
(() => {
    const DELAY = 350; // below this, the response arrives before an indicator would help
    let pending = 0;
    let timer = null;

    const pill = () => {
        let element = document.querySelector('.nv-busy');
        if (!element) {
            element = document.createElement('div');
            element.className = 'nv-busy';
            element.setAttribute('role', 'status');
            element.setAttribute('aria-live', 'polite');
            // Kept from one page to the next by Livewire's navigation.
            element.setAttribute('wire:ignore', '');
            element.setAttribute('x-persist', 'nv-busy');
            element.textContent = document.documentElement.lang?.startsWith('fr') ? 'Chargement…' : 'Loading…';
            document.body.appendChild(element);
        }
        return element;
    };
    const update = () => {
        if (pending > 0) {
            if (timer === null && !document.documentElement.hasAttribute('data-nv-busy')) {
                timer = setTimeout(() => { timer = null; if (pending > 0) { pill(); document.documentElement.setAttribute('data-nv-busy', ''); } }, DELAY);
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
