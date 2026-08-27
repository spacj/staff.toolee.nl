'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Check, ArrowRight, X, Rocket } from 'lucide-react';
import { cn } from '@/utils/helpers';
import { useAuth } from '@/contexts/AuthContext';
import { getManagerOnboardingSteps, getWorkerOnboardingSteps } from '@/lib/help-content';

/**
 * Role-aware "Getting started" card for the dashboard.
 *
 * Progress is derived entirely from live data passed in `data` — there are no
 * stored completion flags, so the checklist can never disagree with reality.
 * The whole card is dismissible (remembered per user), and it hides itself once
 * every step is done.
 *
 * Usage (manager):
 *   <OnboardingChecklist variant="manager"
 *     data={{ shops, workers, shifts, attendance, isPaidTier, hasBilling }} />
 */
export default function OnboardingChecklist({ variant = 'manager', data = {} }) {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);

  const storageKey = `onboarding-dismissed:${user?.uid || 'anon'}`;

  useEffect(() => {
    setMounted(true);
    try { setDismissed(localStorage.getItem(storageKey) === '1'); }
    catch { setDismissed(false); }
  }, [storageKey]);

  const steps = variant === 'worker'
    ? getWorkerOnboardingSteps(data)
    : getManagerOnboardingSteps(data);

  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = doneCount === total;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  if (!mounted || dismissed || allDone || total === 0) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(storageKey, '1'); } catch {}
  };

  // The next thing to do — highlighted as the primary CTA.
  const nextStep = steps.find((s) => !s.done);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-card animate-in">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-400 via-brand-500 to-purple-500" />
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm flex-shrink-0">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-surface-900">Getting started</h2>
              <p className="text-xs text-surface-500 mt-0.5">
                {doneCount} of {total} done · finish setup to get the most out of StaffHub
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss getting started"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-all flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-2 rounded-full bg-surface-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Steps */}
        <ul className="mt-4 space-y-1.5">
          {steps.map((s) => {
            const isNext = s === nextStep;
            return (
              <li key={s.id}>
                <Link
                  href={s.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors group',
                    s.done ? 'opacity-60' : isNext ? 'bg-brand-50/70 hover:bg-brand-50' : 'hover:bg-surface-50'
                  )}
                >
                  <span
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border',
                      s.done
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-surface-300 text-transparent group-hover:border-brand-400'
                    )}
                  >
                    <Check className="w-3 h-3" />
                  </span>
                  <span className={cn('text-sm flex-1', s.done ? 'text-surface-500 line-through' : 'text-surface-700 font-medium')}>
                    {s.label}
                  </span>
                  {!s.done && (
                    <span className={cn(
                      'text-xs font-medium inline-flex items-center gap-1 flex-shrink-0',
                      isNext ? 'text-brand-600' : 'text-surface-400 group-hover:text-brand-600'
                    )}>
                      {s.cta} <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
