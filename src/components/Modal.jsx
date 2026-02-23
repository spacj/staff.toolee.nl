'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils/helpers';

export default function Modal({ open, onClose, title, children, size = 'md', className }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const sizes = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl', full: 'sm:max-w-[90vw]' };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-surface-900/40 backdrop-blur-sm" onClick={onClose}
        style={{ animation: 'fadeIn 0.2s ease-out' }} />
      <div className="fixed inset-0 z-[61] flex items-end sm:items-center justify-center sm:p-4 pointer-events-none">
        <div ref={panelRef}
          className={cn(
            'relative bg-white shadow-2xl w-full flex flex-col pointer-events-auto',
            'border border-surface-200/50',
            'rounded-t-2xl sm:rounded-2xl max-h-[92vh] sm:max-h-[90vh]',
            sizes[size], className
          )}
          style={{ animation: 'slideInFromBottom 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
          onClick={(e) => e.stopPropagation()}>
          {/* Mobile drag handle */}
          <div className="sm:hidden flex justify-center pt-2 pb-0 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-surface-300" />
          </div>
          {title && (
            <div className="flex items-center justify-between px-5 sm:px-6 py-3 sm:py-4 border-b border-surface-100 flex-shrink-0">
              <h2 className="text-base sm:text-lg font-display font-bold text-surface-900">{title}</h2>
              <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-all">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 sm:py-5">{children}</div>
        </div>
      </div>
    </>
  );
}
