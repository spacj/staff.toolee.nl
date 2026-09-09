import { ImageResponse } from 'next/og';

// Shared renderer for the PWA PNG icons. App stores and the install prompt
// require raster PNGs (192 + 512, plus a maskable variant); the SVGs in
// /public are kept as extra entries but can't satisfy those checks.

const GRADIENT =
  "<linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
  "<stop offset='0' stop-color='#4c6ef5'/>" +
  "<stop offset='0.55' stop-color='#4338ca'/>" +
  "<stop offset='1' stop-color='#6d28d9'/>" +
  '</linearGradient>';

// The two-staff mark, authored on a 64x64 grid like the source favicon.
const MARK =
  "<g fill='#ffffff'>" +
  "<circle cx='22' cy='24' r='6.5'/>" +
  "<path d='M10 48a12 12 0 0 1 24 0z'/>" +
  "<circle cx='42' cy='24' r='6.5'/>" +
  "<path d='M30 48a12 12 0 0 1 24 0z'/>" +
  '</g>';

function markSvg({ maskable }) {
  // "any" icons get rounded corners and a tighter mark; "maskable" icons are
  // full-bleed with a generous safe-zone so the OS mask never clips the mark.
  const rx = maskable ? 0 : 112;
  const transform = maskable
    ? 'translate(128 128) scale(4)'
    : 'translate(96 96) scale(5)';
  return (
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>" +
    `<defs>${GRADIENT}</defs>` +
    `<rect width='512' height='512' rx='${rx}' fill='url(#g)'/>` +
    `<g transform='${transform}'>${MARK}</g>` +
    '</svg>'
  );
}

export function renderIcon({ size, maskable = false }) {
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(
    markSvg({ maskable })
  ).toString('base64')}`;

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img width={size} height={size} src={dataUri} alt="" />
      </div>
    ),
    { width: size, height: size }
  );
}
