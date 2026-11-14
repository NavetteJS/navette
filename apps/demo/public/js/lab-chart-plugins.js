// Chart.js plugins of the `/lab` panel, loaded by a `panels::scripts.before` render hook. A real application would
// bundle npm plugins here (`import ChartDataLabels from 'chartjs-plugin-datalabels'`) with esbuild or Vite.

// Inline plugin, given to every chart widget (`new Chart(…, { plugins: [...] })`): draws a border around the chart area.
window.navetteChartJsPlugins ??= [];
window.navetteChartJsPlugins.push({
    id: 'navetteLabChartAreaBorder',
    afterDraw(chart) {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        ctx.save();
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
        ctx.restore();
        // Lets the end-to-end tests see that the plugin ran.
        chart.canvas.dataset.labPlugin = 'drawn';
    },
});

// Global plugin, registered with `Chart.register()` before the first chart is created.
window.navetteChartJsGlobalPlugins ??= [];
window.navetteChartJsGlobalPlugins.push({
    id: 'navetteLabGlobalPlugin',
    beforeInit(chart) { chart.canvas.dataset.labGlobalPlugin = 'registered'; },
});
