'use client';
import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkers, getShops, getShifts, getAttendance, getPermits, getActivityLog } from '@/lib/firestore';
import { calculateMonthlyCost, formatCurrency } from '@/lib/pricing';
import { cn } from '@/utils/helpers';
import { Users, Store, Calendar, Clock, TrendingUp, AlertCircle, CheckCircle, ArrowRight, Sparkles, BarChart3 } from 'lucide-react';
import Link from 'next/link';

const STAT_STYLES = [
  { bg: 'bg-gradient-to-br from-brand-500 to-brand-700', icon: 'text-white/80', text: 'text-white', sub: 'text-white/60' },
  { bg: 'bg-gradient-to-br from-purple-500 to-purple-700', icon: 'text-white/80', text: 'text-white', sub: 'text-white/60' },
  { bg: 'bg-gradient-to-br from-emerald-500 to-emerald-700', icon: 'text-white/80', text: 'text-white', sub: 'text-white/60' },
  { bg: 'bg-gradient-to-br from-amber-500 to-amber-700', icon: 'text-white/80', text: 'text-white', sub: 'text-white/60' },
];

export default function DashboardPage() {
  const { orgId, isManager, userProfile } = useAuth();
  const [workers, setWorkers] = useState([]);
  const [shops, setShops] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [permits, setPermits] = useState([]);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    if (!orgId) return;
    const today = new Date().toISOString().split('T')[0];
    getWorkers({ orgId }).then(setWorkers);
    getShops(orgId).then(setShops);
    getShifts({ orgId, startDate: today, endDate: today }).then(setShifts);
    getAttendance({ orgId, startDate: today, endDate: today, limit: 50 }).then(setAttendance);
    getPermits({ orgId, status: 'pending', limit: 10 }).then(setPermits);
    getActivityLog(8).then(setActivity);
  }, [orgId]);

  const activeWorkers = workers.filter(w => w.status === 'active');
  const cost = useMemo(() => calculateMonthlyCost(activeWorkers.length, shops.length), [activeWorkers.length, shops.length]);
  const clockedIn = attendance.filter(a => a.status === 'clocked-in').length;
  const todayShifts = shifts.length;
  const firstName = userProfile?.displayName?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (!isManager) {
    return (
      <Layout>
        <div className="space-y-6 animate-stagger">
          <div className="bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 rounded-2xl p-6 sm:p-8 text-white">
            <p className="text-brand-200 text-sm font-medium">{greeting}</p>
            <h1 className="text-2xl sm:text-3xl font-display font-bold mt-1">{firstName}</h1>
            <p className="text-brand-200 mt-2">Ready for your shift?</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/time" className="card-hover p-5 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center"><Clock className="w-6 h-6 text-brand-600" /></div>
              <p className="text-sm font-semibold text-surface-800">Clock In/Out</p>
              <p className="text-xs text-surface-400">Start your shift</p>
            </Link>
            <Link href="/calendar" className="card-hover p-5 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center"><Calendar className="w-6 h-6 text-emerald-600" /></div>
              <p className="text-sm font-semibold text-surface-800">My Schedule</p>
              <p className="text-xs text-surface-400">View your shifts</p>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const stats = [
    { label: 'Active Staff', value: activeWorkers.length, sub: `${clockedIn} clocked in`, icon: Users },
    { label: 'Shops', value: shops.length, sub: 'locations', icon: Store },
    { label: "Today's Shifts", value: todayShifts, sub: 'scheduled', icon: Calendar },
    { label: 'Monthly Cost', value: formatCurrency(cost.total), sub: `${cost.tierInfo.name} plan`, icon: TrendingUp },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Welcome */}
        <div className="bg-gradient-to-br from-surface-900 via-surface-800 to-brand-900 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-brand-400 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-400 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10">
            <p className="text-white/50 text-sm font-medium">{greeting}</p>
            <h1 className="text-2xl sm:text-3xl font-display font-bold mt-1">{firstName}</h1>
            <p className="text-white/60 mt-1">Here's what's happening today</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-stagger">
          {stats.map((s, i) => (
            <div key={s.label} className={cn('rounded-2xl p-5 flex flex-col gap-2 shadow-lg', STAT_STYLES[i].bg)}>
              <div className="flex items-center justify-between">
                <p className={cn('text-sm font-medium', STAT_STYLES[i].sub)}>{s.label}</p>
                <s.icon className={cn('w-4.5 h-4.5', STAT_STYLES[i].icon)} />
              </div>
              <p className={cn('text-3xl font-display font-bold', STAT_STYLES[i].text)}>{s.value}</p>
              <p className={cn('text-xs', STAT_STYLES[i].sub)}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/staff', icon: Users, label: 'Add Staff', color: 'bg-brand-100 text-brand-600' },
            { href: '/calendar', icon: Calendar, label: 'Schedule', color: 'bg-emerald-100 text-emerald-600' },
            { href: '/attendance', icon: Clock, label: 'Attendance', color: 'bg-purple-100 text-purple-600' },
            { href: '/costs', icon: BarChart3, label: 'Analytics', color: 'bg-amber-100 text-amber-600' },
          ].map(a => (
            <Link key={a.href} href={a.href} className="card-hover p-4 flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', a.color)}>
                <a.icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-surface-700">{a.label}</span>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending */}
          <div className="card">
            <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
              <h3 className="section-title">Pending Requests</h3>
              <Link href="/attendance" className="text-xs text-brand-600 font-semibold hover:underline flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
            </div>
            <div className="divide-y divide-surface-100">
              {permits.length === 0 && <p className="p-5 text-sm text-surface-400 text-center">No pending requests</p>}
              {permits.slice(0, 5).map(p => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-surface-800">{p.workerName}</p>
                    <p className="text-xs text-surface-400 capitalize">{p.type} · {p.startDate}{p.endDate !== p.startDate ? ` → ${p.endDate}` : ''}</p>
                  </div>
                  <span className="badge bg-amber-100 text-amber-700">Pending</span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div className="card">
            <div className="px-5 py-4 border-b border-surface-100">
              <h3 className="section-title">Recent Activity</h3>
            </div>
            <div className="divide-y divide-surface-100">
              {activity.length === 0 && <p className="p-5 text-sm text-surface-400 text-center">No recent activity</p>}
              {activity.slice(0, 6).map(a => (
                <div key={a.id} className="px-5 py-3">
                  <p className="text-sm text-surface-700">{a.message || a.action}</p>
                  <p className="text-xs text-surface-400">{a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
