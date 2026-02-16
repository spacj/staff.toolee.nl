'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Mail, Lock, Eye, EyeOff, ArrowRight, Building, UserPlus, Users, Clock, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signInWithGoogle } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(form.email, form.password);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (err) {
      const msgs = { 'auth/invalid-credential': 'Invalid email or password', 'auth/user-not-found': 'No account found', 'auth/wrong-password': 'Incorrect password', 'auth/too-many-requests': 'Too many attempts. Try again later.' };
      toast.error(msgs[err.code] || err.message || 'Sign-in failed');
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      toast.success('Welcome!');
      router.push('/dashboard');
    } catch (err) {
      if (err.message === 'NO_PROFILE') toast.error('No account found. Register a company or use an invite code.');
      else toast.error('Google sign-in failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — branding (no prices) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-brand-300 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-3xl font-display font-bold text-white tracking-tight">StaffHub</span>
          </div>
          <h1 className="text-5xl font-display font-bold text-white leading-tight mb-6">
            Manage your team<br />with confidence
          </h1>
          <p className="text-lg text-brand-200 max-w-md leading-relaxed">
            Schedule shifts, track attendance, manage costs and empower your team — all in one beautifully designed platform.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-5">
            {[
              { icon: Users, label: 'Smart Scheduling', desc: 'AI-powered shift planning' },
              { icon: Clock, label: 'Time Tracking', desc: 'Clock in/out anywhere' },
              { icon: BarChart3, label: 'Cost Analytics', desc: 'Real-time insights' },
            ].map((item) => (
              <div key={item.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <item.icon className="w-5 h-5 text-brand-200 mb-2" />
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="text-xs text-brand-300 mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-surface-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-display font-bold text-surface-900">StaffHub</span>
          </div>

          <h2 className="text-2xl font-display font-bold text-surface-900 mb-2">Welcome back</h2>
          <p className="text-surface-500 mb-8">Sign in to your StaffHub account</p>

          <button onClick={handleGoogleSignIn} disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-surface-200 rounded-xl text-sm font-medium text-surface-700 hover:bg-surface-50 hover:border-surface-300 transition-all shadow-card">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Sign in with Google
          </button>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-surface-200" />
            <span className="text-xs text-surface-400 font-medium">or sign in with email</span>
            <div className="flex-1 h-px bg-surface-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@company.com" className="input-field pl-10" required />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleChange} placeholder="••••••••" className="input-field pl-10 pr-10" required minLength={6} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="mt-8 space-y-3">
            <div className="p-4 bg-white border border-surface-200 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0"><Building className="w-4 h-4 text-brand-600" /></div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-surface-800">New company?</p>
                  <p className="text-xs text-surface-500 mt-0.5">Register your company and become the admin.</p>
                  <Link href="/register" className="text-xs font-semibold text-brand-600 hover:text-brand-700 mt-1.5 inline-block">Register your company →</Link>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white border border-surface-200 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0"><UserPlus className="w-4 h-4 text-emerald-600" /></div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-surface-800">Got an invite code?</p>
                  <p className="text-xs text-surface-500 mt-0.5">Your admin gave you a code to join the team.</p>
                  <Link href="/join" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 mt-1.5 inline-block">Join with invite code →</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
