import Link from 'next/link';
import Logo from '@/components/Logo';
import DeleteAccountForm from '@/components/DeleteAccountForm';
import { ArrowLeft } from 'lucide-react';

const CONTACT_EMAIL = 'info@staff2.app';

export const metadata = {
  title: 'Delete Account',
  description: 'Request permanent deletion of your Staff2 account and personal data.',
  alternates: { canonical: '/delete-account' },
  robots: { index: true, follow: true },
};

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/30">
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <Logo theme="light" size="md" />
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to site
          </Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 mb-3">Delete your account</h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-8">
          You can request permanent deletion of your Staff2 account and personal data here, even if you don&rsquo;t
          have the app installed or can&rsquo;t sign in. You can also do this from inside the app under{' '}
          <strong>Settings &rarr; Danger Zone &rarr; Delete Account</strong>.
        </p>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 mb-8 space-y-3 text-sm text-slate-600 leading-relaxed">
          <h2 className="text-base font-display font-semibold text-slate-900">What gets deleted</h2>
          <p><strong>Your profile</strong> &mdash; name, email, photo, login credentials, and preferences are permanently deleted.</p>
          <p><strong>If you&rsquo;re a staff member</strong>, your personal account is removed and you&rsquo;re unlinked from your organization. Historical records your employer needs to keep for payroll, tax or labor-law purposes (e.g. past shifts and clock-in times) may be retained by the organization, no longer linked to your personal profile.</p>
          <p><strong>If you&rsquo;re an admin/owner</strong>, deleting your account deletes your entire organization: all schedules, staff records, stock, recipes, checklists and chat history for every member.</p>
          <p><strong>Billing records</strong> (invoices, subscription history) may be retained for a limited period where required for tax and accounting compliance, after which they are deleted.</p>
          <p>We process deletion requests within <strong>30 days</strong> and confirm by email once complete.</p>
        </div>

        <DeleteAccountForm />

        <p className="text-sm text-slate-500 mt-6 text-center">
          Prefer email? Send your request to{' '}
          <a href={`mailto:${CONTACT_EMAIL}?subject=Account%20Deletion%20Request`} className="text-brand-600 hover:text-brand-700 font-medium">{CONTACT_EMAIL}</a>.
        </p>
      </main>
    </div>
  );
}
