import { cn } from '@/utils/helpers';

/**
 * Staff2 brand logo — a gradient "S2" mark plus the wordmark, where the "2"
 * carries the brand accent. Reused across the app sidebar, landing nav and
 * auth screens so the identity stays consistent.
 *
 * Props:
 *  - theme: 'dark' (light text, for dark backgrounds) | 'light' (default)
 *  - size:  'sm' | 'md' (default) | 'lg'
 *  - subtitle: small line under the wordmark (e.g. 'staff2.app'); pass null to hide
 *  - markOnly: render just the badge (no wordmark)
 */
export default function Logo({ theme = 'light', size = 'md', subtitle = 'staff2.app', markOnly = false, className }) {
  const isDark = theme === 'dark';
  const S = {
    sm: { box: 'w-8 h-8 rounded-lg', svg: 'w-4 h-4', word: 'text-base', sub: 'text-[9px]' },
    md: { box: 'w-9 h-9 rounded-xl', svg: 'w-[18px] h-[18px]', word: 'text-lg', sub: 'text-[10px]' },
    lg: { box: 'w-12 h-12 rounded-2xl', svg: 'w-6 h-6', word: 'text-2xl', sub: 'text-xs' },
  }[size] || {};

  const Mark = (
    <span
      className={cn(
        'relative flex items-center justify-center flex-shrink-0 overflow-hidden shadow-lg',
        'bg-gradient-to-br from-brand-400 via-brand-500 to-purple-500 shadow-brand-500/30',
        S.box
      )}
      aria-hidden="true"
    >
      {/* soft top highlight for depth */}
      <span className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
      {/* team mark — two staff figures */}
      <svg viewBox="0 0 64 64" fill="#fff" className={cn('relative', S.svg)}>
        <circle cx="22" cy="24" r="6.5" />
        <path d="M10 48a12 12 0 0 1 24 0z" />
        <circle cx="42" cy="24" r="6.5" />
        <path d="M30 48a12 12 0 0 1 24 0z" />
      </svg>
    </span>
  );

  if (markOnly) return <span className={className}>{Mark}</span>;

  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      {Mark}
      <span className="flex flex-col leading-none">
        <span className={cn('font-display font-bold tracking-tight leading-none', S.word, isDark ? 'text-white' : 'text-slate-900')}>
          Staff<span className={isDark ? 'text-brand-400' : 'text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-purple-500'}>2</span>
        </span>
        {subtitle && (
          <span className={cn('font-medium tracking-wide mt-0.5', S.sub, isDark ? 'text-white/40' : 'text-slate-400')}>
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}
