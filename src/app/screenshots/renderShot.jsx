import { ImageResponse } from 'next/og';

// Store / install-dialog screenshots. The manifest wants at least one narrow
// and one wide screenshot; these are branded feature cards that summarise what
// Staff2 does without shipping heavy real captures into the repo.

const FEATURES = [
  'Shift scheduling & rotas',
  'Clock in / clock out time tracking',
  'Live labour-cost tracking',
  'Stock counts & recipe costing',
  'Assigned checklists',
  'Team knowledge base',
];

export function renderShot({ width, height, wide }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: wide ? '96px 120px' : '80px 64px',
          background:
            'linear-gradient(135deg, #4c6ef5 0%, #4338ca 55%, #6d28d9 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '36px' }}>
          <div
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '20px',
              background: 'rgba(255,255,255,0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="46" height="46" viewBox="0 0 64 64">
              <circle cx="22" cy="24" r="6.5" fill="#fff" />
              <path d="M10 48a12 12 0 0 1 24 0z" fill="#fff" />
              <circle cx="42" cy="24" r="6.5" fill="#fff" />
              <path d="M30 48a12 12 0 0 1 24 0z" fill="#fff" />
            </svg>
          </div>
          <div style={{ fontSize: '52px', fontWeight: 800, letterSpacing: '-1px' }}>Staff2</div>
        </div>

        <div
          style={{
            fontSize: wide ? '60px' : '48px',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-1.5px',
            marginBottom: '44px',
          }}
        >
          Run your whole team in one app
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {FEATURES.map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: wide ? '30px' : '26px' }}>
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.9)',
                }}
              />
              <div style={{ color: 'rgba(255,255,255,0.92)' }}>{f}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', marginTop: '52px', fontSize: '24px', color: 'rgba(255,255,255,0.85)' }}>
          staff2.app · Free for up to 4 employees
        </div>
      </div>
    ),
    { width, height }
  );
}
