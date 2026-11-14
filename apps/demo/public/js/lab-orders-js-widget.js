// Renderer of the lab's JavaScript widget (apps/demo/widgets/lab-d11-js-widget.ts): framework-free DOM code. It counts its
// mounts and updates on the host, so that the end-to-end test can check a configuration change updates it in place.
/** @param {import('@navette-js/panels').JsWidgetRendererContext} context */
export default function mountOrdersOverview({ host, props: initialProps, utilities }) {
    const heading = document.createElement('h2')
    heading.className = 'nv-lab-js-widget-heading'
    const status = document.createElement('p')
    status.className = 'nv-lab-js-widget-status'
    const orders = document.createElement('p')
    orders.className = 'nv-lab-js-widget-orders'
    const refreshes = document.createElement('p')
    refreshes.className = 'nv-lab-js-widget-refreshes'
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'nv-btn nv-size-sm nv-lab-js-widget-refresh'
    button.textContent = 'Refresh'
    button.onclick = () => utilities.$wire.$call('refreshOrders')

    host.dataset.mounts = String(Number(host.dataset.mounts ?? 0) + 1)
    host.dataset.updates = '0'

    const update = ({ configuration }) => {
        heading.textContent = configuration.heading
        status.textContent = configuration.status
        orders.textContent = `${configuration.orders} orders`
        refreshes.textContent = `Refreshed ${configuration.refreshes} times`
    }

    update(initialProps)
    host.append(heading, status, orders, refreshes, button)

    return {
        update(props) {
            host.dataset.updates = String(Number(host.dataset.updates) + 1)
            update(props)
        },
        destroy: () => host.replaceChildren(),
    }
}
