'use client';
import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import PayPalCheckout from '@/components/PayPalCheckout';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkers, getShops, getShifts, getPayments, getOrganization, getPublicHolidays, getOvertimeRules } from '@/lib/firestore';
import { calculateCost, formatCurrency, getTierInfo, FREE_WORKER_LIMIT } from '@/lib/pricing';
import { calculateWorkerCost, calculateWorkerCostWithOvertime } from '@/lib/scheduling';
import { cn } from '@/utils/helpers';
import { CreditCard, TrendingUp, Users, Store, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

function CostsContent() {
  const { orgId, organization, user, isAdmin } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [workers, setWorkers] = useState([]);
  const [shops, setShops] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [orgData, setOrgData] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [overtimeRules, setOvertimeRules] = useState({});
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().slice(0, 7) + '-01',
    endDate: new Date().toISOString().slice(0, 7) + '-31',
    selectedWorkers: [],
    selectedShops: [],
  });

  const startDate = filters.startDate;
  const endDate = filters.endDate;

  const load = () => {
    if (!orgId) return;
    getWorkers({ orgId }).then(setWorkers);
    getShops(orgId).then(setShops);
    getShifts({ orgId, startDate, endDate }).then(setShifts);
    getPayments({ orgId, limit: 20 }).then(setPayments);
    getOrganization(orgId).then(setOrgData);
    getPublicHolidays(orgId).then(setHolidays);
    getOvertimeRules(orgId).then(setOvertimeRules);
  };

  useEffect(() => { load(); }, [orgId, startDate, endDate]);

  useEffect(() => {
    const sub = searchParams.get('subscription');
    if (sub === 'success') {
      toast.success('Subscription activated! PayPal will confirm shortly.');
      setTimeout(() => { load(); router.replace('/costs'); }, 3000);
    } else if (sub === 'cancelled') {
      toast('Subscription setup cancelled.');
      router.replace('/costs');
    }
  }, [searchParams, router]);

  const activeWorkers = workers.filter(w => w.status === 'active');
  const freeLimit = orgData?.freeWorkerLimit || organization?.freeWorkerLimit;
  const cost = useMemo(() => calculateCost(activeWorkers.length, shops.length, 'monthly', freeLimit), [activeWorkers.length, shops.length, freeLimit]);

  const sub = orgData || organization || {};
  const hasActiveSubscription = sub.subscriptionStatus === 'active';
  const hasSuspendedSubscription = sub.subscriptionStatus === 'suspended';
  const hasCancelledSubscription = sub.subscriptionStatus === 'cancelled';
  const subscriptionCycle = sub.subscriptionCycle || 'monthly';
  const subscriptionCost = useMemo(() => {
    if (!hasActiveSubscription && !hasSuspendedSubscription) return null;
    return calculateCost(activeWorkers.length, shops.length, subscriptionCycle, freeLimit);
  }, [activeWorkers.length, shops.length, subscriptionCycle, hasActiveSubscription, hasSuspendedSubscription, freeLimit]);

  const laborCosts = useMemo(() => {
    let filteredWorkers = activeWorkers;
    if (filters.selectedWorkers.length > 0) {
      filteredWorkers = activeWorkers.filter(w => filters.selectedWorkers.includes(w.id));
    }

    let filteredShifts = shifts;
    if (filters.selectedShops.length > 0) {
      filteredShifts = shifts.filter(s => filters.selectedShops.includes(s.shopId));
    }

    return filteredWorkers.map(w => {
      const wShifts = filteredShifts.filter(s => s.workerId === w.id);
      const result = calculateWorkerCostWithOvertime(w, wShifts, overtimeRules, holidays);
      return { ...w, ...result, shifts: wShifts.length };
    });
  }, [activeWorkers, shifts, overtimeRules, holidays, filters]);

  const totalLaborCost = laborCosts.reduce((sum, w) => {
    return sum + (w.type === 'salaried' ? (w.monthlySalary || 0) : (w.totalCost || 0));
  }, 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Costs & Billing</h1>
          <p className="text-sm text-surface-500">Manage subscription, labor costs, and payment history</p>
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Workers</label>
              <select
                multiple
                value={filters.selectedWorkers}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, o => o.value);
                  setFilters(f => ({ ...f, selectedWorkers: values }));
                }}
                className="input-field"
              >
                <option value="">All Workers</option>
                {activeWorkers.map(w => (
                  <option key={w.id} value={w.id}>{w.firstName} {w.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Shops</label>
              <select
                multiple
                value={filters.selectedShops}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, o => o.value);
                  setFilters(f => ({ ...f, selectedShops: values }));
                }}
                className="input-field"
              >
                <option value="">All Shops</option>
                {shops.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {freeLimit && freeLimit > FREE_WORKER_LIMIT && (
          <div className="card p-5 border-l-4 border-l-purple-500 bg-purple-50/30">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-purple-800">
                  Promo Code Active: {sub.promoCode}
                </p>
                <p className="text-xs text-purple-700 mt-1">
                  Your plan includes {freeLimit} free workers instead of the standard {FREE_WORKER_LIMIT}. You only pay from the {freeLimit + 1}th worker onward!
                </p>
              </div>
            </div>
          </div>
        )}

        {(hasActiveSubscription || hasSuspendedSubscription || hasCancelledSubscription) && (
          <div className={cn('card p-5 border-l-4', {
            'border-l-emerald-500 bg-emerald-50/30': hasActiveSubscription,
            'border-l-amber-500 bg-amber-50/30': hasSuspendedSubscription,
            'border-l-red-500 bg-red-50/30': hasCancelledSubscription,
          })}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {hasActiveSubscription && <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />}
                {hasSuspendedSubscription && <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />}
                {hasCancelledSubscription && <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />}
                <div>
                  <p className={cn('text-sm font-semibold', {
                    'text-emerald-800': hasActiveSubscription,
                    'text-amber-800': hasSuspendedSubscription,
                    'text-red-800': hasCancelledSubscription,
                  })}>
                    {hasActiveSubscription && 'Active Subscription'}
                    {hasSuspendedSubscription && 'Suspended Subscription'}
                    {hasCancelledSubscription && 'Cancelled Subscription'}
                  </p>
                  {subscriptionCost && (
                    <p className={cn('text-xs mt-1', {
                      'text-emerald-700': hasActiveSubscription,
                      'text-amber-700': hasSuspendedSubscription,
                      'text-red-700': hasCancelledSubscription,
                    })}>
                      {formatCurrency(subscriptionCost.total)}/{subscriptionCycle} — {subscriptionCost.tier}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!hasActiveSubscription && !hasSuspendedSubscription && isAdmin && (
          <div className="card p-5 border-blue-200 bg-blue-50/30">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-blue-900">Start Your Subscription</p>
                <p className="text-xs text-blue-700 mt-1">Unlock advanced features: attendance tracking, cost analytics, and more.</p>
              </div>
              <button onClick={() => setShowSubscribe(true)} className="btn-primary !text-sm flex-shrink-0 w-full sm:w-auto">
                <CreditCard className="w-4 h-4" /> Subscribe Now
              </button>
            </div>
          </div>
        )}

        {!isAdmin && (
          <div className="card p-5 border-surface-200 bg-surface-50/50">
            <p className="text-sm text-surface-500">Billing and subscription management is restricted to admins. Contact your admin for changes.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-surface-500 uppercase">Active Workers</p>
              <Users className="w-4 h-4 text-brand-500" />
            </div>
            <p className="text-2xl font-display font-bold text-surface-900">{activeWorkers.length}</p>
            <p className="text-xs text-surface-400 mt-1">{workers.filter(w => w.status === 'inactive').length} inactive</p>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-surface-500 uppercase">Shops</p>
              <Store className="w-4 h-4 text-brand-500" />
            </div>
            <p className="text-2xl font-display font-bold text-surface-900">{shops.length}</p>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-surface-500 uppercase">Monthly Tier</p>
              <TrendingUp className="w-4 h-4 text-brand-500" />
            </div>
            <p className="text-2xl font-display font-bold text-surface-900">{getTierInfo(cost.tier).name}</p>
            <p className="text-xs text-surface-400 mt-1">{formatCurrency(cost.total)}/month</p>
          </div>
        </div>

        <div className="card">
          <div className="px-5 py-4 border-b border-surface-100">
            <h3 className="section-title">Cost Breakdown</h3>
          </div>
          <div className="divide-y divide-surface-100">
            <div className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-surface-800">StaffHub Subscription</p>
              </div>
              <p className="text-sm font-semibold text-surface-900">{formatCurrency(cost.total)}</p>
            </div>
            {laborCosts.length > 0 && (
              <div className="px-5 py-3 flex items-center justify-between bg-surface-50">
                <p className="text-sm font-semibold text-surface-800">Total Labor</p>
                <p className="text-sm font-bold text-surface-900">{formatCurrency(totalLaborCost)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="px-5 py-4 border-b border-surface-100">
            <h3 className="section-title">Labor Costs Detail</h3>
            <p className="text-sm text-surface-500">Breakdown by worker including overtime and premiums</p>
          </div>
          <div className="divide-y divide-surface-100">
            {laborCosts.length === 0 ? (
              <p className="p-6 text-sm text-surface-400 text-center">No labor costs for this period.</p>
            ) : (
              laborCosts.map(w => (
                <div key={w.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-semibold text-brand-700">
                          {(w.firstName || '')[0]}{(w.lastName || '')[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-surface-800">{w.firstName} {w.lastName}</p>
                        <p className="text-xs text-surface-500 capitalize">{w.payType} · {w.shifts} shifts · {w.hours?.toFixed(1)}h</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-surface-900">{formatCurrency(w.type === 'salaried' ? w.monthlySalary : w.totalCost)}</p>
                      {w.type === 'hourly' && w.totalCost > w.baseCost && (
                        <p className="text-xs text-amber-600">+{formatCurrency(w.totalCost - w.baseCost)} OT/premium</p>
                      )}
                    </div>
                  </div>
                  {w.type === 'hourly' && w.breakdown && w.breakdown.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {w.breakdown.slice(0, 5).map((day, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-surface-50 p-2 rounded">
                          <span className="text-surface-600">{new Date(day.date).toLocaleDateString()}</span>
                          <div className="flex gap-2">
                            <span>{day.dayHours.toFixed(1)}h</span>
                            {day.isHoliday && <span className="text-purple-600">Holiday</span>}
                            {day.overtimeHours > 0 && <span className="text-amber-600">OT: {day.overtimeHours.toFixed(1)}h</span>}
                            {day.nightPremiumHours > 0 && <span className="text-indigo-600">Night: {day.nightPremiumHours.toFixed(1)}h</span>}
                            {day.earlyPremiumHours > 0 && <span className="text-blue-600">Early: {day.earlyPremiumHours.toFixed(1)}h</span>}
                            <span className="font-medium">{formatCurrency(day.baseCost + day.overtimeCost + day.nightPremiumCost + day.earlyPremiumCost + day.holidayPremiumCost)}</span>
                          </div>
                        </div>
                      ))}
                      {w.breakdown.length > 5 && (
                        <p className="text-xs text-surface-400 text-center">... and {w.breakdown.length - 5} more days</p>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="px-5 py-4 border-b border-surface-100">
            <h3 className="section-title">Payment History</h3>
          </div>
          <div className="divide-y divide-surface-100">
            {payments.length === 0 && <p className="p-6 text-sm text-surface-400 text-center">No payments yet.</p>}
            {payments.map(p => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-surface-800">{p.period || p.createdAt?.slice(0, 10)}</p>
                  <p className="text-xs text-surface-500 mt-0.5">{formatCurrency(p.amount || 0)}</p>
                </div>
                <p className="text-xs text-emerald-600">{p.status || 'Completed'}</p>
              </div>
            ))}
          </div>
        </div>

        {isAdmin && (
          <Modal open={showSubscribe} onClose={() => setShowSubscribe(false)} title="Subscribe to StaffHub" size="lg">
            <PayPalCheckout
              tier={cost.tier}
              workerCount={activeWorkers.length}
              shopCount={shops.length}
              onSuccess={() => { setShowSubscribe(false); load(); }}
            />
          </Modal>
        )}
      </div>
    </Layout>
  );
}

function LoadingFallback() {
  return (
    <Layout>
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    </Layout>
  );
}

export default function CostsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CostsContent />
    </Suspense>
  );
}
