import sharp from 'sharp';

const BG_TOP = '#14B07C';
const BG_BOTTOM = '#0A8A5E';
const FG = '#FFFFFF';

const mark = ({ fg = FG, hole = BG_BOTTOM } = {}) => `
  <path d="M 33 64 C 33 48, 66 62, 66 46" stroke="${fg}" stroke-width="6.5" stroke-linecap="round" fill="none"/>
  <circle cx="33" cy="72" r="7" fill="none" stroke="${fg}" stroke-width="5.5"/>
  <path d="M 66 14 C 56.6 14 50 21 50 29.6 C 50 40.6 66 52 66 52 C 66 52 82 40.6 82 29.6 C 82 21 75.4 14 66 14 Z" fill="${fg}"/>
  <circle cx="66" cy="29.5" r="5.8" fill="${hole}"/>`;

const gradient = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BG_TOP}"/><stop offset="1" stop-color="${BG_BOTTOM}"/></linearGradient></defs>`;

const svg = (size, inner, { bg = false, scale = 1, dy = 0 } = {}) => {
  const offset = (100 - 100 * scale) / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    ${gradient}
    ${bg ? `<rect width="100" height="100" fill="url(#g)"/>` : ''}
    <g transform="translate(${offset} ${offset + dy}) scale(${scale})">${inner}</g>
  </svg>`);
};

const out = (name) => `assets/images/${name}`;

await sharp(svg(1024, mark(), { bg: true, scale: 0.8, dy: 3 })).png().toFile(out('icon.png'));
await sharp(svg(1024, mark(), { scale: 0.56 })).png().toFile(out('android-icon-foreground.png'));
await sharp(svg(1024, '', { bg: true })).png().toFile(out('android-icon-background.png'));
await sharp(svg(1024, mark({ hole: '#00000000' }), { scale: 0.56 })).png().toFile(out('android-icon-monochrome.png'));
await sharp(svg(512, mark({ fg: BG_BOTTOM, hole: '#FFFFFF' }), { scale: 0.92 })).png().toFile(out('splash-icon.png'));
await sharp(svg(96, mark(), { bg: true, scale: 0.86 })).png().toFile(out('favicon.png'));
await sharp(svg(512, mark(), { bg: true, scale: 0.8 })).png().toFile('assets/images/store-icon-512.png');
console.log('icons written');
await sharp(svg(96, mark({ hole: '#00000000' }), { scale: 0.9 })).png().toFile(out('notification-icon.png'));

const glyphs = {
  start: `<path d="M 40 30.5 C 40 27.8 42.9 26.1 45.2 27.5 L 70.6 42.9 C 72.9 44.3 72.9 47.7 70.6 49.1 L 45.2 64.5 C 42.9 65.9 40 64.2 40 61.5 Z" transform="translate(-4 4)" fill="#0E9F6E"/>`,
  stop: `<rect x="35" y="35" width="30" height="30" rx="5" fill="#E5484D"/>`,
};
for (const [name, inner] of Object.entries(glyphs)) {
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="432" height="432" viewBox="0 0 100 100">${inner}</svg>`)).png().toFile(out(`shortcut-${name}.png`));
}

await sharp(
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="660" height="168" viewBox="0 0 220 56">
    <rect width="220" height="56" rx="28" fill="#FFFFFF"/>
    <circle cx="34" cy="28" r="22" fill="#0E9F6E"/>
    <path d="M 29 19.5 C 29 18.3 30.3 17.6 31.3 18.2 L 42.6 25.1 C 43.6 25.7 43.6 27.2 42.6 27.8 L 31.3 34.7 C 30.3 35.3 29 34.6 29 33.4 Z" transform="translate(0 1)" fill="#FFFFFF"/>
    <text x="68" y="26" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="600" font-size="16" fill="#0F1216">Fahrt starten</text>
    <text x="68" y="43" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="500" font-size="13" fill="#5B6370">OpenFahrtenbuch</text>
  </svg>`),
)
  .png()
  .toFile(out('widget-preview.png'));
