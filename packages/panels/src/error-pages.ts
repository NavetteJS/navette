// Error pages (404, 403, 500…): the Navette cable car in trouble, in the panel's colors.
// The illustrations are inline SVG: their colors come from the panel's CSS variables, light and dark.

/** Statuses with their own illustration and texts; the others use the closest one (4xx: 404, 5xx: 500). */
export const ERROR_PAGE_STATUSES = [401, 403, 404, 419, 429, 500, 503] as const;
export type ErrorPageStatus = (typeof ERROR_PAGE_STATUSES)[number];

/** The illustrated status for any HTTP status. */
export function errorPageScene(status: number): ErrorPageStatus {
    if ((ERROR_PAGE_STATUSES as readonly number[]).includes(status)) return status as ErrorPageStatus;
    return status >= 500 ? 500 : 404;
}

const W = 400;
/** The cable rises from left to right, like the logo's. */
const cableY = (x: number) => 72 - 0.12 * x;

/**
 * A cabin hanging from its wheel at (x, y), drawn from the logo's geometry. `code` is painted on the cabin.
 * `swing`: the cabin sways around its wheel.
 */
function cabin(x: number, y: number, options: { scale?: number; rotate?: number; code?: string; swing?: 'slow' | 'dangling' | 'shake' | 'bounce' | null; delay?: number } = {}): string {
    const scale = options.scale ?? 0.62;
    const code = options.code ? `<text x="75" y="155" text-anchor="middle" class="fi-error-cabin-code">${options.code}</text>` : '';
    const drawing = `<g transform="translate(${x} ${y}) rotate(${options.rotate ?? 0}) scale(${scale}) translate(-75 -27)">`
        + '<path class="fi-error-hanger" d="M75,30 V72" />'
        + '<circle class="fi-error-wheel" cx="75" cy="27" r="9" />'
        + '<path class="fi-error-cabin" fill-rule="evenodd" d="M38,72 H112 a20,20 0 0 1 20,20 V146 a20,20 0 0 1 -20,20 H38 a20,20 0 0 1 -20,-20 V92 a20,20 0 0 1 20,-20 Z M36,90 h30 v32 h-30 Z M84,90 h30 v32 h-30 Z" />'
        + `${code}</g>`;
    if (!options.swing) return drawing;
    const delay = options.delay ? ` animation-delay: ${options.delay}s;` : '';
    return `<g class="fi-error-${options.swing}" style="transform-origin: ${x}px ${y}px;${delay}">${drawing}</g>`;
}
const cloud = (x: number, y: number, scale = 1, drift = false) =>
    `<g class="${drift ? 'fi-error-drift' : ''}"><path class="fi-error-cloud" transform="translate(${x} ${y}) scale(${scale})" d="M-34,10 a14,14 0 0 1 6,-26 a20,20 0 0 1 36,-8 a16,16 0 0 1 28,10 a12,12 0 0 1 4,24 Z" /></g>`;
const mountains = '<path class="fi-error-mountains" fill="url(#fi-error-ground)" d="M0,228 V196 L52,160 L92,184 L150,128 L214,190 L268,150 L318,178 L364,146 L400,166 V228 Z" />'
    + '<path class="fi-error-snow" d="M138,140 L150,128 L162,140 L156,138 L150,144 L144,138 Z M354,153 L364,146 L374,153 L369,152 L364,157 L359,152 Z" />';
const pylon = (x: number) => {
    const top = cableY(x);
    return `<path class="fi-error-pylon" d="M${x - 9},214 L${x - 2},${top + 4} M${x + 9},214 L${x + 2},${top + 4} M${x - 7},${top + 60} H${x + 7} M${x - 5},${top + 110} H${x + 5}" />`
        + `<path class="fi-error-pylon-arm" d="M${x - 12},${top + 4} H${x + 12}" />`;
};
const cable = (from = -10, to = W + 10, className = 'fi-error-cable') => `<path class="${className}" d="M${from},${cableY(from)} L${to},${cableY(to)}" />`;

