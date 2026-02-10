'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils/helpers';

export default function Modal({ open, onClose, title, children, size = 'md', className }) {
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

  const sizes = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
    full: 'sm:max-w-[90vw]',
  };

  return (
    <>
      {/* Backdrop — separate from modal so z-index doesn't conflict */}
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />

      {/* Modal panel */}
      <div className="fixed inset-0 z-[51] flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            'relative bg-white rounded-2xl shadow-xl w-full max-h-[90vh] flex flex-col pointer-events-auto',
            sizes[size],
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100 flex-shrink-0">
              <h2 className="text-lg font-display font-semibold text-surface-900">{title}</h2>
              <button onClick={onClose} className="btn-icon -mr-2">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
