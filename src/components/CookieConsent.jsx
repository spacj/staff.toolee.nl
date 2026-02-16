'use client';
import { useState, useEffect } from 'react';
import { Cookie, X, Shield } from 'lucide-react';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('staffhub_cookie_consent');
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = (level) => {
    localStorage.setItem('staffhub_cookie_consent', JSON.stringify({ level, date: new Date().toISOString() }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-2xl animate-in slide-in-from-bottom-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-surface-200 overflow-hidden">
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Cookie className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-display font-bold text-surface-900">We use cookies</h3>
                <p className="text-sm text-surface-500 mt-1">
                  StaffHub uses essential cookies for authentication and app functionality. 
                  We also use analytics cookies to improve your experience.
                </p>

                {showDetails && (
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="p-3 bg-surface-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-semibold text-surface-700">Essential Cookies</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5 font-medium">Always on</span>
                      </div>
                      <p className="text-xs text-surface-500">Required for login, session management, and core functionality. Cannot be disabled.</p>
                    </div>
                    <div className="p-3 bg-surface-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <Cookie className="w-3.5 h-3.5 text-blue-600" />
                        <span className="font-semibold text-surface-700">Analytics Cookies</span>
                        <span className="text-[10px] bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 font-medium">Optional</span>
                      </div>
                      <p className="text-xs text-surface-500">Help us understand how you use StaffHub so we can improve the product. Anonymous usage data only.</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 mt-4">
                  <button onClick={() => accept('all')} className="btn-primary !py-2 !px-5 !text-sm">Accept All</button>
                  <button onClick={() => accept('essential')} className="btn-secondary !py-2 !px-5 !text-sm">Essential Only</button>
                  <button onClick={() => setShowDetails(!showDetails)} className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                    {showDetails ? 'Hide details' : 'Cookie details'}
                  </button>
                </div>
              </div>
              <button onClick={() => setVisible(false)} className="btn-icon !w-8 !h-8 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
