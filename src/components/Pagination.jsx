'use client';
import { cn } from '@/utils/helpers';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, totalPages, onPageChange, totalItems, pageSize, className }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className={cn('flex items-center justify-between gap-4 pt-4', className)}>
      <p className="text-xs text-surface-400">
        {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, totalItems)} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {start > 1 && <span className="px-1 text-xs text-surface-400">...</span>}
        {pages.map(p => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={cn(
              'w-8 h-8 rounded-lg text-xs font-medium transition-colors',
              p === page ? 'bg-brand-500 text-white' : 'text-surface-600 hover:bg-surface-100'
            )}
          >
            {p}
          </button>
        ))}
        {end < totalPages && <span className="px-1 text-xs text-surface-400">...</span>}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
