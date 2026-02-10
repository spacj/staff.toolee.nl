'use client';
import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkers, getShops, getShifts, getAttendance, getPermits, getActivityLog } from '@/lib/firestore';
import { calculateMonthlyCost, formatCurrency } from '@/lib/pricing';
import { cn } from '@/utils/helpers';
import { Users, Store, Calendar, Clock, TrendingUp, AlertCircle, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

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

  if (!isManager) {
    // Worker dashboard
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="page-title">Welcome, {userProfile?.displayName?.split(' ')[0] || 'there'}</h1>
            <p className="text-surface-500 mt-1">Here's your overview for today.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/time" className="stat-card hover:shadow-md transition-shadow">
              <Clock className="w-5 h-5 text-brand-500" />
              <p className="text-2xl font-display font-bold text-surface-900">Clock In</p>
              <p className="text-xs text-surface-400">Start your shift</p>
            </Link>
            <Link href="/calendar" className="stat-card hover:shadow-md transition-shadow">
              <Calendar className="w-5 h-5 text-emerald-500" />
              <p className="text-2xl font-display font-bold text-surface-900">Schedule</p>
              <p className="text-xs text-surface-400">View shifts</p>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="text-surface-500 mt-1">Overview of your business today.</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-surface-500">Active Staff</p>
              <Users className="w-4 h-4 text-brand-400" />
            </div>
            <p className="text-3xl font-display font-bold text-surface-900">{activeWorkers.length}</p>
            <p className="text-xs text-surface-400">{clockedIn} clocked in now</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-surface-500">Shops</p>
              <Store className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-3xl font-display font-bold text-surface-900">{shops.length}</p>
            <p className="text-xs text-surface-400">locations</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-surface-500">Today's Shifts</p>
              <Calendar className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-display font-bold text-surface-900">{todayShifts}</p>
            <p className="text-xs text-surface-400">scheduled</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-surface-500">Monthly Cost</p>
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-3xl font-display font-bold text-surface-900">{formatCurrency(cost.total)}</p>
            <p className="text-xs text-surface-400">{cost.tierInfo.name} plan</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending permits */}
          <div className="card">
            <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
              <h3 className="section-title">Pending Requests</h3>
              <Link href="/attendance" className="text-xs text-brand-600 font-medium hover:underline">View all</Link>
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

          {/* Recent activity */}
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
