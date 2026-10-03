// Génère l'icône de l'application (robinet et goutte d'eau, fond indigo) et l'écran de démarrage.
// Sorties : public/favicon.png (navigateur) et assets/*.png, sources de `capacitor-assets generate --android`.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const BG = '#3a3fae';
const BG_DARK = '#0f171d';
const PNG = { compressionLevel: 9 };

/** Motif centré sur (0,0), dans un cercle de rayon ~440 : tuyau coudé en bec, volant, goutte. */
function motif(fg = '#ffffff') {
  return `<g transform="translate(80 30)" fill="${fg}">
    <path d="M-360,-250 H60 A100,100 0 0 1 160,-150 V-40 H60 V-150 H-360 Z"/>
    <rect x="40" y="-62" width="140" height="34" rx="8"/>
    <rect x="-150" y="-330" width="56" height="90"/>
    <rect x="-232" y="-370" width="220" height="52" rx="26"/>
    <path d="M110,30 C110,30 20,140 20,210 A90,90 0 0 0 200,210 C200,140 110,30 110,30 Z"/>
  </g>`;
}

/** SVG carré de `size` px : fond éventuel + motif réduit à `scale` (part du côté occupée par 800 unités du motif). */
function svg(size, scale, bg) {
  const k = (size * scale) / 800;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}
    <g transform="translate(${size / 2} ${size / 2}) scale(${k})">${motif()}</g></svg>`);
}
const png = (size, scale, bg) => sharp(svg(size, scale, bg)).png(PNG);

async function main() {
  const at = (rel) => fileURLToPath(new URL(rel, import.meta.url));
  mkdirSync(at('../public/'), { recursive: true });
  mkdirSync(at('../assets/'), { recursive: true });

  await png(192, 0.7, BG).toFile(at('../public/favicon.png'));
  await png(512, 0.7, BG).toFile(at('../public/icon-512.png'));

  await png(1024, 0.7, BG).toFile(at('../assets/icon-only.png')); // icône classique (anciens Android)
  await png(1024, 0.54, null).toFile(at('../assets/icon-foreground.png')); // icône adaptative : zone sûre ~66 %
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG } }).png(PNG).toFile(at('../assets/icon-background.png'));
  await png(2732, 0.22, BG).toFile(at('../assets/splash.png'));
  await png(2732, 0.22, BG_DARK).toFile(at('../assets/splash-dark.png'));
  console.log('Icônes générées : public/favicon.png, public/icon-512.png, assets/*.png');
}

main();
