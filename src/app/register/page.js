'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Mail, Lock, User, Building, Eye, EyeOff, ArrowRight, Check, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const router = useRouter();
  const { registerAdmin } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    companyName: '',
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    referralCode: '',
  });

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleStep1 = (e) => {
    e.preventDefault();
    if (!form.companyName.trim()) {
      toast.error('Company name is required');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await registerAdmin(form.email, form.password, form.displayName, form.companyName, form.referralCode);
      toast.success('Company registered! Welcome to StaffHub.');
      router.push('/dashboard');
    } catch (err) {
      const messages = {
        'auth/email-already-in-use': 'This email is already registered. Try signing in instead.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/invalid-email': 'Please enter a valid email address.',
      };
      toast.error(messages[err.code] || err.message || 'Registration failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-purple-600 via-brand-600 to-brand-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 right-20 w-80 h-80 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-20 w-[500px] h-[500px] bg-purple-300 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between px-16 py-12">
          <Link href="/" className="flex items-center gap-3 w-fit">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-display font-bold text-white tracking-tight leading-none">StaffHub</span>
              <span className="text-xs text-purple-200">by toolee.nl</span>
            </div>
          </Link>
          
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-full mb-6 border border-white/10">
              <Sparkles className="w-4 h-4" /> Free 14-day trial
            </div>
            <h1 className="text-5xl font-display font-bold text-white leading-tight mb-6">
              Start managing<br />your team today
            </h1>
            <p className="text-lg text-purple-200 max-w-md leading-relaxed">
              Create your company account and get instant access to all features. No credit card required.
            </p>
          </div>
          
          <div className="space-y-4">
            {[
              'Unlimited shift templates',
              'AI-powered scheduling',
              'Real-time attendance tracking',
              'Cost analytics dashboard',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3 text-white/90">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
          
          <div className="text-purple-200 text-sm">
            &copy; {new Date().getFullYear()} toolee.nl. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-gradient-to-br from-slate-50 via-white to-brand-50/30">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center gap-2 mb-8">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-display font-bold text-slate-900 leading-none">StaffHub</span>
                <span className="text-[10px] text-slate-400">by toolee.nl</span>
              </div>
            </Link>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center gap-2 flex-1">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${
                step >= 1 ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/30' : 'bg-slate-200 text-slate-500'
              }`}>
                {step > 1 ? <Check className="w-5 h-5" /> : '1'}
              </div>
              <span className="text-sm font-medium text-slate-700">Company</span>
            </div>
            <div className="flex-1 h-1 rounded-full bg-slate-200 overflow-hidden">
              <div className={`h-full bg-brand-500 transition-all duration-500 ${step >= 2 ? 'w-full' : 'w-0'}`} />
            </div>
            <div className="flex items-center gap-2 flex-1 justify-end">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${
                step >= 2 ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/30' : 'bg-slate-200 text-slate-500'
              }`}>
                2
              </div>
              <span className="text-sm font-medium text-slate-700">Account</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xl shadow-slate-200/50">
            {step === 1 ? (
              <>
                <h2 className="text-2xl font-display font-bold text-slate-900 mb-2">Register your company</h2>
                <p className="text-slate-600 mb-8">
                  You'll be the admin. You can invite workers and managers after setup.
                </p>
                <form onSubmit={handleStep1} className="space-y-5">
                  <div>
                    <label className="label">Company Name *</label>
                    <div className="relative">
                      <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        name="companyName" value={form.companyName} onChange={handleChange}
                        placeholder="Acme Inc." className="input-field pl-12 py-3.5" required autoFocus
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Referral Code (optional)</label>
                    <input
                      name="referralCode" value={form.referralCode} onChange={handleChange}
                      placeholder="Enter referral or promo code" className="input-field py-3.5"
                    />
                  </div>
                  <button type="submit" className="btn-primary w-full !py-4 !text-base !shadow-lg !shadow-brand-500/30">
                    Continue <ArrowRight className="w-5 h-5" />
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-display font-bold text-slate-900">Create admin account</h2>
                    <p className="text-slate-600 mt-1">
                      For <strong className="text-brand-600">{form.companyName}</strong>
                    </p>
                  </div>
                  <button onClick={() => setStep(1)} className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                    Change
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="label">Your Full Name *</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        name="displayName" value={form.displayName} onChange={handleChange}
                        placeholder="John Doe" className="input-field pl-12 py-3.5" required autoFocus
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Email Address *</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        name="email" type="email" value={form.email} onChange={handleChange}
                        placeholder="admin@company.com" className="input-field pl-12 py-3.5" required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Password *</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        name="password" type={showPassword ? 'text' : 'password'}
                        value={form.password} onChange={handleChange}
                        placeholder="Min 6 characters" className="input-field pl-12 pr-12 py-3.5" required minLength={6}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="label">Confirm Password *</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange}
                        placeholder="Repeat your password" className="input-field pl-12 py-3.5" required minLength={6}
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary w-full !py-4 !text-base !shadow-lg !shadow-brand-500/30">
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>Create Account <ArrowRight className="w-5 h-5" /></>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="text-center text-slate-600 mt-8">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
              Sign In
            </Link>
          </p>
          
          <div className="lg:hidden mt-6 pt-6 border-t border-slate-200 flex flex-col items-center gap-3 text-sm text-slate-500">
            <Link href="/" className="text-brand-600 hover:text-brand-700 font-medium">← Back to Home</Link>
            <div>&copy; {new Date().getFullYear()} toolee.nl</div>
          </div>
          
          <div className="hidden lg:block mt-8 text-center">
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">← Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}