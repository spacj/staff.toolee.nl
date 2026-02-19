'use client';
import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkers, getShops, getShifts, getAttendance, getPermits, getActivityLog, getCorrectionRequests, getMessages, updatePermit, reviewCorrectionRequest, notifyWorker } from '@/lib/firestore';
import { calculateMonthlyCost, formatCurrency } from '@/lib/pricing';
import { cn } from '@/utils/helpers';
import { Users, Store, Calendar, Clock, TrendingUp, AlertCircle, CheckCircle, ArrowRight, Sparkles, BarChart3, MessageCircle, AlertTriangle, XCircle } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const STAT_STYLES = [
  { bg: 'bg-gradient-to-br from-brand-500 to-brand-700', icon: 'text-white/80', text: 'text-white', sub: 'text-white/60' },
  { bg: 'bg-gradient-to-br from-purple-500 to-purple-700', icon: 'text-white/80', text: 'text-white', sub: 'text-white/60' },
  { bg: 'bg-gradient-to-br from-emerald-500 to-emerald-700', icon: 'text-white/80', text: 'text-white', sub: 'text-white/60' },
  { bg: 'bg-gradient-to-br from-amber-500 to-amber-700', icon: 'text-white/80', text: 'text-white', sub: 'text-white/60' },
];

export default function DashboardPage() {
  const { orgId, isManager, userProfile, user } = useAuth();
  const [workers, setWorkers] = useState([]);
  const [shops, setShops] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [permits, setPermits] = useState([]);
  const [activity, setActivity] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loadingAction, setLoadingAction] = useState(null);

  // Quick approve/deny handlers
  const handlePermitAction = async (id, status) => {
    setLoadingAction(`permit-${id}`);
    try {
      await updatePermit(id, { status, reviewedBy: user?.uid, reviewedAt: new Date().toISOString() });
      const permit = permits.find(p => p.id === id);
      if (permit?.workerId) {
        await notifyWorker(permit.workerId, orgId, { type: 'permit_response', title: `Leave ${status}`, message: `Your ${permit.type} request for ${permit.startDate} has been ${status}.`, link: '/time' }).catch(() => {});
      }
      toast.success(`Leave ${status}`);
      // Refresh data
      getPermits({ orgId, status: 'pending', limit: 10 }).then(setPermits).catch(() => {});
    } catch (err) { toast.error(err.message); }
    setLoadingAction(null);
  };

  const handleCorrectionAction = async (id, approved) => {
    setLoadingAction(`correction-${id}`);
    try {
      await reviewCorrectionRequest(id, approved, user?.uid, '');
      const correction = corrections.find(c => c.id === id);
      if (correction?.workerId) {
        await notifyWorker(correction.workerId, orgId, { type: 'correction_response', title: `Correction ${approved ? 'approved' : 'rejected'}`, message: `Your time correction for ${correction.date} has been ${approved ? 'approved' : 'rejected'}.`, link: '/time' }).catch(() => {});
      }
      toast.success(`Correction ${approved ? 'approved' : 'rejected'}`);
      // Refresh data
      getCorrectionRequests({ orgId, status: 'pending', limit: 20 }).then(setCorrections).catch(() => setCorrections([]));
    } catch (err) { toast.error(err.message); }
    setLoadingAction(null);
  };

  // Resolve worker ID for worker-specific queries
  const resolveWorkerId = useMemo(async () => {
    if (!user || !orgId) return null;
    if (userProfile?.workerId) return userProfile.workerId;
    try {
      const allWorkers = await getWorkers({ orgId });
      const match = allWorkers.find(w => w.email === userProfile?.email && w.status === 'active');
      if (match) return match.id;
    } catch (e) {}
    return user.uid;
  }, [user, userProfile, orgId]);

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

  // Fetch manager-specific notifications
  useEffect(() => {
    if (!orgId || !isManager) return;
    getCorrectionRequests({ orgId, status: 'pending', limit: 20 }).then(setCorrections).catch(() => setCorrections([]));
    getMessages({ orgId, limit: 50 }).then(all => {
      const unread = all.filter(m => !m.read && m.recipientType === 'management');
      setMessages(unread);
    }).catch(() => setMessages([]));
  }, [orgId, isManager]);

  const activeWorkers = workers.filter(w => w.status === 'active');
  const cost = useMemo(() => calculateMonthlyCost(activeWorkers.length, shops.length), [activeWorkers.length, shops.length]);
  const clockedIn = attendance.filter(a => a.status === 'clocked-in').length;
  const todayShifts = shifts.length;
  const firstName = userProfile?.displayName?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const pendingCorrections = corrections.filter(c => c.status === 'pending');
  const unreadWorkerMessages = messages.filter(m => !m.read && m.recipientId !== user?.uid);

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
            <Link href="/time" className="card-hover p-5 flex flex-col items-center text-center gap-2 relative">
              <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center"><Clock className="w-6 h-6 text-brand-600" /></div>
              <p className="text-sm font-semibold text-surface-800">Clock In/Out</p>
              <p className="text-xs text-surface-400">Start your shift</p>
            </Link>
            <Link href="/calendar" className="card-hover p-5 flex flex-col items-center text-center gap-2 relative">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center"><Calendar className="w-6 h-6 text-emerald-600" /></div>
              <p className="text-sm font-semibold text-surface-800">My Schedule</p>
              <p className="text-xs text-surface-400">View your shifts</p>
            </Link>
            <Link href="/time#corrections" className="card-hover p-5 flex flex-col items-center text-center gap-2 relative">
              {pendingCorrections.length > 0 && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full" />}
              <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center"><AlertTriangle className="w-6 h-6 text-amber-600" /></div>
              <p className="text-sm font-semibold text-surface-800">Report Issue</p>
              <p className="text-xs text-surface-400">Missed clock-in/out</p>
            </Link>
            <Link href="/time#messages" className="card-hover p-5 flex flex-col items-center text-center gap-2 relative">
              {unreadWorkerMessages.length > 0 && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full" />}
              <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center"><MessageCircle className="w-6 h-6 text-purple-600" /></div>
              <p className="text-sm font-semibold text-surface-800">Messages</p>
              <p className="text-xs text-surface-400">Contact management</p>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const pendingCorrectionCount = corrections.length;
  const unreadMessageCount = messages.length;
  const pendingPermitCount = permits.length;

  // Stats for manager
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
            { href: '/staff', icon: Users, label: 'Add Staff', color: 'bg-brand-100 text-brand-600', badge: 0 },
            { href: '/calendar', icon: Calendar, label: 'Schedule', color: 'bg-emerald-100 text-emerald-600', badge: 0 },
            { href: '/attendance', icon: Clock, label: 'Attendance', color: 'bg-purple-100 text-purple-600', badge: pendingPermitCount + pendingCorrectionCount + unreadMessageCount },
            { href: '/costs', icon: BarChart3, label: 'Analytics', color: 'bg-amber-100 text-amber-600', badge: 0 },
          ].map(a => (
            <Link key={a.href} href={a.href} className="card-hover p-4 flex items-center gap-3 relative">
              {a.badge > 0 && <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">{a.badge > 9 ? '9+' : a.badge}</div>}
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
              <h3 className="section-title">Pending Requests {(pendingPermitCount + pendingCorrectionCount) > 0 && <span className="ml-2 bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">{pendingPermitCount + pendingCorrectionCount}</span>}</h3>
              <Link href="/attendance" className="text-xs text-brand-600 font-semibold hover:underline flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
            </div>
            <div className="divide-y divide-surface-100 max-h-64 overflow-y-auto">
              {permits.length === 0 && corrections.length === 0 && <p className="p-5 text-sm text-surface-400 text-center">No pending requests</p>}
              {permits.slice(0, 3).map(p => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-surface-800 truncate">{p.workerName}</p>
                    <p className="text-xs text-surface-400 capitalize">{p.type} · {p.startDate}{p.endDate !== p.startDate ? ` → ${p.endDate}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button onClick={() => handlePermitAction(p.id, 'approved')} disabled={loadingAction === `permit-${p.id}`} className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 disabled:opacity-50"><CheckCircle className="w-4 h-4" /></button>
                    <button onClick={() => handlePermitAction(p.id, 'denied')} disabled={loadingAction === `permit-${p.id}`} className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50"><XCircle className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
              {corrections.slice(0, 3).map(c => (
                <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-surface-800 truncate">{c.workerName}</p>
                    <p className="text-xs text-surface-400 capitalize">{c.type?.replace(/_/g, ' ')} · {c.date}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button onClick={() => handleCorrectionAction(c.id, true)} disabled={loadingAction === `correction-${c.id}`} className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 disabled:opacity-50"><CheckCircle className="w-4 h-4" /></button>
                    <button onClick={() => handleCorrectionAction(c.id, false)} disabled={loadingAction === `correction-${c.id}`} className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50"><XCircle className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div className="card">
            <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
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

          {/* Unread Messages */}
          {unreadMessageCount > 0 && (
            <div className="card border-red-200">
              <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between bg-red-50 -mx-5 -mt-6 px-5 pt-4">
                <h3 className="section-title flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-red-500" />
                  Unread Messages <span className="ml-1 bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">{unreadMessageCount}</span>
                </h3>
                <Link href="/attendance?tab=messages" className="text-xs text-red-600 font-semibold hover:underline flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
              </div>
              <div className="divide-y divide-surface-100 max-h-64 overflow-y-auto">
                {messages.slice(0, 5).map(m => (
                  <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-surface-800">{m.subject}</p>
                      <p className="text-xs text-surface-400">From: {m.senderName}</p>
                    </div>
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
