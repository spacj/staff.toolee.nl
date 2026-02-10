'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Clock, Calendar, Users, Store, CreditCard, ArrowRight, Check, Star, BarChart3, FileCheck } from 'lucide-react';

const features = [
  { icon: Store, title: 'Multi-Shop Management', desc: 'Manage multiple locations from one dashboard. Each shop has its own schedules, workers, and settings.' },
  { icon: Calendar, title: 'Smart Shift Planning', desc: 'Define shift templates, set requirements, and let the algorithm assign workers — salaried staff get priority.' },
  { icon: Clock, title: 'Clock In/Out', desc: 'Workers clock in and out from their phone. Admins see real-time attendance across all shops.' },
  { icon: FileCheck, title: 'Holiday & Leave Management', desc: 'Staff request holidays and sick leave. Admins approve with one click — calendar updates automatically.' },
  { icon: BarChart3, title: 'Cost Analytics', desc: 'Track hourly and salaried costs per worker, per shop. Know exactly what each shift costs you.' },
  { icon: Users, title: 'Role-Based Access', desc: 'Admins manage everything. Workers see their schedule, clock in/out, and request time off.' },
];

const plans = [
  { name: 'Free', price: '€0', period: '/month', desc: 'For small teams getting started', badge: 'bg-emerald-100 text-emerald-700',
    features: ['Up to 4 workers', '1 shop included', 'Shift scheduling', 'Clock in/out', 'Calendar view'], cta: 'Get Started Free', href: '/register' },
  { name: 'Standard', price: '€2', period: '/worker/mo', desc: 'Growing teams with multiple shops', badge: 'bg-brand-100 text-brand-700', popular: true,
    features: ['5–20 workers', '€15/shop/month', 'Save ~17% with yearly billing', 'Auto-adjusts when team changes', 'Attendance & cost analytics', 'PayPal auto-billing'], cta: 'Start Free Trial', href: '/register' },
  { name: 'Enterprise', price: '€99', period: '/month', desc: 'Large operations, unlimited scale', badge: 'bg-purple-100 text-purple-700',
    features: ['Unlimited workers & shops', '€990/year (2 months free)', 'Priority support', 'Custom integrations', 'Everything included'], cta: 'Contact Sales', href: '/register' },
];

export default function HomePage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && userProfile) {
      router.replace('/dashboard');
    }
  }, [user, userProfile, loading, router]);

  // Show nothing while checking auth (prevents flash of homepage)
  if (loading || (user && userProfile)) {
    return <div className="min-h-screen bg-white" />;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-surface-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-display font-bold text-surface-900">StaffHub</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors px-3 py-2">Sign In</Link>
            <Link href="/register" className="btn-primary !py-2 !px-4 !text-sm">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <Star className="w-4 h-4" /> Free for teams up to 4 workers
          </div>
          <h1 className="text-4xl sm:text-6xl font-display font-bold text-surface-900 leading-tight mb-6">
            Staff management<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-600 to-brand-400">made simple</span>
          </h1>
          <p className="text-lg sm:text-xl text-surface-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Schedule shifts, track attendance, manage holidays, and control costs across all your shops — from one beautiful dashboard.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="btn-primary !py-3.5 !px-8 !text-base shadow-lg shadow-brand-500/20">
              Start for Free <ArrowRight className="w-5 h-5" />
            </Link>
            <a href="#pricing" className="btn-secondary !py-3.5 !px-8 !text-base">View Pricing</a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 bg-surface-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-surface-900 mb-4">Everything you need to manage your team</h2>
            <p className="text-lg text-surface-500 max-w-2xl mx-auto">From scheduling to payroll — all the tools in one place.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl border border-surface-200 p-6 hover:shadow-lg hover:border-surface-300 transition-all">
                <div className="w-11 h-11 rounded-xl bg-brand-100 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-brand-600" />
                </div>
                <h3 className="text-lg font-display font-semibold text-surface-900 mb-2">{f.title}</h3>
                <p className="text-sm text-surface-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-display font-bold text-surface-900 text-center mb-14">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Register & add shops', desc: 'Create your company account and add your shop locations.' },
              { step: '2', title: 'Invite your team', desc: 'Add workers, set their pay, and share invite codes so they can log in.' },
              { step: '3', title: 'Schedule & track', desc: 'Define shifts, auto-assign staff, track attendance and costs in real time.' },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-brand-600 text-white text-lg font-bold flex items-center justify-center mx-auto mb-4">{s.step}</div>
                <h3 className="font-display font-semibold text-surface-900 mb-2">{s.title}</h3>
                <p className="text-sm text-surface-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 sm:px-6 bg-surface-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-surface-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-surface-500">No hidden fees. Upgrade or downgrade anytime.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.name} className={`bg-white rounded-2xl border-2 p-6 relative ${plan.popular ? 'border-brand-500 shadow-lg shadow-brand-500/10' : 'border-surface-200'}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full">Most Popular</div>
                )}
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${plan.badge}`}>{plan.name}</span>
                <div className="mt-4 mb-1">
                  <span className="text-4xl font-display font-bold text-surface-900">{plan.price}</span>
                  <span className="text-sm text-surface-400">{plan.period}</span>
                </div>
                <p className="text-sm text-surface-500 mb-6">{plan.desc}</p>
                <ul className="space-y-2.5 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-surface-600">
                      <Check className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href} className={`block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-all ${plan.popular ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-md' : 'bg-surface-100 text-surface-700 hover:bg-surface-200'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-brand-600 to-brand-800 rounded-3xl p-10 sm:p-14">
          <h2 className="text-3xl font-display font-bold text-white mb-4">Ready to simplify your staff management?</h2>
          <p className="text-brand-200 mb-8 max-w-lg mx-auto">Join hundreds of businesses using StaffHub to save time and reduce scheduling headaches.</p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-white text-brand-700 font-semibold px-8 py-3.5 rounded-xl hover:bg-brand-50 transition-all shadow-lg">
            Get Started for Free <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 sm:px-6 border-t border-surface-100">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-display font-bold text-surface-900">StaffHub</span>
          </div>
          <p className="text-xs text-surface-400">© 2026 StaffHub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
