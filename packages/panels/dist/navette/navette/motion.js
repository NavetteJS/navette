// Navette — pastille d'activité : signale une requête qui dure, pour que l'écran ne paraisse jamais figé.
// Écart volontaire avec FilamentPHP, désactivable avec `Panel.motion(false)`. Aucune dépendance : s'appuie sur les hooks de Livewire.
(() => {
    const DELAY = 350; // en dessous, la réponse arrive avant qu'un indicateur soit utile
    let pending = 0;
    let timer = null;

    const pill = () => {
        let element = document.querySelector('.nv-busy');
        if (!element) {
            element = document.createElement('div');
            element.className = 'nv-busy';
            element.setAttribute('role', 'status');
            element.setAttribute('aria-live', 'polite');
            // Conservée d'une page à l'autre par la navigation de Livewire.
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
        // Chaque requête de mise à jour d'un composant.
        window.Livewire.hook('commit', ({ succeed, fail }) => {
            begin();
            let done = false;
            const finish = () => { if (!done) { done = true; end(); } };
            succeed(finish);
            fail(finish);
        });
    });
    // Navigation entre pages.
    document.addEventListener('livewire:navigate', begin);
    document.addEventListener('livewire:navigated', () => { pending = 0; update(); });
})();
