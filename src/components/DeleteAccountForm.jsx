'use client';
import { useState } from 'react';
import { createSupportTicket } from '@/lib/firestore';
import toast from 'react-hot-toast';
import { Check, Loader2, AlertTriangle } from 'lucide-react';

const ROLES = [
  { value: 'staff', label: "I'm an employee / staff member" },
  { value: 'admin', label: "I'm the business owner / admin" },
];

export default function DeleteAccountForm() {
  const [form, setForm] = useState({ name: '', email: '', role: 'staff', reason: '', confirm: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Please fill in your name and account email');
      return;
    }
    if (!form.confirm) {
      toast.error('Please confirm you understand this is permanent');
      return;
    }
    setSubmitting(true);
    try {
      await createSupportTicket({
        subject: `[Account Deletion Request] ${form.name}`,
        message: form.reason.trim() || '(no reason given)',
        category: 'account-deletion',
        priority: 'high',
        source: 'delete-account-page',
        senderName: form.name.trim(),
        senderEmail: form.email.trim(),
        senderRole: form.role,
      });
      setSubmitted(true);
      toast.success('Deletion request received.');
    } catch (err) {
      console.error('Delete account request error:', err);
      toast.error('Something went wrong. Please email us instead.');
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="text-xl font-display font-bold text-slate-900 mb-2">Request received</h3>
        <p className="text-slate-600">
          We&rsquo;ll verify your identity by email and process your deletion request within 30 days.
          You&rsquo;ll get a confirmation once it&rsquo;s complete.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Full name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Your name"
            className="input-field"
            required
          />
        </div>
        <div>
          <label className="label">Account email *</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="The email you sign in with"
            className="input-field"
            required
          />
        </div>
      </div>

      <div>
        <label className="label">Your role</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ROLES.map(r => (
            <button
              type="button"
              key={r.value}
              onClick={() => setForm({ ...form, role: r.value })}
              className={`text-left text-sm px-4 py-2.5 rounded-xl border transition-colors ${
                form.role === r.value ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {form.role === 'admin' && (
        <div className="flex gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-amber-800">
            You&rsquo;re the admin of your organization. Deleting your account deletes your <strong>entire organization</strong>&mdash;
            schedules, staff records, stock and checklists for everyone in it. If you just want to leave and hand
            over ownership instead, mention that in the notes below.
          </p>
        </div>
      )}

      <div>
        <label className="label">Anything we should know? (optional)</label>
        <textarea
          value={form.reason}
          onChange={e => setForm({ ...form, reason: e.target.value })}
          placeholder="Reason for leaving, or special instructions"
          rows={3}
          className="input-field resize-none"
        />
      </div>

      <label className="flex items-start gap-2.5 text-sm text-slate-600 cursor-pointer">
        <input
          type="checkbox"
          checked={form.confirm}
          onChange={e => setForm({ ...form, confirm: e.target.checked })}
          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span>I understand this permanently deletes my account and cannot be undone.</span>
      </label>

      <button type="submit" disabled={submitting} className="btn-primary w-full !py-3 flex items-center justify-center gap-2">
        {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : 'Request account deletion'}
      </button>
    </form>
  );
}
