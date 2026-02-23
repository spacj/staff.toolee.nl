'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getInviteByCode } from '@/lib/firestore';
import { Shield, Mail, Lock, User, Eye, EyeOff, ArrowRight, Ticket, CheckCircle, Users, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export default function JoinPage() {
  const router = useRouter();
  const { registerWorker } = useAuth();

  const [step, setStep] = useState(1);
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
    <div className="min-h-screen flex">
      {/* Left — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-600 via-emerald-700 to-brand-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 w-80 h-80 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-[500px] h-[500px] bg-emerald-300 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between px-16 py-12">
          <Link href="/" className="flex items-center gap-3 w-fit">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-display font-bold text-white tracking-tight leading-none">StaffHub</span>
              <span className="text-xs text-emerald-200">by toolee.nl</span>
            </div>
          </Link>
          
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-full mb-6 border border-white/10">
              <Users className="w-4 h-4" /> Join your team
            </div>
            <h1 className="text-5xl font-display font-bold text-white leading-tight mb-6">
              Welcome to<br />the team!
            </h1>
            <p className="text-lg text-emerald-200 max-w-md leading-relaxed">
              You've been invited to join your company's StaffHub. Enter your invite code to get started.
            </p>
          </div>
          
          <div className="space-y-4">
            {[
              'View your schedule anytime',
              'Clock in/out from your phone',
              'Request leave instantly',
              'Get shift notifications',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3 text-white/90">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
          
          <div className="text-emerald-200 text-sm">
            &copy; {new Date().getFullYear()} toolee.nl. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
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

          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xl shadow-slate-200/50">
            {step === 1 ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
                  <Ticket className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-display font-bold text-slate-900 mb-2 text-center">
                  Join your team
                </h2>
                <p className="text-slate-600 mb-8 text-center">
                  Enter the invite code your admin shared with you.
                </p>
                <form onSubmit={handleVerifyCode} className="space-y-5">
                  <div>
                    <label className="label">Invite Code *</label>
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="e.g. AB3K7FHP"
                      className="input-field text-center text-lg font-mono tracking-[0.3em] uppercase py-4"
                      required
                      autoFocus
                      maxLength={12}
                    />
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary w-full !py-4 !text-base !shadow-lg !shadow-brand-500/30">
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>Verify Code <ArrowRight className="w-5 h-5" /></>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <>
                {/* Invite info banner */}
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-brand-50 border border-emerald-200 rounded-xl mb-6">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-800">Invite verified!</p>
                      <p className="text-sm text-emerald-700 mt-1">
                        {invite.orgName && <>Joining <strong>{invite.orgName}</strong> · </>}
                        Role: <strong className="capitalize">{invite.role || 'worker'}</strong>
                      </p>
                    </div>
                  </div>
                </div>

                <h2 className="text-2xl font-display font-bold text-slate-900 mb-2">Create your account</h2>
                <p className="text-slate-600 mb-8">
                  Set up your login to get started.
                </p>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="label">Full Name *</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        name="displayName" value={form.displayName} onChange={handleChange}
                        placeholder="Your full name" className="input-field pl-12 py-3.5" required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Email Address *</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        name="email" type="email" value={form.email} onChange={handleChange}
                        placeholder="you@email.com" className="input-field pl-12 py-3.5" required
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

                  <button type="submit" disabled={loading} className="btn-primary w-full !py-4 !text-base !shadow-lg !shadow-brand-500/30">
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>Create Account & Join <ArrowRight className="w-5 h-5" /></>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="text-center text-slate-600 mt-8">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">Sign In</Link>
            {' · '}
            <Link href="/register" className="font-semibold text-brand-600 hover:text-brand-700">Register Company</Link>
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