/** Scenes, by status. */
const SCENES: Record<ErrorPageStatus, (code: string) => string> = {
    // Lost: the cable disappears into the clouds; the cabin wonders where to go.
    404: (code) => `<defs><linearGradient id="fi-error-cable-fade" x1="0" x2="1" y1="0" y2="0"><stop offset="0.55" class="fi-error-cable-stop" /><stop offset="0.85" class="fi-error-cable-stop" stop-opacity="0" /></linearGradient></defs>`
        + mountains + pylon(46) + `<path stroke="url(#fi-error-cable-fade)" class="fi-error-cable-faded" d="M-10,${cableY(-10)} L${W + 10},${cableY(W + 10)}" />`
        + cabin(205, cableY(205), { code, swing: 'slow' })
        + '<text x="250" y="22" class="fi-error-mark fi-error-bob">?</text><text x="266" y="36" class="fi-error-mark fi-error-mark-sm fi-error-bob" style="animation-delay: .6s">?</text>'
        + cloud(330, 40, 1.3, true) + cloud(372, 66, 1.1) + cloud(300, 74, 0.9, true) + cloud(60, 118, 0.7),
    // Blocked: a no-entry sign stops the cabin on the line.
    403: (code) => mountains + pylon(46) + pylon(316) + cable()
        + `<g class="fi-error-sign"><path class="fi-error-sign-post" d="M316,${cableY(316) - 2} V${cableY(316) - 22}" /><circle class="fi-error-sign-danger" cx="316" cy="${cableY(316) - 36}" r="17" /><rect x="306" y="${cableY(316) - 39}" width="20" height="6" rx="2" class="fi-error-sign-bar" /></g>`
        + `<path class="fi-error-stop-dash" d="M262,${cableY(262)} L300,${cableY(300)}" />`
        + cabin(190, cableY(190), { code, swing: 'shake' }) + cloud(98, 34, 0.8) + cloud(372, 112, 0.7, true),
    // Sign in first: a padlock on the line.
    401: (code) => mountains + pylon(46) + pylon(316) + cable()
        + `<g class="fi-error-sign"><path class="fi-error-sign-post" d="M316,${cableY(316) - 2} V${cableY(316) - 18}" /><path class="fi-error-lock-shackle" d="M307,${cableY(316) - 38} v-6 a9,9 0 0 1 18,0 v6" /><rect x="301" y="${cableY(316) - 40}" width="30" height="24" rx="5" class="fi-error-lock" /><circle cx="316" cy="${cableY(316) - 29}" r="3.5" class="fi-error-lock-hole" /></g>`
        + cabin(190, cableY(190), { code, swing: 'slow' }) + cloud(98, 34, 0.8) + cloud(372, 112, 0.7, true),
    // Expired: the cabin left the station without you.
    419: (code) => mountains + `<path class="fi-error-station" d="M8,${cableY(8) + 10} h70 v54 h-70 Z" /><path class="fi-error-station-roof" d="M2,${cableY(8) + 12} L43,${cableY(8) - 8} L84,${cableY(8) + 12}" />`
        + `<g class="fi-error-clock"><circle cx="43" cy="${cableY(8) + 36}" r="15" class="fi-error-clock-face" /><path class="fi-error-clock-hands fi-error-tick" style="transform-origin: 43px ${cableY(8) + 36}px" d="M43,${cableY(8) + 36} V${cableY(8) + 26}" /><path class="fi-error-clock-hands" d="M43,${cableY(8) + 36} H51" /></g>`
        + cable(78) + pylon(200)
        + `<path class="fi-error-motion" d="M280,${cableY(296) + 26} h-26 M284,${cableY(296) + 36} h-34 M280,${cableY(296) + 46} h-22" />`
        + `<g class="fi-error-leave">${cabin(312, cableY(312), { code, scale: 0.46 })}</g>` + cloud(150, 36, 0.8, true),
    // Rush hour: cabins queue on the line, one digit each.
    429: (code) => mountains + pylon(46) + pylon(356) + cable()
        + [...code.padEnd(3).slice(0, 3)].map((digit, index) => cabin(140 + index * 62, cableY(140 + index * 62), { code: digit.trim(), scale: 0.5, swing: 'bounce', delay: index * 0.18 })).join('')
        + cloud(96, 30, 0.7, true) + cloud(352, 104, 0.6),
    // Broken: the cable snapped and the cabin dangles from the loose end.
    500: (code) => mountains + pylon(46) + pylon(356)
        + `<path class="fi-error-cable" d="M-10,${cableY(-10)} L178,${cableY(178)} Q190,${cableY(190) - 1} 192,${cableY(190) + 12}" />`
        + `<path class="fi-error-cable" d="M${W + 10},${cableY(W + 10)} L236,${cableY(236)} Q224,${cableY(224) + 1} 222,${cableY(222) + 14}" />`
        + `<g class="fi-error-sparks"><path class="fi-error-spark" d="M207,${cableY(207) - 16} l4,8 l6,-3 l-3,8" /><path class="fi-error-spark fi-error-spark-alt" d="M199,${cableY(199) + 2} l-8,-4 M213,${cableY(213) + 4} l9,-2 M205,${cableY(205) - 4} l1,-9" /></g>`
        + cabin(192, cableY(190) + 12, { code, rotate: -14, swing: 'dangling' }) + cloud(110, 30, 0.7, true) + cloud(340, 110, 0.6),
    // Maintenance: the cabin is parked; cones and a wrench on site.
    503: (code) => mountains + pylon(46) + pylon(316) + cable()
        + cabin(190, cableY(190), { code })
        // Heroicons "wrench-screwdriver" (MIT).
        + `<g class="fi-error-wrench-ctn" style="transform-origin: 258px 92px"><g transform="translate(236 70) scale(1.8)"><path class="fi-error-tools" fill-rule="evenodd" d="M12 6.75a5.25 5.25 0 0 1 6.775-5.025.75.75 0 0 1 .313 1.248l-3.32 3.319c.063.475.276.934.641 1.299.365.365.824.578 1.3.64l3.318-3.319a.75.75 0 0 1 1.248.313 5.25 5.25 0 0 1-5.472 6.756c-1.018-.086-1.87.1-2.309.634L7.344 21.3A3.298 3.298 0 1 1 2.7 16.657l8.684-7.151c.533-.44.72-1.291.634-2.309A5.342 5.342 0 0 1 12 6.75ZM4.117 19.125a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75h-.008a.75.75 0 0 1-.75-.75v-.008Z" clip-rule="evenodd"/><path class="fi-error-tools" d="m10.076 8.64-2.201-2.2V4.874a.75.75 0 0 0-.364-.643l-3.75-2.25a.75.75 0 0 0-.916.113l-.75.75a.75.75 0 0 0-.113.916l2.25 3.75a.75.75 0 0 0 .643.364h1.564l2.062 2.062 1.575-1.297Z"/><path class="fi-error-tools" fill-rule="evenodd" d="m12.556 17.329 4.183 4.182a3.375 3.375 0 0 0 4.773-4.773l-3.306-3.305a6.803 6.803 0 0 1-1.53.043c-.394-.034-.682-.006-.867.042a.589.589 0 0 0-.167.063l-3.086 3.748Zm3.414-1.36a.75.75 0 0 1 1.06 0l1.875 1.876a.75.75 0 1 1-1.06 1.06L15.97 17.03a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/></g></g>`
        + '<path class="fi-error-barrier-leg" d="M168,212 L174,190 M216,212 L210,190" /><rect x="160" y="184" width="64" height="11" rx="2" class="fi-error-barrier" /><path class="fi-error-barrier-stripes" d="M170,195 l8,-11 M186,195 l8,-11 M202,195 l8,-11 M218,195 l6,-8" />'
        + [138, 246].map((x) => `<path class="fi-error-cone" d="M${x - 11},212 L${x - 3},180 H${x + 3} L${x + 11},212 Z" /><path class="fi-error-cone-stripe" d="M${x - 7},198 H${x + 7}" /><path class="fi-error-cone-base" d="M${x - 15},212 H${x + 15}" />`).join('')
        + cloud(96, 30, 0.7, true) + cloud(366, 106, 0.6),
};

