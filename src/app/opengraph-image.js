import { ImageResponse } from 'next/og';

export const alt = 'Staff2 — All-in-One Team Operations Platform';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #4c6ef5 0%, #4338ca 55%, #6d28d9 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '28px' }}>
          <div
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '22px',
              background: 'rgba(255,255,255,0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '48px',
              fontWeight: 800,
            }}
          >
            S2
          </div>
          <div style={{ fontSize: '64px', fontWeight: 800, letterSpacing: '-1px' }}>Staff2</div>
        </div>
        <div style={{ fontSize: '58px', fontWeight: 800, lineHeight: 1.1, maxWidth: '900px', letterSpacing: '-1.5px' }}>
          All-in-one team operations platform
        </div>
        <div style={{ fontSize: '30px', marginTop: '28px', color: 'rgba(255,255,255,0.85)', maxWidth: '940px' }}>
          Scheduling · Time tracking · Costs · Stock &amp; recipes · Checklists · Knowledge base
        </div>
        <div style={{ display: 'flex', marginTop: '44px', fontSize: '26px', color: 'rgba(255,255,255,0.9)' }}>
          staff2.app · Free for up to 4 employees
        </div>
      </div>
    ),
    size
  );
}
