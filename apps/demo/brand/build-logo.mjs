// Génère le logo Navette (mot-symbole et pictogramme) en SVG. Usage : node build-logo.mjs
// Dessin : une cabine de téléphérique — la navette qui fait l'aller-retour — suspendue à son câble, suivie du nom
// en lettres monolinéaires. Tout est tracé en géométrie pure (cercles de rayon 50, trait de 22) : aucune police n'est requise.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = (name) => fileURLToPath(new URL(`../public/images/logo/${name}`, import.meta.url));

/** Cabine pleine à deux fenêtres (évidées), bras de suspension, pince, et câble légèrement incliné. */
const cabin = 'M38,72 H112 a20,20 0 0 1 20,20 V146 a20,20 0 0 1 -20,20 H38 a20,20 0 0 1 -20,-20 V92 a20,20 0 0 1 20,-20 Z M36,90 h30 v32 h-30 Z M84,90 h30 v32 h-30 Z';
const mark = (cable, color) => `
  <path fill="none" stroke="${cable}" stroke-width="8" stroke-linecap="round" d="M-14,38 L164,16"/>
  <path fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" d="M75,30 V72"/>
  <circle fill="${color}" cx="75" cy="27" r="9"/>
  <path fill="${color}" fill-rule="evenodd" d="${cabin}"/>`;

/** « navette » : n, a, v, e, t, t, e — hauteur d'x de 100 (y 60 → 160), ascendante du t à y 20. */
const letters = [
    'M210,60 V160 M210,110 a50,50 0 0 1 100,0 V160',                 // n
    'M450,110 a50,50 0 1 0 -100,0 a50,50 0 1 0 100,0 M450,60 V160',  // a
    'M490,60 L540,160 L590,60',                                       // v
    'M630,110 H730 A50,50 0 1 0 715.4,145.4',                         // e
    'M790,20 V130 a30,30 0 0 0 30,30 h10 M765,60 H825',               // t
    'M875,20 V130 a30,30 0 0 0 30,30 h10 M850,60 H910',               // t
    'M945,110 H1045 A50,50 0 1 0 1030.4,145.4',                       // e
];
const wordmark = (ink, accent) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 0 1090 182" role="img" aria-label="Navette">
  <title>Navette</title>${mark(ink, accent)}
  <path fill="none" stroke="${ink}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" d="${letters.join(' ')}"/>
</svg>
`;
/** Pictogramme seul, sur fond plein arrondi : icône d'onglet. */
const icon = (background, color) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="Navette">
  <title>Navette</title>
  <rect width="256" height="256" rx="56" fill="${background}"/>
  <g transform="translate(26 6) scale(1.36)">${mark(color, color)}
  </g>
</svg>
`;

fs.mkdirSync(fileURLToPath(new URL('../public/images/logo/', import.meta.url)), { recursive: true });
fs.writeFileSync(out('navette-light.svg'), wordmark('#18181b', '#2563eb')); // thème clair : encre gray-950, cabine blue-600
fs.writeFileSync(out('navette-dark.svg'), wordmark('#ffffff', '#3b82f6'));  // thème sombre : encre blanche, cabine blue-500
fs.writeFileSync(out('navette-icon.svg'), icon('#2563eb', '#ffffff'));
console.log('logos écrits');
