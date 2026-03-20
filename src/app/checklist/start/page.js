'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { cn } from '@/utils/helpers';
import { getChecklistTemplate } from '@/lib/firestore';
import {
  ClipboardCheck, User, Loader2, AlertCircle, QrCode, Shield,
  ArrowRight, MapPin,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

function PublicScanContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const templateId = searchParams.get('t');

  useEffect(() => {
    if (!templateId) {
      setError('Invalid QR code. Please scan again.');
      setLoading(false);
      return;
    }
    loadTemplate();
  }, []);

  async function loadTemplate() {
    setLoading(true);
    try {
      const t = await getChecklistTemplate(templateId);
      if (!t) { setError('Checklist not found.'); return; }
      if (!t.active) { setError('This checklist is currently paused.'); return; }
      if (t.scope !== 'public') { setError('This checklist is not available for public access.'); return; }
      setTemplate(t);
    } catch {
      setError('Failed to load checklist.');
    } finally {
      setLoading(false);
    }
  }

  async function handleStart(e) {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/public-checklist-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: template.id, name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to start checklist');
        return;
      }
      // Redirect to the public checklist with the session ID
      router.push(`/public-checklist?s=${data.sessionId}`);
    } catch {
      alert('Failed to start. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-600 to-brand-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-white/60 animate-spin mx-auto mb-3" />
          <p className="text-white/60 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full card p-8 text-center">
          <AlertCircle className="w-12 h-12 text-danger-400 mx-auto mb-3" />
          <h2 className="text-lg font-display font-bold text-surface-800 mb-1">Oops</h2>
          <p className="text-sm text-surface-500 mb-5">{error}</p>
          <p className="text-xs text-surface-400">Ask staff for help or scan a different QR code.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-600 to-brand-900 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-8 pb-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mx-auto mb-4">
          <QrCode className="w-7 h-7 text-white" />
        </div>
        <p className="text-white/60 text-sm mb-1">Public Checklist</p>
        <h1 className="text-2xl font-display font-bold text-white mb-1">{template.title}</h1>
        {template.description && (
          <p className="text-white/70 text-sm max-w-xs mx-auto">{template.description}</p>
        )}
        {template.shopName && (
          <div className="flex items-center justify-center gap-1.5 mt-2 text-white/60 text-xs">
            <MapPin className="w-3.5 h-3.5" />
            {template.shopName}
          </div>
        )}
      </div>

      {/* Name form */}
      <div className="flex-1 px-4">
        <div className="max-w-sm mx-auto">
          <div className="card p-6">
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-2">
                <User className="w-6 h-6 text-brand-600" />
              </div>
              <h2 className="text-base font-display font-semibold text-surface-800">What is your name?</h2>
              <p className="text-xs text-surface-500 mt-0.5">Enter your name to start the checklist</p>
            </div>

            <form onSubmit={handleStart} className="space-y-3">
              <div>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="input-field text-center text-base py-3"
                  placeholder="Your full name"
                  autoFocus
                  autoComplete="name"
                  required
                  minLength={2}
                />
              </div>
              <button
                type="submit"
                disabled={submitting || name.trim().length < 2}
                className="btn-primary w-full py-3 text-base">
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Start Checklist <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Checklist preview */}
            <div className="mt-4 pt-4 border-t border-surface-100">
              <p className="text-[11px] font-medium text-surface-400 uppercase tracking-wider mb-2">Checklist includes</p>
              <div className="space-y-1">
                {(template.items || []).slice(0, 4).map((item, i) => (
                  <div key={item.id || i} className="flex items-center gap-2 text-sm text-surface-600">
                    <div className="w-4 h-4 rounded border border-surface-200 flex-shrink-0" />
                    <span className="truncate">{item.text}</span>
                    {item.required && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-danger-50 text-danger-600 font-medium ml-auto flex-shrink-0">Req.</span>
                    )}
                  </div>
                ))}
                {(template.items || []).length > 4 && (
                  <p className="text-xs text-surface-400 pl-6">
                    +{template.items.length - 4} more items
                  </p>
                )}
              </div>
            </div>
          </div>

          <p className="text-center text-white/40 text-xs mt-4">
            By starting, you agree to complete the checklist honestly.
          </p>
        </div>
      </div>

      {/* Branding */}
      <div className="px-4 pb-6 pt-4 text-center">
        <div className="flex items-center justify-center gap-2 text-white/30 text-xs">
          <Shield className="w-3.5 h-3.5" />
          Powered by StaffHub
        </div>
      </div>
    </div>
  );
}

export default function PublicScanPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-brand-600 to-brand-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
      </div>
    }>
      <PublicScanContent />
    </Suspense>
  );
}
