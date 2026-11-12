// @navette-js/wire — runtime serveur de composants à état, compatible avec le protocole du client livewire.js 4.4.8.
// Prototype du jalon 0 (ADR 0001). Référence : sources/demo/vendor/livewire/livewire/src/Mechanisms/HandleComponents.
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { UploadStore } from './uploads.ts';
export { UploadStore, type TemporaryFile } from './uploads.ts';

export type Effects = {
    html?: string;
    returns?: unknown[];
    dispatches?: { name: string; params: Record<string, unknown>; self?: boolean; to?: string }[];
    redirect?: string;
    redirectUsingNavigate?: boolean;
    partials?: Record<string, string>;
    [key: string]: unknown;
};
export type Snapshot = { data: Record<string, unknown>; memo: Record<string, any>; checksum: string };
export type Call = { method: string; params: unknown[]; metadata?: Record<string, unknown> };
type ComponentClass = (new () => Component) & { componentName?: string; callable?: string[]; locked?: string[]; reactive?: string[]; listeners?: Record<string, string> };

export class WireError extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; }
}

/** Classe de base d'un composant. Toute propriété propre énumérable ne commençant pas par `_` est de l'état public. */
export abstract class Component {
    _id = '';
    _effects: Effects = {};
    _skipRender = false;
    _errors: Record<string, string[]> = {};
    /** Contexte de la requête HTTP en cours (requête, réponse, panel…), fourni par l'intégration. */
    _ctx: any = null;

    /** Runtime et requête d'origine : servent à monter des composants enfants pendant le rendu. */
    _runtime: WireRuntime | null = null;
    _request: { path?: string; method?: string } = {};
    /** Enfants rendus pendant cette requête, et enfants déjà présents dans le navigateur : clé → [balise, identifiant]. */
    _children: Record<string, [string, string]> = {};
    _previousChildren: Record<string, [string, string]> = {};

    /** HTML affiché tant qu'un composant « lazy » n'est pas chargé : une seule racine. */
    placeholder(): string | Promise<string> { return '<div></div>'; }

    /**
     * Monte un composant enfant et rend son HTML, à insérer dans le rendu du parent (équivalent de `@livewire`).
     * Si le navigateur possède déjà cet enfant (même clé), seule une souche est rendue : le client conserve l'enfant tel quel.
     * `lazy` : l'enfant affiche son `placeholder()` et se charge quand il devient visible.
     */
    async mountChild(name: string, params: Record<string, unknown> = {}, key: string, options: { lazy?: boolean } = {}): Promise<string> {
        if (!this._runtime) throw new Error('mountChild() : composant hors runtime.');
        const previous = this._previousChildren[key];
        if (previous) {
            this._children[key] = previous;
            // Propriétés réactives : l'enfant, mis à jour dans la même requête, reprendra ces valeurs (équivalent de #[Reactive]).
            this._runtime.passPropsToChild(previous[1], params);
            return `<${previous[0]} wire:id="${previous[1]}" wire:name="${escapeAttr(name)}" wire:key="${escapeAttr(key)}"></${previous[0]}>`;
        }
        const { html, component } = await this._runtime.mountWithInstance(name, params, { ...this._request, ctx: this._ctx, lazy: options.lazy, key });
        this._children[key] = [/^\s*<([a-zA-Z0-9-]+)/.exec(html)![1], component.id];
        return html;
    }

    /** Rend le HTML du composant : une seule racine. */
    abstract render(): string | Promise<string>;

    mount(_params: Record<string, unknown>): void | Promise<void> {}
    boot(): void | Promise<void> {}
    hydrate(): void | Promise<void> {}
    dehydrate(): void | Promise<void> {}

    get id(): string { return this._id; }

    /** `self` : l'événement n'est reçu que par ce composant (équivalent de `->self()`). */
    dispatch(name: string, params: Record<string, unknown> | unknown[] = {}, options: { self?: boolean } = {}): void {
        (this._effects.dispatches ??= []).push({ name, params: params as any, ...(options.self ? { self: true } : {}) });
    }
    redirect(url: string, navigate = false): void {
        this._effects.redirect = url;
        if (navigate) this._effects.redirectUsingNavigate = true;
    }
    skipRender(): void { this._skipRender = true; }
    /** Rendu partiel à la Filament : seul le fragment `wire:partial="<nom>"` est renvoyé (effects.partials), sans re-rendre tout le composant. */
    renderPartial(name: string, html: string): void { (this._effects.partials ??= {})[name] = html; this._skipRender = true; }
    addError(path: string, message: string): void { (this._errors[path] ??= []).push(message); }
    resetErrorBag(): void { this._errors = {}; }
}

