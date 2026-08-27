'use client';
import { useState, useEffect } from 'react';
import { Lightbulb, X, HelpCircle } from 'lucide-react';
import { cn } from '@/utils/helpers';
import { useAuth } from '@/contexts/AuthContext';
import { getPageIntro } from '@/lib/help-content';

/**
 * Dismissible "what this page is for" banner shown under the page header.
 * Role-aware copy comes from help-content. Dismissal is remembered per user +
 * page in localStorage; a small "?" chip lets the user bring it back.
 *
 * Usage: <PageIntro page="dashboard" />
 * You can override copy with the `intro` prop for one-off pages.
 */
export default function PageIntro({ page, intro: introOverride, className }) {
  const { role, user } = useAuth();
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash before we read storage
  const [mounted, setMounted] = useState(false);

  const intro = introOverride || getPageIntro(page, { role });
  const storageKey = `pageintro:${page}:${user?.uid || 'anon'}`;

  useEffect(() => {
    setMounted(true);
    try { setDismissed(localStorage.getItem(storageKey) === '1'); }
    catch { setDismissed(false); }
  }, [storageKey]);

  if (!intro || !mounted) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(storageKey, '1'); } catch {}
  };
  const reopen = () => {
    setDismissed(false);
    try { localStorage.removeItem(storageKey); } catch {}
  };

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={reopen}
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium text-surface-400',
          'hover:text-brand-600 transition-colors -mt-2',
          className
        )}
      >
        <HelpCircle className="w-3.5 h-3.5" /> How this page works
      </button>
    );
  }

  return (
    <div
      className={cn(
        'relative rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/80 to-brand-50/30 p-4 sm:p-5 animate-in',
        className
      )}
    >
      <div className="flex gap-3.5">
        <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
          <Lightbulb className="w-5 h-5 text-brand-600" />
        </div>
        <div className="min-w-0 flex-1 pr-6">
          <p className="text-sm font-display font-semibold text-surface-900">{intro.title}</p>
          {intro.body && <p className="text-sm text-surface-600 mt-0.5">{intro.body}</p>}
          {intro.bullets?.length > 0 && (
            <ul className="mt-2.5 space-y-1.5">
              {intro.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-surface-600">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:bg-white/70 hover:text-surface-600 transition-all"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
