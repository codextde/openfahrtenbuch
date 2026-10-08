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
