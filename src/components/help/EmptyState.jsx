'use client';
import Link from 'next/link';
import { cn } from '@/utils/helpers';

/**
 * Consistent empty state: icon + title + description + optional CTA.
 * Replaces ad-hoc "No X yet" strings across the app.
 *
 * Usage:
 *   <EmptyState icon={Users} title="No staff yet"
 *     description="Add your first team member to get started."
 *     actionLabel="Add worker" onAction={openForm} />
 *
 *   <EmptyState icon={Calendar} title="No shifts" href="/shifts" actionLabel="Create a template" />
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  href,
  secondary,
  className,
  compact = false,
}) {
  return (
    <div className={cn('card text-center flex flex-col items-center', compact ? 'p-8' : 'p-10 sm:p-12', className)}>
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-surface-400" />
        </div>
      )}
      {title && <p className="text-base font-display font-semibold text-surface-800">{title}</p>}
      {description && <p className="text-sm text-surface-500 mt-1.5 max-w-sm">{description}</p>}
      {actionLabel && (href || onAction) && (
        <div className="mt-5 flex flex-col sm:flex-row items-center gap-2.5">
          {href ? (
            <Link href={href} className="btn-primary">{actionLabel}</Link>
          ) : (
            <button type="button" onClick={onAction} className="btn-primary">{actionLabel}</button>
          )}
          {secondary}
        </div>
      )}
    </div>
  );
}
