'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Clock, Calendar, Users, Store, ArrowRight, Check, Star, BarChart3, FileCheck, Sparkles, Zap, ChevronRight } from 'lucide-react';

const features = [
  { icon: Store, title: 'Multi-Shop', desc: 'Manage multiple locations from one dashboard with separate schedules and staff.', color: 'from-brand-500 to-brand-600' },
  { icon: Calendar, title: 'Smart Scheduling', desc: 'AI-powered shift templates that auto-assign workers based on preferences and availability.', color: 'from-purple-500 to-purple-600' },
  { icon: Clock, title: 'Time Tracking', desc: 'Workers clock in/out from their phone. Real-time attendance across all shops.', color: 'from-emerald-500 to-emerald-600' },
  { icon: FileCheck, title: 'Leave Management', desc: 'Staff request holidays and sick leave. Approve with one click — calendar updates automatically.', color: 'from-amber-500 to-amber-600' },
  { icon: BarChart3, title: 'Cost Analytics', desc: 'Track hourly and salaried costs per worker, per shop. Know what each shift costs.', color: 'from-pink-500 to-rose-600' },
  { icon: Users, title: 'Role-Based Access', desc: 'Admins, managers, and workers each see exactly what they need — nothing more.', color: 'from-cyan-500 to-blue-600' },
];

const plans = [
  { name: 'Free', price: '€0', period: '/month', desc: 'Small teams getting started', badge: 'bg-emerald-100 text-emerald-700',
    features: ['Up to 4 workers', '1 shop included', 'Shift scheduling', 'Clock in/out', 'Calendar view'], cta: 'Get Started Free', href: '/register' },
  { name: 'Standard', price: '€2', period: '/worker/mo', desc: 'Growing teams with shops', badge: 'bg-brand-100 text-brand-700', popular: true,
    features: ['5–20 workers', '1st shop free, +€15/shop', 'Save ~17% yearly', 'Auto-adjusts billing', 'Full analytics', 'AI assistant'], cta: 'Start Free Trial', href: '/register' },
  { name: 'Enterprise', price: '€99', period: '/month flat', desc: 'Large operations, unlimited', badge: 'bg-purple-100 text-purple-700',
    features: ['Unlimited workers & shops', '€990/year (save 2 months)', 'Priority support', 'Custom integrations', 'Everything included'], cta: 'Contact Sales', href: '/register' },
];

export default function HomePage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && userProfile) router.replace('/dashboard');
  }, [user, userProfile, loading, router]);

  if (loading || (user && userProfile)) return <div className="min-h-screen bg-white" />;

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-surface-100/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Shield className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-display font-bold text-surface-900 tracking-tight">StaffHub</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors px-3 py-2">Sign In</Link>
            <Link href="/register" className="btn-primary !py-2 !px-5 !text-sm !shadow-lg !shadow-brand-500/20">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-20 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-32 left-1/4 w-96 h-96 bg-brand-200/30 rounded-full blur-3xl" />
          <div className="absolute top-48 right-1/4 w-72 h-72 bg-purple-200/20 rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-50 to-purple-50 text-brand-700 text-sm font-medium px-4 py-2 rounded-full mb-8 border border-brand-100/60">
            <Sparkles className="w-4 h-4" /> Now with AI-powered scheduling
          </div>
          <h1 className="text-5xl sm:text-7xl font-display font-bold text-surface-900 leading-[1.1] mb-6 tracking-tight">
            Staff management<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-600 via-brand-500 to-purple-500">made simple</span>
          </h1>
          <p className="text-lg sm:text-xl text-surface-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Schedule shifts, track attendance, manage leave, and control costs across all your shops — from one beautiful dashboard.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="btn-primary !py-3.5 !px-8 !text-base !shadow-xl !shadow-brand-500/25 hover:!shadow-2xl hover:!shadow-brand-500/30 hover:!-translate-y-0.5 transition-all">
              Start for Free <ArrowRight className="w-5 h-5" />
            </Link>
            <a href="#pricing" className="btn-secondary !py-3.5 !px-8 !text-base group">
              View Pricing <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>
          <p className="text-sm text-surface-400 mt-5">Free for up to 4 workers · No credit card required</p>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 sm:px-6 bg-surface-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-surface-900 mb-4">Everything you need to manage your team</h2>
            <p className="text-lg text-surface-500 max-w-2xl mx-auto">From scheduling to cost analytics — all the tools in one beautiful platform.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl border border-surface-200/80 p-6 hover:shadow-lg hover:border-surface-300/80 hover:-translate-y-0.5 transition-all duration-300 group">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 shadow-sm group-hover:shadow-md transition-shadow`}>
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-display font-semibold text-surface-900 mb-2">{f.title}</h3>
                <p className="text-sm text-surface-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-surface-900">Up and running in minutes</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            {[
              { step: '1', title: 'Register & add shops', desc: 'Create your company account and add your shop locations in seconds.' },
              { step: '2', title: 'Invite your team', desc: 'Add workers, set pay rates, and share invite codes for instant onboarding.' },
              { step: '3', title: 'Schedule & track', desc: 'Define shifts, auto-assign staff with AI, and track everything in real time.' },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white text-xl font-bold flex items-center justify-center mx-auto mb-5 shadow-lg shadow-brand-500/20">{s.step}</div>
                <h3 className="font-display font-bold text-surface-900 text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-surface-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-4 sm:px-6 bg-surface-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-surface-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-surface-500">No hidden fees. Scale up or down anytime.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {plans.map((plan) => (
              <div key={plan.name} className={`bg-white rounded-2xl border-2 p-6 relative transition-all duration-300 hover:-translate-y-1 ${plan.popular ? 'border-brand-500 shadow-xl shadow-brand-500/10' : 'border-surface-200 hover:border-surface-300 hover:shadow-lg'}`}>
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-brand-500 to-brand-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg shadow-brand-500/20">Most Popular</div>
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
                <Link href={plan.href} className={`block w-full text-center py-3 rounded-xl text-sm font-semibold transition-all ${plan.popular ? 'bg-gradient-to-b from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700 shadow-md shadow-brand-500/20' : 'bg-surface-100 text-surface-700 hover:bg-surface-200'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-surface-900 via-surface-800 to-brand-900 rounded-3xl p-10 sm:p-16 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-brand-400 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-400 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10">
            <Zap className="w-10 h-10 text-brand-400 mx-auto mb-5" />
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-4">Ready to simplify your operations?</h2>
            <p className="text-white/60 mb-8 max-w-lg mx-auto">Join businesses using StaffHub to save time, reduce errors, and keep their team happy.</p>
            <Link href="/register" className="inline-flex items-center gap-2 bg-white text-surface-900 font-semibold px-8 py-3.5 rounded-xl hover:bg-brand-50 transition-all shadow-xl hover:-translate-y-0.5">
              Get Started for Free <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
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
          <p className="text-xs text-surface-400">&copy; 2026 StaffHub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
