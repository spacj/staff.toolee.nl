'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getInviteByCode } from '@/lib/firestore';
import { Shield, Mail, Lock, User, Eye, EyeOff, ArrowRight, Ticket, CheckCircle, Building, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function JoinPage() {
  const router = useRouter();
  const { registerWorker } = useAuth();

  const [step, setStep] = useState(1); // 1: code, 2: create account
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
  });

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (code.trim().length < 4) {
      toast.error('Please enter a valid invite code');
      return;
    }

    setLoading(true);
    try {
      const found = await getInviteByCode(code.trim());
      if (!found) {
        toast.error('Invalid or expired invite code');
        setLoading(false);
        return;
      }
      setInvite(found);
      // Pre-fill name and email from the invite if present
      setForm((prev) => ({
        ...prev,
        displayName: found.workerName || '',
        email: found.workerEmail || '',
      }));
      setStep(2);
    } catch (err) {
      toast.error('Failed to verify code');
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await registerWorker(form.email, form.password, form.displayName, invite);
      toast.success('Account created! Welcome to the team.');
      router.push('/dashboard');
    } catch (err) {
      const messages = {
        'auth/email-already-in-use': 'This email is already registered. Try signing in instead.',
        'auth/weak-password': 'Password must be at least 6 characters.',
      };
      toast.error(messages[err.code] || err.message || 'Registration failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-surface-50 to-emerald-50/30">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-display font-bold text-surface-900">StaffHub</span>
        </div>

        <div className="card p-6 sm:p-8">
          {step === 1 ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-5">
                <Ticket className="w-7 h-7 text-emerald-600" />
              </div>
              <h2 className="text-xl font-display font-bold text-surface-900 mb-2 text-center">
                Join your team
              </h2>
              <p className="text-sm text-surface-500 mb-6 text-center">
                Enter the invite code your admin shared with you.
              </p>
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <label className="label">Invite Code *</label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. AB3K7FHP"
                    className="input-field text-center text-lg font-mono tracking-[0.3em] uppercase"
                    required
                    autoFocus
                    maxLength={12}
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Verify Code <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Invite info banner */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl mb-5">
                <div className="flex gap-2.5">
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-emerald-800">Invite verified!</p>
                    <p className="text-emerald-700 mt-0.5">
                      {invite.orgName && <>Joining <strong>{invite.orgName}</strong> · </>}
                      Role: <strong className="capitalize">{invite.role || 'worker'}</strong>
                    </p>
                  </div>
                </div>
              </div>

              <h2 className="text-xl font-display font-bold text-surface-900 mb-2">Create your account</h2>
              <p className="text-sm text-surface-500 mb-5">
                Set up your login to get started.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                      name="displayName" value={form.displayName} onChange={handleChange}
                      placeholder="Your full name" className="input-field pl-10" required
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                      name="email" type="email" value={form.email} onChange={handleChange}
                      placeholder="you@email.com" className="input-field pl-10" required
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

                <div className="p-3 bg-surface-50 border border-surface-200 rounded-xl">
                  <div className="flex gap-2 text-xs text-surface-500">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <p>After creating your account, you can link your Google account in Settings for faster sign-in.</p>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Create Account & Join <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-surface-500 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">Sign In</Link>
          {' · '}
          <Link href="/register" className="font-semibold text-brand-600 hover:text-brand-700">Register Company</Link>
        </p>
      </div>
    </div>
  );
}
