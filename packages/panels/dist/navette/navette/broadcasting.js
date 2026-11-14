// Navette broadcasting client: reads the panel's Server-Sent Events stream and offers a small `window.Echo`
// (`Echo.private(channel).listen(event, callback)`) to the notification components. EventSource reconnects by itself
// after a network error and sends the last event id, so missed messages are replayed; a closed stream is reopened with backoff.
;(() => {
    if (window.navetteBroadcasting) return

    const channels = new Map()
    let source = null
    let url = null
    let retryDelay = 1000
    let retryTimer = null
    let hasConnected = false
    let isConnected = false

    const eventName = (event) => String(event).replace(/^\./, '')

    const deliver = (message) => {
        const callbacks = channels.get(message.channel)?.get(message.event)
        if (!callbacks) return
        for (const callback of [...callbacks]) {
            try {
                callback(message.data)
            } catch (error) {
                console.error(error)
            }
        }
    }

    const connect = () => {
        clearTimeout(retryTimer)
        source?.close()
        source = null
        isConnected = false
        if (!url || typeof EventSource === 'undefined') return

        const current = new EventSource(url)
        source = current
        current.onopen = () => {
            isConnected = true
            retryDelay = 1000
            if (hasConnected) window.dispatchEvent(new CustomEvent('navette-broadcasting-reconnected'))
            hasConnected = true
        }
        current.onmessage = (event) => {
            let message
            try {
                message = JSON.parse(event.data)
            } catch {
                return
            }
            if (message && typeof message.channel === 'string' && typeof message.event === 'string') deliver(message)
        }
        current.onerror = () => {
            isConnected = false
            // CONNECTING: the browser retries by itself. CLOSED (refused, server error): retry later, ever more slowly.
            if (current.readyState !== EventSource.CLOSED || source !== current) return
            source = null
            retryTimer = setTimeout(connect, retryDelay)
            retryDelay = Math.min(retryDelay * 2, 60000)
        }
    }

    const channel = (name) => {
        const api = {
            listen(event, callback) {
                const events = channels.get(name) ?? new Map()
                channels.set(name, events)
                const callbacks = events.get(eventName(event)) ?? new Set()
                events.set(eventName(event), callbacks)
                callbacks.add(callback)
                return api
            },
            stopListening(event, callback) {
                const callbacks = channels.get(name)?.get(eventName(event))
                if (!callbacks) return api
                if (callback) callbacks.delete(callback)
                else callbacks.clear()
                return api
            },
            notification(callback) {
                return api.listen('.notification.broadcast', callback)
            },
        }
        return api
    }

    const echo = {
        private: channel,
        channel,
        join: channel,
        // Requests carry no socket id: messages are never sent back to the browser that caused them.
        socketId: () => null,
        leave(name) {
            channels.delete(name)
        },
        connector: { isConnected: () => isConnected },
    }

    window.navetteBroadcasting = {
        /** Called by each page with the stream URL of its panel (and tenant): reconnects when it changes. */
        configure(config) {
            const next = config?.url ?? null
            if (next !== url) {
                url = next
                connect()
            }
            if (!window.Echo) {
                window.Echo = echo
                window.dispatchEvent(new CustomEvent('EchoLoaded'))
            }
        },
        isConnected: () => isConnected,
        disconnect() {
            url = null
            connect()
        },
    }

    window.addEventListener('pagehide', () => source?.close())
    window.addEventListener('pageshow', (event) => {
        if (event.persisted && url) connect()
    })
})()
