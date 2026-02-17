'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Mail, Lock, User, Building, Eye, EyeOff, ArrowRight, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const router = useRouter();
  const { registerAdmin } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: company, 2: account
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
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-surface-50 to-brand-50/30">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-display font-bold text-surface-900">StaffHub</span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= 1 ? 'bg-brand-600 text-white' : 'bg-surface-200 text-surface-500'
            }`}>
              {step > 1 ? <Check className="w-4 h-4" /> : '1'}
            </div>
            <span className="text-sm font-medium text-surface-700">Company</span>
          </div>
          <div className="flex-1 h-px bg-surface-200" />
          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= 2 ? 'bg-brand-600 text-white' : 'bg-surface-200 text-surface-500'
            }`}>
              2
            </div>
            <span className="text-sm font-medium text-surface-700">Admin Account</span>
          </div>
        </div>

        <div className="card p-6 sm:p-8">
          {step === 1 ? (
            <>
              <h2 className="text-xl font-display font-bold text-surface-900 mb-2">Register your company</h2>
              <p className="text-sm text-surface-500 mb-6">
                You'll be the admin. You can invite workers and managers after setup.
              </p>
              <form onSubmit={handleStep1} className="space-y-4">
                <div>
                  <label className="label">Company Name *</label>
                  <div className="relative">
                    <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                      name="companyName" value={form.companyName} onChange={handleChange}
                      placeholder="Acme Inc." className="input-field pl-10" required autoFocus
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Referral Code (optional)</label>
                  <input
                    name="referralCode" value={form.referralCode} onChange={handleChange}
                    placeholder="Enter referral code if you have one" className="input-field"
                  />
                </div>
                <button type="submit" className="btn-primary w-full !py-3">
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-display font-bold text-surface-900">Create admin account</h2>
                  <p className="text-sm text-surface-500 mt-0.5">
                    For <strong>{form.companyName}</strong>
                  </p>
                </div>
                <button onClick={() => setStep(1)} className="text-xs text-brand-600 hover:underline">
                  Change
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Your Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                      name="displayName" value={form.displayName} onChange={handleChange}
                      placeholder="John Doe" className="input-field pl-10" required autoFocus
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                      name="email" type="email" value={form.email} onChange={handleChange}
                      placeholder="admin@company.com" className="input-field pl-10" required
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                      name="password" type={showPassword ? 'text' : 'password'}
                      value={form.password} onChange={handleChange}
                      placeholder="Min 6 characters" className="input-field pl-10 pr-10" required minLength={6}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Confirm Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                      name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange}
                      placeholder="Repeat your password" className="input-field pl-10" required minLength={6}
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Create Account & Company <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-surface-500 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
