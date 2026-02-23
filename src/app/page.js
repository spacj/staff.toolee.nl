'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { PRICE_PER_WORKER, PRICE_PER_SHOP, ENTERPRISE_PRICE_MONTHLY, ENTERPRISE_DISCOUNTED_PRICE, ENTERPRISE_THRESHOLD, FREE_WORKER_LIMIT } from '@/lib/pricing';
import { Shield, Clock, Calendar, Users, Store, ArrowRight, Check, Star, BarChart3, FileCheck, Sparkles, Zap, ChevronRight, ExternalLink } from 'lucide-react';

const features = [
  { icon: Store, title: 'Multi-Shop Management', desc: 'Manage multiple locations from one dashboard with separate schedules and staff.', color: 'from-brand-500 to-brand-600' },
  { icon: Calendar, title: 'AI-Powered Scheduling', desc: 'Smart shift templates that auto-assign workers based on preferences and availability.', color: 'from-purple-500 to-purple-600' },
  { icon: Clock, title: 'Real-Time Time Tracking', desc: 'Workers clock in/out from their phone. Live attendance across all shops.', color: 'from-emerald-500 to-emerald-600' },
  { icon: FileCheck, title: 'Leave Management', desc: 'Staff request holidays and sick leave. Approve with one click — calendar updates automatically.', color: 'from-amber-500 to-amber-600' },
  { icon: BarChart3, title: 'Cost Analytics', desc: 'Track hourly and salaried costs per worker, per shop. Know what each shift costs.', color: 'from-pink-500 to-rose-600' },
  { icon: Users, title: 'Role-Based Access', desc: 'Admins, managers, and workers each see exactly what they need — nothing more.', color: 'from-cyan-500 to-blue-600' },
];

const plans = [
  { name: 'Starter', price: '€0', period: 'forever', desc: 'Perfect for small teams', badge: 'bg-emerald-100 text-emerald-700',
    features: [`${FREE_WORKER_LIMIT} workers included`, '1 shop', 'Shift scheduling', 'Clock in/out', 'Calendar view', 'Basic support'], cta: 'Get Started Free', href: '/register' },
  { name: 'Professional', price: `€${PRICE_PER_WORKER}`, period: '/worker/mo', desc: 'For growing businesses', badge: 'bg-brand-100 text-brand-700', popular: true,
    features: [`${FREE_WORKER_LIMIT + 1}–${ENTERPRISE_THRESHOLD - 1} workers`, `1st shop free, +€${PRICE_PER_SHOP}/shop`, 'Save ~17% with yearly billing', 'Full analytics dashboard', 'AI scheduling assistant', 'Priority support'], cta: 'Start Free Trial', href: '/register' },
  { name: 'Enterprise', price: `€${ENTERPRISE_DISCOUNTED_PRICE}`, period: '/month', desc: 'For large operations', badge: 'bg-purple-100 text-purple-700',
    features: ['Unlimited workers & shops', `€${ENTERPRISE_PRICE_MONTHLY}/mo (€${ENTERPRISE_DISCOUNTED_PRICE} with discount)`, 'Dedicated support', 'Custom integrations', 'SLA guarantee', 'Everything included'], cta: 'Contact Sales', href: '/register' },
];

