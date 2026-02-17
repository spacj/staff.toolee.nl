'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import TopBar from './TopBar';
import AIAssistant from './AIAssistant';
import SubscriptionAlert from './SubscriptionAlert';
import useStore from '@/lib/store';
import { getWorkers, getShops, getShifts, getAttendance } from '@/lib/firestore';

const PUBLIC_PATHS = ['/login', '/register', '/join', '/'];

export default function Layout({ children }) {
  const { user, userProfile, loading, isManager, orgId } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useStore();
  const [aiContext, setAiContext] = useState(null);

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) { router.push('/login'); return; }
    if (user && !userProfile && !isPublic) {
      const timer = setTimeout(() => { if (!userProfile) router.push('/login'); }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user, userProfile, loading, pathname, router, isPublic]);

  // Load AI context data for managers
  useEffect(() => {
    if (!isManager || !orgId) return;
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    Promise.all([
      getWorkers({ orgId }).catch(() => []),
      getShops(orgId).catch(() => []),
      getShifts({ orgId, startDate: weekAgo, endDate: today }).catch(() => []),
      getAttendance({ orgId, startDate: weekAgo, endDate: today, limit: 200 }).catch(() => []),
    ]).then(([workers, shops, shifts, attendance]) => {
      const active = workers.filter(w => w.status === 'active');
      setAiContext({
        workerCount: active.length,
        shopCount: shops.length,
        schedule: {
          totalShiftsThisWeek: shifts.length,
          totalHours: shifts.reduce((s, sh) => s + (sh.hours || 0), 0),
          workers: active.map(w => ({
            name: `${w.firstName} ${w.lastName}`,
            pref: w.shiftPreference || 'any',
            type: w.payType,
            hoursTarget: w.payType === 'salaried' ? w.fixedHoursWeek : w.contractedHours,
            shifts: shifts.filter(s => s.workerId === w.id).length,
          })),
          shops: shops.map(s => s.name),
        },
        insights: {
          workers: active.length,
          attendance: {
            total: attendance.length,
            approved: attendance.filter(a => a.approvalStatus === 'approved').length,
            pending: attendance.filter(a => a.approvalStatus === 'pending').length,
            avgHours: attendance.length > 0 ? (attendance.reduce((s, a) => s + (a.totalHours || 0), 0) / attendance.length).toFixed(1) : 0,
          },
          payTypes: { salaried: active.filter(w => w.payType === 'salaried').length, hourly: active.filter(w => w.payType === 'hourly').length },
          shifts: { thisWeek: shifts.length },
        },
      });
    });
  }, [isManager, orgId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-surface-500 font-medium">Loading StaffHub...</p>
        </div>
      </div>
    );
  }

  if (user && !userProfile && !isPublic) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-surface-500 font-medium">Setting up your account...</p>
        </div>
      </div>
    );
  }

  if (!user || !userProfile) return null;

  return (
    <div className="flex h-screen bg-surface-50 overflow-hidden">
      <aside className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar />
      </aside>

      {sidebarOpen && (
        <>
          <div className="overlay lg:hidden" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar mobile onClose={() => setSidebarOpen(false)} />
          </aside>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <SubscriptionAlert />
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-6">
            {children}
          </div>
        </main>
        <MobileNav />
      </div>

      {/* AI Assistant — managers/admins only */}
      {isManager && <AIAssistant contextData={aiContext} />}
    </div>
  );
}
