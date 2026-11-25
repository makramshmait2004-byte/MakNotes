// Renders the PWA icons from inline SVG with headless Chromium (Playwright).
// Usage: node scripts/generate-icons.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = new URL('../public/icons/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

// "any" icon: rounded tile. Maskable: full-bleed background, mark inside the 80% safe zone.
const mark = (scale) => `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)"><path d="M150 360V152l106 120 106-120v208" fill="none" stroke="#b08d57" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/></g>`;
const anySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#141416"/>${mark(1)}</svg>`;
const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#141416"/>${mark(0.78)}</svg>`;

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const page = await browser.newPage();
async function render(svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: out + file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await render(anySvg, 192, 'icon-192.png');
await render(anySvg, 512, 'icon-512.png');
await render(maskSvg, 192, 'maskable-192.png');
await render(maskSvg, 512, 'maskable-512.png');
await render(maskSvg, 180, 'apple-touch-icon.png');
await browser.close();
console.log('icons written to', out);
