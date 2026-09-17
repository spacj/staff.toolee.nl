import Link from 'next/link';
import Logo from '@/components/Logo';
import { ArrowLeft } from 'lucide-react';

const SITE_URL = 'https://staff2.app';
const LAST_UPDATED = 'September 17, 2026';
const CONTACT_EMAIL = 'info@staff2.app';
const LEGAL_ENTITY = 'MAQ Solutions';

export const metadata = {
  title: 'Privacy Policy',
  description: `How ${LEGAL_ENTITY} collects, uses and protects your data in Staff2.`,
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true },
};

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 mb-3">{title}</h2>
      <div className="space-y-3 text-sm sm:text-base text-slate-600 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
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

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-400 mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-10">
          <Section id="overview">
            <>
              <p>
                Staff2 (&ldquo;Staff2&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a team operations platform operated by{' '}
                {LEGAL_ENTITY} that helps businesses manage scheduling, time tracking, stock, checklists and related
                staff operations. This policy explains what data we collect through the Staff2 web app and Android
                app, why we collect it, and the choices you have.
              </p>
              <p>
                By using Staff2 you agree to the collection and use of information as described here. If you don&rsquo;t
                agree, please don&rsquo;t use the app.
              </p>
            </>
          </Section>

          <Section id="data-we-collect" title="Information we collect">
            <>
              <p><strong>Account information.</strong> When you register or sign in (including via Google Sign-In), we collect your name, email address, and a profile photo if you provide one. If you join an organization, your role and employment details (e.g. hourly rate, contract type) may be added by your employer/admin.</p>
              <p><strong>Work data.</strong> Shift schedules, availability, clock in/out timestamps, leave requests, shop assignments, checklist responses, stock and recipe records, and internal chat messages you send within the app.</p>
              <p><strong>Camera access.</strong> The checklist scanner uses your device camera to read QR/barcodes. Scanning happens on-device — we do not capture or store camera images, only the decoded code value.</p>
              <p><strong>Payment information.</strong> Subscription payments are processed by PayPal. We receive subscription status and billing metadata (e.g. plan, renewal date) — we never see or store your card or PayPal account credentials.</p>
              <p><strong>Usage and device data.</strong> We use Vercel Analytics to collect anonymous, aggregated usage data (pages visited, general device/browser type) to help us improve the product. This data is not tied to your identity.</p>
              <p><strong>Cookies.</strong> We use essential cookies for authentication and session management, and optional analytics cookies you can decline via the cookie banner.</p>
            </>
          </Section>

          <Section id="how-we-use" title="How we use your information">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>To provide core functionality: scheduling, time tracking, stock, checklists and team communication.</li>
              <li>To authenticate you and keep your account and organization&rsquo;s data secure.</li>
              <li>To process subscription billing and send related notices.</li>
              <li>To send transactional notifications (e.g. shift changes, approvals) and, where enabled, push notifications.</li>
              <li>To provide customer support when you contact us.</li>
              <li>To improve the app through aggregated, anonymized usage analytics.</li>
              <li>To detect abuse and keep the platform secure and reliable.</li>
            </ul>
          </Section>

          <Section id="sharing" title="How we share your information">
            <>
              <p>
                Work data you enter is visible to other members of your organization according to their role
                (e.g. managers can see staff schedules and hours; staff see their own data and what their admin
                shares). We do not sell your personal data.
              </p>
              <p>We share data with the following service providers, only as needed to run Staff2:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong>Firebase (Google)</strong> — authentication, database and hosting infrastructure.</li>
                <li><strong>PayPal</strong> — subscription payment processing.</li>
                <li><strong>Vercel</strong> — app hosting and anonymous analytics.</li>
              </ul>
              <p>We may also disclose information if required by law, or to protect the rights, safety and property of Staff2, our users, or others.</p>
            </>
          </Section>

          <Section id="retention" title="Data retention">
            <p>
              We retain your account and work data for as long as your account is active, or as needed to provide
              the service. If you or your organization&rsquo;s admin deletes your account, we delete or anonymize
              your personal data within a reasonable period, except where we must retain records to comply with
              legal, tax or accounting obligations.
            </p>
          </Section>

          <Section id="your-rights" title="Your rights">
            <>
              <p>Depending on your location, you may have the right to:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Access the personal data we hold about you.</li>
                <li>Correct inaccurate data.</li>
                <li>Request deletion of your data.</li>
                <li>Export your data in a portable format.</li>
                <li>Object to or restrict certain processing.</li>
              </ul>
              <p>To exercise any of these rights, contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-600 hover:text-brand-700 font-medium">{CONTACT_EMAIL}</a>. Note that some data is controlled by your employer/organization admin, who may need to action certain requests directly.</p>
            </>
          </Section>

          <Section id="security" title="Data security">
            <p>
              We use industry-standard measures to protect your data, including encrypted connections (HTTPS),
              per-organization data isolation, and role-based access controls so people only see what they need.
              No method of transmission or storage is 100% secure, so we cannot guarantee absolute security.
            </p>
          </Section>

          <Section id="children" title="Children's privacy">
            <p>
              Staff2 is a workplace tool intended for use by employees and employers. It is not directed at
              children, and we do not knowingly collect data from anyone under 16.
            </p>
          </Section>

          <Section id="changes" title="Changes to this policy">
            <p>
              We may update this policy from time to time. If we make material changes, we&rsquo;ll notify you
              through the app or by email. The &ldquo;Last updated&rdquo; date above reflects the latest revision.
            </p>
          </Section>

          <Section id="contact" title="Contact us">
            <p>
              If you have questions about this policy or how we handle your data, contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-600 hover:text-brand-700 font-medium">{CONTACT_EMAIL}</a>{' '}
              or visit <a href={SITE_URL} className="text-brand-600 hover:text-brand-700 font-medium">{SITE_URL.replace('https://', '')}</a>.
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}