const LIFECYCLE = new Set(['constructor', 'render', 'mount', 'boot', 'hydrate', 'dehydrate', 'dispatch', 'redirect', 'skipRender', 'renderPartial', 'addError', 'resetErrorBag', 'mountChild', 'placeholder']);
// Seuls les hooks de propriété (updatingFoo / updatedFoo) sont réservés par préfixe : `mountAction`, par exemple, est une méthode publique ordinaire.
const isLifecycleHook = (m: string) => LIFECYCLE.has(m) || /^(updating|updated)[A-Z]/.test(m) || m.startsWith('_');

/**
 * Méthodes appelables depuis le navigateur : uniquement celles que la classe (ou une classe parente) nomme dans `static callable`.
 * TypeScript efface `protected` et `private` à l'exécution : sans cette liste, toute méthode interne serait appelable par une
 * requête forgée, et sa valeur de retour renvoyée au navigateur.
 */
export function callableMethods(component: Component): Set<string> {
    const out = new Set<string>();
    for (let cls: any = component.constructor; cls && cls !== Component; cls = Object.getPrototypeOf(cls)) {
        if (!Object.prototype.hasOwnProperty.call(cls, 'callable') || !Array.isArray(cls.callable)) continue;
        for (const name of cls.callable) if (typeof name === 'string' && !isLifecycleHook(name) && typeof (component as any)[name] === 'function') out.add(name);
    }
    return out;
}

export function publicProperties(component: Component): string[] {
    return Object.keys(component).filter((k) => !k.startsWith('_'));
}

