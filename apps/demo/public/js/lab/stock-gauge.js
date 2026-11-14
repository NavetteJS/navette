// Renderer of the `/lab` "Framework fields" stock gauge: a Vue component mounted by Navette's `JsComponent`.
// Its configuration (stock and security stock) is computed on the server, and updated without remounting after each render.
import { createApp, h, shallowRef } from '../../vendor/vue/vue.runtime.esm-browser.prod.js';

const StockGauge = {
    props: ['configuration', 'id'],
    setup(props) {
        return () => {
            const { qty = 0, securityStock = 0, max = 1 } = props.configuration ?? {};
            const percent = Math.round((Math.min(qty ?? 0, max) / max) * 100);
            const status = qty === null ? 'Unknown' : qty <= securityStock ? 'Reorder soon' : 'In stock';

            return h('div', { id: props.id ?? undefined, class: 'fi-lab-stock-gauge', style: 'display: grid; gap: 0.5rem' }, [
                h('div', { style: 'display: flex; justify-content: space-between; font-size: 0.875rem' }, [
                    h('span', { 'data-stock-status': '' }, status),
                    h('span', { 'data-stock-quantity': '' }, `${qty ?? 0} / ${max}`),
                ]),
                h('div', {
                    role: 'meter',
                    'aria-label': 'Stock level',
                    'aria-valuemin': 0,
                    'aria-valuemax': max,
                    'aria-valuenow': qty ?? 0,
                    style: 'height: 0.5rem; border-radius: 9999px; background: rgb(127 127 127 / 0.25); overflow: hidden',
                }, [
                    h('div', { style: `height: 100%; width: ${percent}%; background: ${qty !== null && qty <= securityStock ? 'var(--warning-500)' : 'var(--primary-500)'}` }),
                ]),
            ]);
        };
    },
};

export default function mountStockGauge({ host, props: initialProps }) {
    const props = shallowRef(initialProps);
    const application = createApp({ setup: () => () => h(StockGauge, props.value) });

    application.mount(host);

    return {
        update(nextProps) {
            props.value = nextProps;
        },
        destroy: () => application.unmount(),
    };
}
