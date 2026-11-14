// Alpine component loaded on request (`x-load`) by the live notifications page: a clock ticking every second.
export default function liveClock() {
    return {
        time: '',
        timer: null,
        init() {
            const tick = () => {
                this.time = new Date().toLocaleTimeString('en-GB')
            }
            tick()
            this.timer = setInterval(tick, 1000)
        },
        destroy() {
            clearInterval(this.timer)
        },
    }
}
