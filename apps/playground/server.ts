import express from 'express';
import { WireRuntime } from '@navette-js/wire';
import { wireRouter, wireScripts, wireStyles } from '@navette-js/wire/express';
import { Counter } from './components/Counter.ts';
import { LiveField } from './components/LiveField.ts';
import { view } from './view.ts';
import { ColorManager, views } from '@navette-js/support';
import { ui, useColorManager } from '@navette-js/support/ui';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Scènes de composants (jalon 1) : mêmes pages et mêmes identifiants que docs-assets/app de Filament, couleurs par défaut.
useColorManager(new ColorManager());
views.namespace('scenes', fileURLToPath(new URL('./views/scenes', import.meta.url)));
views.share({ ui });

const runtime = new WireRuntime({ key: process.env.APP_KEY ?? 'cle-de-developpement-a-remplacer' })
    .register('counter', Counter)
    .register('live-field', LiveField);

const app = express();
app.use(wireRouter(runtime));
app.get('/', async (req, res) => {
    const request = { path: req.path, method: req.method };
    res.send(view('page', {
        counter: await runtime.mount('counter', { start: 5 }, request),
        liveField: await runtime.mount('live-field', {}, request),
        scripts: wireScripts(req, res),
        styles: wireStyles(),
    }));
});
const scene = (name: string) => (req: express.Request, res: express.Response) => {
    const file = fileURLToPath(new URL(`./views/scenes/${name}.ejs`, import.meta.url));
    if (!/^[a-z-]+$/.test(name) || !existsSync(file)) { res.status(404).send('Scène inconnue.'); return; }
    res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${name}</title></head><body><div class="min-h-screen">${views.render(`scenes::${name}`)}</div></body></html>`);
};
app.get('/components/:name', (req, res) => scene(String(req.params.name))(req, res));
app.get('/pagination', scene('pagination'));

const port = Number(process.env.PORT ?? 3100);
app.listen(port, '127.0.0.1', () => console.log(`Navette playground : http://127.0.0.1:${port}`));