/** The illustration of an error page. */
export function errorIllustration(status: number, label: string): string {
    return `<svg viewBox="0 0 ${W} 228" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label.replace(/[&<>"]/g, (character) => `&#${character.charCodeAt(0)};`)}" class="fi-error-illustration-svg"><defs><linearGradient id="fi-error-ground" x1="0" x2="0" y1="0" y2="1"><stop offset="0.45" class="fi-error-ground-stop" /><stop offset="1" class="fi-error-ground-stop" stop-opacity="0" /></linearGradient></defs>${SCENES[errorPageScene(status)](String(status))}</svg>`;
}

/** Styles of the error pages, on top of the panel's stylesheet. */
export const ERROR_PAGE_CSS = `
.fi-error-page { text-align: center; }
.fi-error-illustration { margin: -1rem auto 0; max-width: 24rem; }
.fi-error-illustration-svg { display: block; width: 100%; height: auto; overflow: visible; font-family: var(--font-family), ui-sans-serif, system-ui, sans-serif; }
.fi-error-page .fi-simple-header { margin-top: 1.5rem; }
.fi-error-page .fi-simple-header-subheading { max-width: 26rem; margin-inline: auto; }
.fi-error-badge-ctn { display: flex; justify-content: center; margin-top: 1.25rem; }
.fi-error-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; margin-top: 2rem; }
.fi-error-reference { margin-top: 1.5rem; font-size: 0.75rem; color: var(--gray-400); }
.fi-error-details { margin-top: 2rem; text-align: start; }
.fi-error-details summary { cursor: pointer; font-size: 0.875rem; font-weight: 500; color: var(--gray-500); }
.fi-error-details pre { margin-top: 0.75rem; max-height: 18rem; overflow: auto; padding: 0.75rem 1rem; border-radius: 0.5rem; background: var(--gray-50); color: var(--gray-700); font-family: var(--mono-font-family, ui-monospace), monospace; font-size: 0.75rem; line-height: 1.25rem; white-space: pre-wrap; word-break: break-word; }
.dark .fi-error-details pre { background: color-mix(in oklab, var(--gray-950) 60%, transparent); color: var(--gray-300); }

.fi-error-cabin { fill: var(--primary-600); }
.fi-error-wheel { fill: var(--primary-600); }
.fi-error-hanger { fill: none; stroke: var(--primary-600); stroke-width: 10; stroke-linecap: round; }
.fi-error-cabin-code { fill: #fff; font-size: 30px; font-weight: 700; letter-spacing: 0.02em; }
.fi-error-cable, .fi-error-cable-faded { fill: none; stroke: var(--gray-400); stroke-width: 3; stroke-linecap: round; }
.fi-error-cable-faded { stroke: url(#fi-error-cable-fade); }
.fi-error-cable-stop { stop-color: var(--gray-400); }
.fi-error-mountains { fill: url(#fi-error-ground); }
.fi-error-ground-stop { stop-color: var(--gray-100); }
.fi-error-snow { fill: #fff; }
.fi-error-cloud { fill: #fff; stroke: var(--gray-200); stroke-width: 1.5; }
.fi-error-pylon, .fi-error-pylon-arm { fill: none; stroke: var(--gray-300); stroke-width: 3; stroke-linecap: round; }
.fi-error-pylon-arm { stroke-width: 4; }
.fi-error-mark { fill: var(--primary-500); font-size: 26px; font-weight: 700; }
.fi-error-mark-sm { font-size: 18px; opacity: 0.7; }
.fi-error-sign-post { stroke: var(--gray-400); stroke-width: 3; }
.fi-error-sign-danger { fill: var(--danger-500); }
.fi-error-sign-bar { fill: #fff; }
.fi-error-stop-dash { fill: none; stroke: var(--danger-500); stroke-width: 3; stroke-dasharray: 5 5; stroke-linecap: round; }
.fi-error-lock { fill: var(--warning-500); }
.fi-error-lock-shackle { fill: none; stroke: var(--gray-400); stroke-width: 4; stroke-linecap: round; }
.fi-error-lock-hole { fill: #fff; }
.fi-error-station { fill: var(--gray-200); }
.fi-error-station-roof { fill: none; stroke: var(--gray-400); stroke-width: 4; stroke-linejoin: round; stroke-linecap: round; }
.fi-error-clock-face { fill: #fff; stroke: var(--gray-400); stroke-width: 2.5; }
.fi-error-clock-hands { fill: none; stroke: var(--primary-600); stroke-width: 2.5; stroke-linecap: round; }
.fi-error-motion { fill: none; stroke: var(--gray-300); stroke-width: 3; stroke-linecap: round; }
.fi-error-spark { fill: none; stroke: var(--warning-500); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.fi-error-spark-alt { stroke: var(--danger-500); }
.fi-error-cone { fill: var(--warning-500); }
.fi-error-cone-stripe { stroke: #fff; stroke-width: 4; }
.fi-error-cone-base { stroke: var(--gray-500); stroke-width: 4; stroke-linecap: round; }
.fi-error-tools { fill: var(--gray-400); }
.fi-error-barrier { fill: var(--warning-500); }
.fi-error-barrier-stripes { stroke: #fff; stroke-width: 5; }
.fi-error-barrier-leg { stroke: var(--gray-500); stroke-width: 3; stroke-linecap: round; }

.dark .fi-error-cabin, .dark .fi-error-wheel { fill: var(--primary-500); }
.dark .fi-error-hanger { stroke: var(--primary-500); }
.dark .fi-error-cable, .dark .fi-error-cable-faded { stroke: var(--gray-500); }
.dark .fi-error-cable-faded { stroke: url(#fi-error-cable-fade); }
.dark .fi-error-cable-stop { stop-color: var(--gray-500); }
.dark .fi-error-ground-stop { stop-color: var(--gray-800); }
.dark .fi-error-snow { fill: var(--gray-600); }
.dark .fi-error-cloud { fill: var(--gray-900); stroke: var(--gray-700); }
.dark .fi-error-pylon, .dark .fi-error-pylon-arm { stroke: var(--gray-600); }
.dark .fi-error-station { fill: var(--gray-800); }
.dark .fi-error-clock-face { fill: var(--gray-900); stroke: var(--gray-500); }
.dark .fi-error-motion { stroke: var(--gray-700); }

.fi-error-slow, .fi-error-dangling, .fi-error-shake, .fi-error-bounce, .fi-error-tick, .fi-error-wrench-ctn { transform-box: view-box; }
.fi-error-slow { animation: fi-error-swing 4s ease-in-out infinite; }
.fi-error-dangling { animation: fi-error-dangle 2.6s ease-in-out infinite; }
.fi-error-shake { animation: fi-error-shake 3.2s ease-in-out infinite; }
.fi-error-bounce { animation: fi-error-bounce 1.6s ease-in-out infinite; }
.fi-error-bob { animation: fi-error-bob 2.4s ease-in-out infinite; }
.fi-error-drift { animation: fi-error-drift 9s ease-in-out infinite alternate; }
.fi-error-sparks { animation: fi-error-flicker 1.1s steps(2, jump-none) infinite; }
.fi-error-tick { animation: fi-error-tick 4s steps(8) infinite; }
.fi-error-leave { animation: fi-error-leave 5s ease-in-out infinite; }
.fi-error-wrench-ctn { animation: fi-error-wrench 2.8s ease-in-out infinite; }
@keyframes fi-error-swing { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
@keyframes fi-error-dangle { 0%, 100% { transform: rotate(-6deg); } 50% { transform: rotate(5deg); } }
@keyframes fi-error-shake { 0%, 70%, 100% { transform: translateX(0); } 74% { transform: translateX(3px) rotate(1.5deg); } 78% { transform: translateX(-3px) rotate(-1.5deg); } 82% { transform: translateX(2px); } 86% { transform: translateX(0); } }
@keyframes fi-error-bounce { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(3deg); } }
@keyframes fi-error-bob { 0%, 100% { transform: translateY(0); opacity: 1; } 50% { transform: translateY(-5px); opacity: 0.6; } }
@keyframes fi-error-drift { from { transform: translateX(-6px); } to { transform: translateX(8px); } }
@keyframes fi-error-flicker { 0% { opacity: 1; } 100% { opacity: 0.2; } }
@keyframes fi-error-tick { to { transform: rotate(360deg); } }
@keyframes fi-error-leave { 0%, 20% { transform: translate(0, 0); opacity: 1; } 80%, 100% { transform: translate(34px, -4px); opacity: 0.35; } }
@keyframes fi-error-wrench { 0%, 100% { transform: rotate(-12deg); } 50% { transform: rotate(18deg); } }
@media (prefers-reduced-motion: reduce) { .fi-error-illustration * { animation: none !important; } }
`;