export default function HomePage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && userProfile) router.replace('/dashboard');
  }, [user, userProfile, loading, router]);

  if (loading || (user && userProfile)) return <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/30" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/30">
      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-display font-bold text-slate-900 tracking-tight leading-none">StaffHub</span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide">by toolee.nl</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-4 py-2">Sign In</Link>
            <Link href="/register" className="btn-primary !py-2.5 !px-6 !text-sm !shadow-lg !shadow-brand-500/30">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-brand-200/40 rounded-full blur-3xl" />
          <div className="absolute top-40 right-1/4 w-[400px] h-[400px] bg-purple-200/30 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 left-1/3 w-[300px] h-[300px] bg-emerald-200/20 rounded-full blur-3xl" />
        </div>
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white border border-brand-200 text-brand-700 text-sm font-medium px-5 py-2.5 rounded-full mb-8 shadow-sm">
            <Sparkles className="w-4 h-4" /> AI-Powered Scheduling Now Available
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold text-slate-900 leading-[1.1] mb-6 tracking-tight">
            The smarter way to<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-600 via-brand-500 to-purple-500">manage your staff</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto mb-12 leading-relaxed">
            Schedule shifts effortlessly, track attendance in real-time, manage leave requests, and control labor costs — all from one beautifully designed platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link href="/register" className="btn-primary !py-4 !px-10 !text-base !shadow-xl !shadow-brand-500/30 hover:!shadow-2xl hover:!shadow-brand-500/40 hover:!-translate-y-1 transition-all">
              Start Your Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
            <a href="#pricing" className="btn-secondary !py-4 !px-10 !text-base group">
              View Pricing <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
          <div className="flex items-center justify-center gap-6 text-sm text-slate-500">
            <span className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Free for up to {FREE_WORKER_LIMIT} workers</span>
            <span className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> No credit card required</span>
            <span className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* Trusted By */}
      <section className="py-12 px-4 sm:px-6 border-y border-slate-200/60 bg-white/50">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-sm font-medium text-slate-500 mb-6">Built with care by</p>
          <div className="flex items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-display font-bold text-slate-900">toolee.nl</span>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 mb-4">Everything you need to manage your team</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">From smart scheduling to cost analytics — all the tools in one powerful platform.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl border border-slate-200/80 p-7 hover:shadow-xl hover:border-slate-300/80 hover:-translate-y-1 transition-all duration-300 group">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-5 shadow-lg`}>
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-display font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-4 sm:px-6 bg-gradient-to-br from-slate-50 to-brand-50/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider mb-3">How It Works</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 mb-4">Up and running in minutes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { step: '01', title: 'Create Your Account', desc: 'Sign up and add your company details. Set up your first shop location in seconds.' },
              { step: '02', title: 'Invite Your Team', desc: 'Add workers, set pay rates, and share invite codes for instant team onboarding.' },
              { step: '03', title: 'Start Managing', desc: 'Create shift templates, let AI assign staff, and track everything in real time.' },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white text-xl font-bold flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand-500/30">{s.step}</div>
                <h3 className="font-display font-bold text-slate-900 text-xl mb-3">{s.title}</h3>
                <p className="text-slate-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-slate-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-slate-600">No hidden fees. Scale up or down anytime.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.name} className={`bg-white rounded-2xl border-2 p-8 relative transition-all duration-300 hover:-translate-y-2 ${plan.popular ? 'border-brand-500 shadow-2xl shadow-brand-500/20 scale-105' : 'border-slate-200 hover:border-slate-300 hover:shadow-xl'}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-brand-500 to-brand-600 text-white text-xs font-bold px-5 py-2 rounded-full shadow-lg shadow-brand-500/30">Most Popular</div>
                )}
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${plan.badge}`}>{plan.name}</span>
                <div className="mt-5 mb-2">
                  <span className="text-5xl font-display font-bold text-slate-900">{plan.price}</span>
                  <span className="text-base text-slate-500">{plan.period}</span>
                </div>
                <p className="text-slate-600 mb-8">{plan.desc}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-slate-700">
                      <Check className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" /> <span className="text-sm">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href={plan.href} className={`block w-full text-center py-4 rounded-xl text-sm font-semibold transition-all ${plan.popular ? 'bg-gradient-to-b from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700 shadow-lg shadow-brand-500/30' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 rounded-3xl p-12 sm:p-16 relative overflow-hidden shadow-2xl">
            <div className="absolute inset-0 opacity-30">
              <div className="absolute -top-20 -right-20 w-80 h-80 bg-brand-400 rounded-full blur-3xl" />
              <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-purple-400 rounded-full blur-3xl" />
            </div>
            <div className="relative z-10 text-center">
              <Zap className="w-12 h-12 text-brand-400 mx-auto mb-6" />
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white mb-5">Ready to simplify your operations?</h2>
              <p className="text-white/70 mb-10 max-w-xl mx-auto text-lg">Join businesses using StaffHub to save time, reduce errors, and keep their team happy.</p>
              <Link href="/register" className="inline-flex items-center gap-2 bg-white text-slate-900 font-semibold px-10 py-4 rounded-xl hover:bg-brand-50 transition-all shadow-xl hover:-translate-y-1">
                Get Started for Free <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 border-t border-slate-200/60 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-display font-bold text-slate-900 leading-none">StaffHub</span>
                <span className="text-[10px] text-slate-400 font-medium">by toolee.nl</span>
              </div>
            </div>
            <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} toolee.nl. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}