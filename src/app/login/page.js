'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Mail, Lock, Eye, EyeOff, ArrowRight, Building, UserPlus, Users, Clock, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signInWithGoogle, isWebmaster } = useAuth();
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
      {/* Left — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 w-80 h-80 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-[500px] h-[500px] bg-brand-300 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between px-16 py-12">
          <Link href="/" className="flex items-center gap-3 w-fit">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-display font-bold text-white tracking-tight leading-none">StaffHub</span>
              <span className="text-xs text-brand-200">by toolee.nl</span>
            </div>
          </Link>
          
          <div>
            <h1 className="text-5xl font-display font-bold text-white leading-tight mb-6">
              Manage your team<br />with confidence
            </h1>
            <p className="text-lg text-brand-200 max-w-md leading-relaxed mb-12">
              Schedule shifts, track attendance, manage costs and empower your team — all in one beautifully designed platform.
            </p>
            <div className="grid grid-cols-3 gap-5">
              {[
                { icon: Users, label: 'Smart Scheduling', desc: 'AI-powered planning' },
                { icon: Clock, label: 'Time Tracking', desc: 'Clock in/out anywhere' },
                { icon: BarChart3, label: 'Cost Analytics', desc: 'Real-time insights' },
              ].map((item) => (
                <div key={item.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/10">
                  <item.icon className="w-6 h-6 text-brand-200 mb-3" />
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <p className="text-xs text-brand-300 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
          
          <div className="text-brand-200 text-sm">
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

          <div className="mb-8">
            <h2 className="text-3xl font-display font-bold text-slate-900 mb-2">Welcome back</h2>
            <p className="text-slate-600">Sign in to your StaffHub account</p>
          </div>

          <button onClick={handleGoogleSignIn} disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm mb-6">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">or sign in with email</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@company.com" className="input-field pl-12 py-3.5" required />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleChange} placeholder="Enter your password" className="input-field pl-12 pr-12 py-3.5" required minLength={6} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full !py-4 !text-base !shadow-lg !shadow-brand-500/30">
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <>Sign In <ArrowRight className="w-5 h-5" /></>}
            </button>
          </form>

          <div className="mt-8 space-y-4">
            <div className="p-5 bg-white border border-slate-200 rounded-xl hover:border-brand-300 hover:shadow-md transition-all">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
                  <Building className="w-5 h-5 text-brand-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">New company?</p>
                  <p className="text-sm text-slate-500 mt-1">Register your company and become the admin.</p>
                  <Link href="/register" className="text-sm font-semibold text-brand-600 hover:text-brand-700 mt-2 inline-flex items-center gap-1">
                    Register your company <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
            <div className="p-5 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:shadow-md transition-all">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <UserPlus className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">Got an invite code?</p>
                  <p className="text-sm text-slate-500 mt-1">Your admin gave you a code to join the team.</p>
                  <Link href="/join" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 mt-2 inline-flex items-center gap-1">
                    Join with invite code <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
          
          <div className="lg:hidden mt-8 pt-6 border-t border-slate-200 flex flex-col items-center gap-3 text-sm text-slate-500">
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