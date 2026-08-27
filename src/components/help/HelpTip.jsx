'use client';
import { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/utils/helpers';
import { HELP_TIPS } from '@/lib/help-content';

/**
 * Inline info button that reveals a short explanation in a popover.
 * Usage: <HelpTip tip="pay-type" />  or  <HelpTip text="Custom copy" />
 *
 * Sits next to section titles or field labels. Accessible: it's a real button
 * with an aria-label, and closes on outside-click or Escape (mirrors the
 * dropdown pattern used in TopBar).
 */
export default function HelpTip({ tip, text, label, className, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const content = text || HELP_TIPS[tip] || '';

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!content) return null;

  return (
    <span ref={ref} className={cn('relative inline-flex align-middle', className)}>
      <button
        type="button"
        aria-label={label || 'More information'}
        aria-expanded={open}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        className={cn(
          'inline-flex items-center justify-center w-5 h-5 rounded-full text-surface-400',
          'hover:text-brand-600 hover:bg-brand-50 active:bg-brand-100 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-brand-500/30',
          open && 'text-brand-600 bg-brand-50'
        )}
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      {open && (
        <span
          role="tooltip"
          className={cn(
            'help-pop animate-in',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