// --- Synthétiseurs : les tableaux et objets voyagent sous la forme [valeur, { s: 'arr' }] (HandleSynths de Livewire).
export function dehydrateValue(value: unknown): unknown {
    if (value === undefined) return null;
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return [value.map(dehydrateValue), { s: 'arr' }];
    return [Object.fromEntries(Object.entries(value).map(([k, v]) => [k, dehydrateValue(v)])), { s: 'arr' }];
}
export function hydrateValue(value: unknown): unknown {
    if (Array.isArray(value) && value.length === 2 && value[1] && typeof value[1] === 'object' && 's' in (value[1] as object)) {
        const inner = value[0];
        if (Array.isArray(inner)) return inner.map(hydrateValue);
        return Object.fromEntries(Object.entries(inner as object).map(([k, v]) => [k, hydrateValue(v)]));
    }
    return value;
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#039;');

/** Équivalent de Utils::insertAttributesIntoHtmlRoot : pose des attributs sur la balise racine. */
export function insertAttributesIntoHtmlRoot(html: string, attributes: Record<string, unknown>): string {
    const m = /^\s*<([a-zA-Z0-9-]+)/.exec(html);
    if (!m) throw new WireError(500, 'Le rendu d\'un composant doit commencer par une balise racine.');
    const attrs = Object.entries(attributes)
        .map(([k, v]) => `${k}="${escapeAttr(typeof v === 'string' ? v : JSON.stringify(v))}"`)
        .join(' ');
    const at = m.index + m[0].length;
    return html.slice(0, at) + ' ' + attrs + html.slice(at);
}

function setByPath(target: any, segments: string[], value: unknown): void {
    let node = target;
    for (let i = 0; i < segments.length - 1; i++) {
        const key = segments[i];
        if (node[key] === null || typeof node[key] !== 'object') node[key] = {};
        node = node[key];
    }
    const last = segments[segments.length - 1];
    if (value === '__rm__') { Array.isArray(node) ? node.splice(Number(last), 1) : delete node[last]; } else node[last] = value;
}
/** Identifiant alphanumérique de 20 caractères, comme Str::random(20) de Livewire (il sert dans des id HTML et des sélecteurs). */
const randomId = () => Array.from(randomBytes(20), (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62]).join('');
const MAGIC_ACTIONS = new Set(['$refresh', '$set', '$sync', '$commit']);
const studly =(s: string) => s.replace(/(^|[_.-])(\w)/g, (_, __, c) => c.toUpperCase());

export type RuntimeOptions = { key: string; locale?: string; /** Dossier des téléversements temporaires ; sans lui, les envois de fichiers sont refusés. */ uploads?: UploadStore; uploadPrefix?: string };

/** Faux si la valeur contient, à n'importe quelle profondeur, une référence de fichier temporaire qui ne désigne aucun fichier reçu. */
function uploadReferencesAreValid(value: unknown, store: UploadStore | null, depth = 0): boolean {
    if (typeof value === 'string') return value.startsWith('livewire-files:') ? false : value.startsWith('livewire-file:') ? !!store?.resolve(value) : true;
    if (!value || typeof value !== 'object') return true;
    if (depth > 8) return false;
    return Object.values(value as object).every((v) => uploadReferencesAreValid(v, store, depth + 1));
}

/** Propriétés réactives d'un composant (`static reactive`) : fixées par le parent, jamais par le navigateur. */
const reactiveProps = (component: Component): string[] => (component.constructor as ComponentClass).reactive ?? [];

export class WireRuntime {
    private registry = new Map<string, ComponentClass>();
    private options: RuntimeOptions;
    constructor(options: RuntimeOptions) { this.options = options; }
    get uploads(): UploadStore | null { return this.options.uploads ?? null; }

    /** Paramètres passés par un parent à ses enfants déjà présents, pendant la requête en cours : identifiant de l'enfant → paramètres. */
    private requestScope = new AsyncLocalStorage<{ childProps: Map<string, Record<string, unknown>> }>();
    passPropsToChild(childId: string, params: Record<string, unknown>): void { this.requestScope.getStore()?.childProps.set(childId, params); }

    register(name: string, cls: ComponentClass): this { this.registry.set(name, cls); cls.componentName = name; return this; }

    private make(name: string): Component {
        const cls = this.registry.get(name);
        if (!cls) throw new WireError(404, `Composant inconnu : ${name}`);
        return new cls();
    }

    checksum(snapshot: Omit<Snapshot, 'checksum'>): string {
        const { children: _children, ...memo } = snapshot.memo; // les enfants peuvent être modifiés par le client
        return createHmac('sha256', this.options.key).update(JSON.stringify({ data: snapshot.data, memo })).digest('hex');
    }

    private snapshot(component: Component, name: string, memo: Record<string, unknown>): Snapshot {
        const data: Record<string, unknown> = {};
        for (const k of publicProperties(component)) data[k] = dehydrateValue((component as any)[k]);
        const body = { data, memo: { id: component.id, name, ...memo, errors: component._errors } };
        return { ...body, checksum: this.checksum(body) };
    }

    /** Paramètres de montage d'un composant « lazy », signés : le navigateur les renvoie tels quels à `__lazyLoad` (conteneur `__mountParamsContainer` de Livewire). */
    private encodeMountParams(name: string, params: Record<string, unknown>, request: { path?: string; method?: string }): string {
        const body = { data: { forMount: dehydrateValue(params), forComponent: name }, memo: { id: randomId(), name: '__mountParamsContainer', path: request.path ?? '/', method: request.method ?? 'GET', release: 'a-a-a' } };
        return Buffer.from(JSON.stringify({ ...body, checksum: this.checksum(body) })).toString('base64');
    }
    private decodeMountParams(name: string, encoded: unknown): Record<string, unknown> {
        let container: any;
        try { container = JSON.parse(Buffer.from(String(encoded), 'base64').toString('utf8')); } catch { throw new WireError(404, 'Paramètres de montage illisibles.'); }
        if (!container || typeof container.data !== 'object' || typeof container.memo !== 'object' || typeof container.checksum !== 'string') throw new WireError(404, 'Paramètres de montage invalides.');
        const expected = Buffer.from(this.checksum(container)), given = Buffer.from(container.checksum);
        if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new WireError(419, 'Somme de contrôle des paramètres de montage invalide.');
        // Les paramètres signés pour un composant ne valent pas pour un autre.
        if (container.memo.name !== '__mountParamsContainer' || container.data.forComponent !== name) throw new WireError(403, 'Paramètres de montage destinés à un autre composant.');
        return (hydrateValue(container.data.forMount) ?? {}) as Record<string, unknown>;
    }
    /** Comme Livewire : un paramètre de montage du même nom qu'une propriété publique y est copié. */
    private assignMatchingProperties(component: Component, params: Record<string, unknown>): void {
        const known = new Set(publicProperties(component));
        for (const [k, v] of Object.entries(params)) if (known.has(k)) (component as any)[k] = v;
    }

    private async renderRoot(component: Component, name: string): Promise<string> {
        const html = await component.render();
        return insertAttributesIntoHtmlRoot(html, { 'wire:id': component.id, 'wire:name': name });
    }

    /** Premier rendu : HTML avec wire:snapshot et wire:effects sur la racine.
     *  Le mémo ne porte `lazyLoaded` / `lazyIsolated` que pour un composant réellement « lazy » : leur seule présence fait ignorer les événements au client. */
    async mount(name: string, params: Record<string, unknown> = {}, request: { path?: string; method?: string; ctx?: unknown } = {}): Promise<string> {
        return (await this.mountWithInstance(name, params, request)).html;
    }
    /** Comme mount(), mais rend aussi l'instance montée (pour lire son titre, par exemple). */
    async mountWithInstance(name: string, params: Record<string, unknown> = {}, request: { path?: string; method?: string; ctx?: unknown; lazy?: boolean; key?: string } = {}): Promise<{ html: string; component: Component }> {
        const component = this.make(name);
        component._ctx = request.ctx ?? null;
        // Identifiant alphanumérique de 20 caractères, comme Str::random(20) de Livewire (il sert dans des id HTML et des sélecteurs).
        component._id = randomId();
        component._runtime = this;
        component._request = { path: request.path, method: request.method };
        await component.boot();
        this.assignMatchingProperties(component, params);
        let html: string;
        if (request.lazy) {
            // Composant « lazy » : `mount()` et le rendu attendent l'appel `__lazyLoad` du navigateur.
            const placeholder = insertAttributesIntoHtmlRoot(await component.placeholder(), { 'x-intersect': `$wire.__lazyLoad('${this.encodeMountParams(name, params, request)}')` });
            html = insertAttributesIntoHtmlRoot(placeholder, { 'wire:id': component.id, 'wire:name': name });
        } else {
            await component.mount(params);
            html = await this.renderRoot(component, name);
        }
        await component.dehydrate();
        const snapshot = this.snapshot(component, name, {
            path: request.path ?? '/', method: request.method ?? 'GET', release: 'a-a-a', children: Object.keys(component._children).length ? component._children : [], scripts: [], assets: [],
            ...(request.lazy ? { lazyLoaded: false, lazyIsolated: true } : {}), ...(reactiveProps(component).length ? { props: reactiveProps(component) } : {}), locale: this.options.locale ?? 'en', islands: [],
        });
        const { html: _h, ...effects } = component._effects;
        // Écouteurs d'événements (équivalent de #[On]) : le client appellera `__dispatch(événement, paramètres)`.
        const listeners = Object.keys((component.constructor as ComponentClass).listeners ?? {});
        if (listeners.length) effects.listeners = listeners;
        return { html: insertAttributesIntoHtmlRoot(html, { ...(request.key !== undefined ? { 'wire:key': request.key } : {}), 'wire:snapshot': JSON.stringify(snapshot), 'wire:effects': JSON.stringify(effects) }), component };
    }

    /** Requête de mise à jour d'un composant : hydratation, mises à jour, appels, rendu, déshydratation. */
    async update(snapshot: Snapshot, updates: Record<string, unknown>, calls: Call[], ctx: unknown = null): Promise<{ snapshot: Snapshot; effects: Effects }> {
        if (!snapshot || typeof snapshot.data !== 'object' || typeof snapshot.memo !== 'object' || typeof snapshot.checksum !== 'string') throw new WireError(404, 'Snapshot invalide.');
        const expected = Buffer.from(this.checksum(snapshot)), given = Buffer.from(snapshot.checksum);
        if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new WireError(419, 'Somme de contrôle du snapshot invalide.');

        const name = snapshot.memo.name as string;
        const component = this.make(name);
        const cls = component.constructor as ComponentClass;
        component._id = snapshot.memo.id;
        component._ctx = ctx;
        component._errors = { ...(snapshot.memo.errors ?? {}) };
        component._runtime = this;
        component._request = { path: snapshot.memo.path, method: snapshot.memo.method };
        // `memo.children` n'est pas couvert par la somme de contrôle (le client le tient à jour) : seules les entrées bien formées sont retenues.
        if (snapshot.memo.children && typeof snapshot.memo.children === 'object' && !Array.isArray(snapshot.memo.children)) {
            for (const [key, value] of Object.entries(snapshot.memo.children as Record<string, unknown>)) {
                if (Array.isArray(value) && /^[a-zA-Z][a-zA-Z0-9-]*$/.test(String(value[0])) && /^[A-Za-z0-9]{1,64}$/.test(String(value[1]))) component._previousChildren[key] = [String(value[0]), String(value[1])];
            }
        }
        const awaitsLazyLoad = snapshot.memo.lazyLoaded === false;
        let lazyLoaded = false;
        const known = new Set(publicProperties(component));
        for (const [k, v] of Object.entries(snapshot.data)) if (known.has(k)) (component as any)[k] = hydrateValue(v);
        // Propriétés réactives : elles ne viennent que du parent, rendu plus tôt dans la même requête.
        const reactive = new Set(reactiveProps(component));
        const passed = this.requestScope.getStore()?.childProps.get(component.id);
        if (passed) for (const prop of reactive) if (Object.prototype.hasOwnProperty.call(passed, prop) && known.has(prop)) (component as any)[prop] = passed[prop];
        await component.boot();
        await component.hydrate();

        const applyUpdate = async (path: string, value: unknown): Promise<void> => {
            const segments = path.split('.');
            const prop = segments[0];
            if (!known.has(prop)) throw new WireError(404, `Propriété publique introuvable : ${prop}`);
            if (cls.locked?.includes(prop)) throw new WireError(403, `Propriété verrouillée : ${prop}`);
            if (reactive.has(prop)) throw new WireError(403, `Propriété réactive, fixée par le composant parent : ${prop}`);
            // Un segment comme `__proto__` écrirait dans le prototype partagé par tous les objets du serveur.
            if (segments.some((segment) => segment === '__proto__' || segment === 'constructor' || segment === 'prototype')) throw new WireError(403, `Chemin d'état refusé : ${path}`);
            const anyC = component as any;
            await anyC.updating?.(path, value);
            await anyC[`updating${studly(prop)}`]?.(value, segments.slice(1).join('.') || null);
            setByPath(component, segments, value);
            await anyC.updated?.(path, value);
            await anyC[`updated${studly(prop)}`]?.(value, segments.slice(1).join('.') || null);
        };
        for (const [path, value] of Object.entries(updates)) {
            // Une référence de fichier temporaire renvoyée par le navigateur doit désigner un fichier réellement reçu.
            if (!uploadReferencesAreValid(value, this.uploads)) throw new WireError(403, `Référence de fichier refusée : ${path}`);
            await applyUpdate(path, value);
        }

        const allowed = callableMethods(component);
        const returns: unknown[] = [];
        for (const call of calls) {
            if (typeof call?.method !== 'string' || !Array.isArray(call.params)) throw new WireError(404, 'Appel invalide.');
            // Actions magiques : sans effet côté serveur, les valeurs voyagent dans `updates` (SupportMagicActions de Livewire).
            if (MAGIC_ACTIONS.has(call.method)) { returns.push(null); continue; }
            if (call.method === '__lazyLoad') {
                if (!awaitsLazyLoad || lazyLoaded) throw new WireError(404, 'Ce composant n\'attend pas de chargement différé.');
                const params = this.decodeMountParams(name, call.params[0]);
                this.assignMatchingProperties(component, params);
                await component.mount(params);
                lazyLoaded = true;
                returns.push(null);
                continue;
            }
            // Tant qu'il n'est pas chargé, un composant « lazy » n'a pas été monté : rien d'autre n'est appelable.
            if (awaitsLazyLoad && !lazyLoaded) throw new WireError(404, 'Composant non chargé.');
            // --- téléversement de fichiers (port de WithFileUploads) : la cible est un chemin d'état, soumis aux mêmes gardes qu'une mise à jour
            if (call.method === '_startUpload' || call.method === '_finishUpload' || call.method === '_uploadErrored' || call.method === '_removeUpload') {
                const store = this.uploads;
                const target = call.params[0];
                if (!store || typeof target !== 'string' || target.length > 500) throw new WireError(404, 'Téléversement indisponible.');
                if (call.method === '_startUpload') {
                    component.dispatch('upload:generatedSignedUrl', { name: target, url: store.signedUrl(this.options.uploadPrefix ?? '/livewire') }, { self: true });
                    component._skipRender = true;
                } else if (call.method === '_finishUpload') {
                    const ids = Array.isArray(call.params[1]) ? call.params[1].map(String) : [];
                    if (!ids.length || ids.some((id) => !store.resolve(id))) throw new WireError(404, 'Fichier temporaire introuvable.');
                    await applyUpdate(target, call.params[2] === true ? ids.map((id) => UploadStore.reference(id)) : UploadStore.reference(ids[0]));
                    component.dispatch('upload:finished', { name: target, tmpFilenames: ids }, { self: true });
                } else if (call.method === '_uploadErrored') {
                    component.dispatch('upload:errored', { name: target }, { self: true });
                    component.addError(target, 'The file failed to upload.');
                } else {
                    component.dispatch('upload:removed', { name: target, tmpFilename: String(call.params[1] ?? '') }, { self: true });
                    component._skipRender = true;
                }
                returns.push(null);
                continue;
            }
            if (call.method === '__dispatch') {
                const handler = cls.listeners?.[String(call.params[0])];
                if (!handler) throw new WireError(404, `Aucun écouteur pour l'événement : ${String(call.params[0])}`);
                const args = call.params[1] && typeof call.params[1] === 'object' ? Object.values(call.params[1] as object) : [];
                returns.push((await (component as any)[handler](...args)) ?? null);
                continue;
            }
            if (!allowed.has(call.method)) {
                // Aide au développement : la méthode existe mais n'est pas déclarée appelable.
                if (process.env.NODE_ENV !== 'production' && typeof (component as any)[call.method] === 'function' && !isLifecycleHook(call.method)) console.warn(`[wire] ${name} : « ${call.method} » existe mais n'est pas dans static callable — appel refusé.`);
                throw new WireError(404, `Méthode introuvable : ${call.method}`);
            }
            returns.push((await (component as any)[call.method](...call.params)) ?? null);
        }

        const effects = component._effects;
        effects.returns = returns;
        if (awaitsLazyLoad && !lazyLoaded) component._skipRender = true;
        const rendered = !component._skipRender && !effects.redirect;
        if (rendered) { effects.html = await this.renderRoot(component, name); effects.partials ??= {}; }
        await component.dehydrate();
        const { id: _i, name: _n, errors: _e, ...memo } = snapshot.memo;
        // Après un rendu complet, la liste des enfants est celle qui vient d'être rendue ; sinon elle est conservée.
        if (rendered) memo.children = Object.keys(component._children).length ? component._children : [];
        if (lazyLoaded) { memo.lazyLoaded = true; delete memo.lazyIsolated; }
        return { snapshot: this.snapshot(component, name, memo), effects };
    }

    /** Point d'entrée HTTP : corps `{ _token, components: [{ snapshot, updates, calls }] }`. */
    async handle(body: any, ctx: unknown = null): Promise<{ components: { snapshot: string; effects: Effects }[]; assets: unknown[] }> {
        const list = body?.components;
        if (!Array.isArray(list) || list.length === 0) throw new WireError(404, 'Charge utile invalide.');
        const components: { snapshot: string; effects: Effects }[] = [];
        // Les composants d'une requête sont traités dans l'ordre : un parent passe ses propriétés réactives aux enfants qui le suivent.
        await this.requestScope.run({ childProps: new Map() }, async () => {
        for (const c of list) {
            if (typeof c?.snapshot !== 'string' || typeof c.updates !== 'object' || !Array.isArray(c.calls)) throw new WireError(404, 'Charge utile invalide.');
            const { snapshot, effects } = await this.update(JSON.parse(c.snapshot), c.updates ?? {}, c.calls, ctx);
            components.push({ snapshot: JSON.stringify(snapshot), effects });
        }
        });
        return { components, assets: [] };
    }
}
