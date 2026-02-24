'use client';
import { Suspense, useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import MonthCarousel from '@/components/MonthCarousel';
import PayPalCheckout from '@/components/PayPalCheckout';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkers, getShops, getShifts, getPayments, getOrganization, getPublicHolidays, getOvertimeRules } from '@/lib/firestore';
import { calculateCost, formatCurrency, getTierInfo, FREE_WORKER_LIMIT } from '@/lib/pricing';
import { calculateWorkerCostWithOvertime } from '@/lib/scheduling';
import { cn } from '@/utils/helpers';
import {
  CreditCard, TrendingUp, Users, Store, CheckCircle, AlertTriangle,
  XCircle, Loader2, Clock, Euro, ChevronDown, ChevronUp, CalendarDays
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ── helpers ─────────────────────────────────────────────── */

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/** Build a prevision (future estimate) based on current worker roster + avg recent hours */
function buildPrevision(activeWorkers, shops, overtimeRules, holidays, freeLimit) {
  // For future months we estimate labor based on each worker's contract hours
  const laborEstimates = activeWorkers.map(w => {
    if (w.payType === 'salaried') {
      return {
        ...w,
        type: 'salaried',
        monthlySalary: w.monthlySalary || 0,
        hours: w.fixedHoursWeek ? w.fixedHoursWeek * 4.33 : 0,
        totalCost: w.monthlySalary || 0,
        baseCost: w.monthlySalary || 0,
        overtimeCost: 0,
        premiumCost: 0,
        shifts: 0,
        breakdown: [],
        isEstimate: true,
      };
    }
    // Hourly: estimate ~4.33 weeks * contractual hours
    const weeklyHours = w.fixedHoursWeek || 0;
    const estHours = weeklyHours * 4.33;
    const rate = w.costPerHour || 0;
    const estCost = estHours * rate;
    return {
      ...w,
      type: 'hourly',
      costPerHour: rate,
      hours: estHours,
      totalCost: estCost,
      baseCost: estCost,
      overtimeCost: 0,
      premiumCost: 0,
      shifts: 0,
      breakdown: [],
      isEstimate: true,
    };
  });

  return laborEstimates;
}

/* ── main content ────────────────────────────────────────── */

function CostsContent() {
  const { orgId, organization, user, isAdmin } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Data state
  const [workers, setWorkers] = useState([]);
  const [shops, setShops] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [orgData, setOrgData] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [overtimeRules, setOvertimeRules] = useState({});
  const [loading, setLoading] = useState(true);

  // UI state
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [expandedWorker, setExpandedWorker] = useState(null);

  // Month carousel state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    return {
      year: y,
      month: m,
      monthName: '',
      startDate: `${y}-${String(m + 1).padStart(2, '0')}-01`,
      endDate: `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      type: 'current',
      isCurrentMonth: true,
      isPast: false,
      isFuture: false,
    };
  });

  // Load base data (workers, shops, org, holidays, overtime rules — independent of month)
  const loadBase = useCallback(() => {
    if (!orgId) return;
    Promise.all([
      getWorkers({ orgId }),
      getShops(orgId),
      getOrganization(orgId),
      getPublicHolidays(orgId),
      getOvertimeRules(orgId),
      getPayments({ orgId, limit: 50 }),
    ]).then(([w, s, o, h, ot, p]) => {
      setWorkers(w);
      setShops(s);
      setOrgData(o);
      setHolidays(h);
      setOvertimeRules(ot);
      setPayments(p);
    });
  }, [orgId]);

  // Load shifts for selected month
  const loadShifts = useCallback(() => {
    if (!orgId) return;
    setLoading(true);
    getShifts({ orgId, startDate: selectedMonth.startDate, endDate: selectedMonth.endDate })
      .then(s => {
        setShifts(s);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [orgId, selectedMonth.startDate, selectedMonth.endDate]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { loadShifts(); }, [loadShifts]);

  // Handle subscription callback
  useEffect(() => {
    const sub = searchParams.get('subscription');
    if (sub === 'success') {
      toast.success('Subscription activated! PayPal will confirm shortly.');
      setTimeout(() => { loadBase(); router.replace('/costs'); }, 3000);
    } else if (sub === 'cancelled') {
      toast('Subscription setup cancelled.');
      router.replace('/costs');
    }
  }, [searchParams, router, loadBase]);

  // Derived data
  const activeWorkers = workers.filter(w => w.status === 'active');
  const freeLimit = orgData?.freeWorkerLimit || organization?.freeWorkerLimit;
  const cost = useMemo(
    () => calculateCost(activeWorkers.length, shops.length, 'monthly', freeLimit),
    [activeWorkers.length, shops.length, freeLimit]
  );

  const sub = orgData || organization || {};
  const hasActiveSubscription = sub.subscriptionStatus === 'active';
  const hasSuspendedSubscription = sub.subscriptionStatus === 'suspended';
  const hasCancelledSubscription = sub.subscriptionStatus === 'cancelled';
  const subscriptionCycle = sub.subscriptionCycle || 'monthly';
  const subscriptionCost = useMemo(() => {
    if (!hasActiveSubscription && !hasSuspendedSubscription) return null;
    return calculateCost(activeWorkers.length, shops.length, subscriptionCycle, freeLimit);
  }, [activeWorkers.length, shops.length, subscriptionCycle, hasActiveSubscription, hasSuspendedSubscription, freeLimit]);

  // Labor costs — actual (past/current) or prevision (future)
  const laborCosts = useMemo(() => {
    if (selectedMonth.isFuture) {
      return buildPrevision(activeWorkers, shops, overtimeRules, holidays, freeLimit);
    }
    // Historical or current month — use actual shifts
    return activeWorkers.map(w => {
      const wShifts = shifts.filter(s => s.workerId === w.id);
      const result = calculateWorkerCostWithOvertime(w, wShifts, overtimeRules, holidays);
      return { ...w, ...result, shifts: wShifts.length, isEstimate: false };
    });
  }, [activeWorkers, shifts, overtimeRules, holidays, selectedMonth.isFuture, shops, freeLimit]);

  const totalLaborCost = laborCosts.reduce((sum, w) => {
    return sum + (w.type === 'salaried' ? (w.monthlySalary || 0) : (w.totalCost || 0));
  }, 0);

  const totalHours = laborCosts.reduce((sum, w) => sum + (w.hours || 0), 0);
  const totalShifts = laborCosts.reduce((sum, w) => sum + (w.shifts || 0), 0);
  const totalOvertimeCost = laborCosts.reduce((sum, w) => sum + (w.overtimeCost || 0), 0);

  // Filter payments to the selected month
  const monthPayments = payments.filter(p => {
    const pDate = p.period || p.createdAt?.slice(0, 10) || '';
    return pDate >= selectedMonth.startDate && pDate <= selectedMonth.endDate;
  });

  const handleMonthChange = useCallback((m) => {
    setSelectedMonth(m);
    setExpandedWorker(null);
  }, []);

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Page header */}
        <div>
          <h1 className="page-title">Costs & Billing</h1>
          <p className="text-sm text-surface-500 hidden sm:block">
            Navigate months to view reports or future previsions
          </p>
        </div>

        {/* ── Month Carousel ── */}
        <div className="card p-4 sm:p-5">
          <MonthCarousel onChange={handleMonthChange} maxFutureMonths={3} />
        </div>

        {/* ── Future month warning banner ── */}
        {selectedMonth.isFuture && (
          <div className="card p-4 border-l-4 border-l-amber-400 bg-amber-50/40">
            <div className="flex items-start gap-2.5">
              <CalendarDays className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Future Prevision</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Labor costs are estimated based on each worker's contract hours. Actual costs may differ.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Promo Code Banner ── */}
        {freeLimit && freeLimit > FREE_WORKER_LIMIT && (
          <div className="card p-4 sm:p-5 border-l-4 border-l-purple-500 bg-purple-50/30">
            <div className="flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-purple-800">
                  Promo: {sub.promoCode}
                </p>
                <p className="text-xs text-purple-700 mt-0.5">
                  {freeLimit} free workers (standard: {FREE_WORKER_LIMIT})
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Subscription Status ── */}
        {(hasActiveSubscription || hasSuspendedSubscription || hasCancelledSubscription) && (
          <div className={cn('card p-4 sm:p-5 border-l-4', {
            'border-l-emerald-500 bg-emerald-50/30': hasActiveSubscription,
            'border-l-amber-500 bg-amber-50/30': hasSuspendedSubscription,
            'border-l-red-500 bg-red-50/30': hasCancelledSubscription,
          })}>
            <div className="flex items-start gap-2.5">
              {hasActiveSubscription && <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />}
              {hasSuspendedSubscription && <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />}
              {hasCancelledSubscription && <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />}
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
                  <p className={cn('text-xs mt-0.5', {
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
        )}

        {/* ── Subscribe CTA ── */}
        {!hasActiveSubscription && !hasSuspendedSubscription && isAdmin && (
          <div className="card p-4 sm:p-5 border-blue-200 bg-blue-50/30">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-blue-900">Start Your Subscription</p>
                <p className="text-xs text-blue-700 mt-1">Unlock attendance tracking, cost analytics, and more.</p>
              </div>
              <button onClick={() => setShowSubscribe(true)} className="btn-primary !text-sm flex-shrink-0 w-full sm:w-auto">
                <CreditCard className="w-4 h-4" /> Subscribe Now
              </button>
            </div>
          </div>
        )}

        {!isAdmin && (
          <div className="card p-4 border-surface-200 bg-surface-50/50">
            <p className="text-xs text-surface-500">Billing management is restricted to admins.</p>
          </div>
        )}

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Workers"
            value={activeWorkers.length}
            sub={`${workers.filter(w => w.status === 'inactive').length} inactive`}
            icon={Users}
          />
          <StatCard
            label="Total Hours"
            value={totalHours.toFixed(0)}
            sub={`${totalShifts} shifts`}
            icon={Clock}
            estimated={selectedMonth.isFuture}
          />
          <StatCard
            label="Labor Cost"
            value={formatCurrency(totalLaborCost)}
            sub={totalOvertimeCost > 0 ? `incl. ${formatCurrency(totalOvertimeCost)} OT` : 'No overtime'}
            icon={Euro}
            estimated={selectedMonth.isFuture}
          />
          <StatCard
            label="Platform"
            value={formatCurrency(cost.total)}
            sub={`${getTierInfo(cost.tier).name} plan`}
            icon={TrendingUp}
          />
        </div>

        {/* ── Cost Breakdown ── */}
        <div className="card overflow-hidden">
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-surface-100">
            <h3 className="section-title">Cost Breakdown</h3>
          </div>
          <div className="divide-y divide-surface-100">
            <BreakdownRow label="StaffHub Subscription" value={formatCurrency(cost.total)} />
            {cost.workerCost > 0 && (
              <BreakdownRow
                label={`Workers (${activeWorkers.length - (freeLimit || FREE_WORKER_LIMIT)} billable)`}
                value={formatCurrency(cost.workerCost)}
                indent
              />
            )}
            {cost.shopCost > 0 && (
              <BreakdownRow
                label={`Extra shops (${shops.length - 1})`}
                value={formatCurrency(cost.shopCost)}
                indent
              />
            )}
            <BreakdownRow
              label={`Labor (${selectedMonth.isFuture ? 'estimated' : 'actual'})`}
              value={formatCurrency(totalLaborCost)}
            />
            {totalOvertimeCost > 0 && (
              <BreakdownRow label="Overtime & Premiums" value={formatCurrency(totalOvertimeCost)} indent accent />
            )}
            <div className="px-4 sm:px-5 py-3 flex items-center justify-between bg-surface-50">
              <p className="text-sm font-bold text-surface-900">
                Total Monthly Cost {selectedMonth.isFuture && '(est.)'}
              </p>
              <p className="text-sm font-bold text-surface-900">
                {formatCurrency(cost.total + totalLaborCost)}
              </p>
            </div>
          </div>
        </div>

        {/* ── Labor Detail ── */}
        {loading ? (
          <div className="card p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-surface-100">
              <h3 className="section-title">Labor Detail</h3>
              <p className="text-xs text-surface-500 mt-0.5">
                {selectedMonth.isFuture
                  ? 'Estimated from contract hours'
                  : 'Per-worker breakdown with overtime & premiums'}
              </p>
            </div>
            <div className="divide-y divide-surface-100">
              {laborCosts.length === 0 ? (
                <p className="p-6 text-sm text-surface-400 text-center">
                  {selectedMonth.isFuture ? 'No active workers to forecast.' : 'No labor data for this month.'}
                </p>
              ) : (
                laborCosts.map(w => (
                  <WorkerRow
                    key={w.id}
                    worker={w}
                    expanded={expandedWorker === w.id}
                    onToggle={() => setExpandedWorker(expandedWorker === w.id ? null : w.id)}
                    isFuture={selectedMonth.isFuture}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Payment History ── */}
        <div className="card overflow-hidden">
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-surface-100">
            <h3 className="section-title">Payment History</h3>
          </div>
          <div className="divide-y divide-surface-100">
            {monthPayments.length === 0 && (
              <p className="p-6 text-sm text-surface-400 text-center">
                {selectedMonth.isFuture ? 'No payments expected yet.' : 'No payments this month.'}
              </p>
            )}
            {monthPayments.map(p => (
              <div key={p.id} className="px-4 sm:px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-surface-800">{p.period || p.createdAt?.slice(0, 10)}</p>
                  <p className="text-xs text-surface-500 mt-0.5">{formatCurrency(p.amount || 0)}</p>
                </div>
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', {
                  'bg-emerald-100 text-emerald-700': (p.status || 'completed') === 'completed',
                  'bg-amber-100 text-amber-700': p.status === 'pending',
                  'bg-red-100 text-red-700': p.status === 'failed',
                })}>
                  {p.status || 'Completed'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Subscribe Modal ── */}
        {isAdmin && (
          <Modal open={showSubscribe} onClose={() => setShowSubscribe(false)} title="Subscribe to StaffHub" size="lg">
            <PayPalCheckout
              tier={cost.tier}
              workerCount={activeWorkers.length}
              shopCount={shops.length}
              onSuccess={() => { setShowSubscribe(false); loadBase(); }}
            />
          </Modal>
        )}
      </div>
    </Layout>
  );
}

/* ── Sub-components ──────────────────────────────────────── */

function StatCard({ label, value, sub, icon: Icon, estimated }) {
  return (
    <div className="card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] sm:text-xs font-medium text-surface-500 uppercase tracking-wide">{label}</p>
        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-500" />
      </div>
      <p className="text-lg sm:text-2xl font-display font-bold text-surface-900 truncate">{value}</p>
      <p className="text-[10px] sm:text-xs text-surface-400 mt-0.5 truncate">
        {estimated && <span className="text-amber-500 mr-1">~</span>}
        {sub}
      </p>
    </div>
  );
}

function BreakdownRow({ label, value, indent, accent }) {
  return (
    <div className={cn('px-4 sm:px-5 py-2.5 flex items-center justify-between', indent && 'pl-8 sm:pl-10')}>
      <p className={cn('text-sm', indent ? 'text-surface-500' : 'font-medium text-surface-800')}>
        {label}
      </p>
      <p className={cn('text-sm font-semibold', accent ? 'text-amber-600' : 'text-surface-900')}>
        {value}
      </p>
    </div>
  );
}

function WorkerRow({ worker: w, expanded, onToggle, isFuture }) {
  const workerCost = w.type === 'salaried' ? (w.monthlySalary || 0) : (w.totalCost || 0);
  const hasBreakdown = !isFuture && w.type === 'hourly' && w.breakdown && w.breakdown.length > 0;
  const hasOT = w.type === 'hourly' && w.totalCost > w.baseCost;

  return (
    <div className="group">
      {/* Main row */}
      <button
        className="w-full px-4 sm:px-5 py-3 sm:py-4 flex items-center gap-3 text-left hover:bg-surface-50/50 transition-colors"
        onClick={hasBreakdown ? onToggle : undefined}
        disabled={!hasBreakdown}
      >
        {/* Avatar */}
        <div className="w-8 h-8 sm:w-9 sm:h-9 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-semibold text-brand-700">
            {(w.firstName || '')[0]}{(w.lastName || '')[0]}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-surface-800 truncate">
            {w.firstName} {w.lastName}
          </p>
          <p className="text-[11px] text-surface-500 truncate">
            {w.payType === 'salaried' ? 'Salaried' : `${formatCurrency(w.costPerHour || 0)}/h`}
            {!isFuture && <span> · {w.shifts} shifts · {(w.hours || 0).toFixed(1)}h</span>}
            {isFuture && w.hours > 0 && <span> · ~{(w.hours).toFixed(0)}h est.</span>}
          </p>
        </div>

        {/* Cost */}
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold text-surface-900">
            {isFuture && '~'}{formatCurrency(workerCost)}
          </p>
          {hasOT && !isFuture && (
            <p className="text-[11px] text-amber-600">+{formatCurrency(w.totalCost - w.baseCost)} OT</p>
          )}
        </div>

        {/* Expand chevron */}
        {hasBreakdown && (
          <div className="flex-shrink-0 ml-1">
            {expanded
              ? <ChevronUp className="w-4 h-4 text-surface-400" />
              : <ChevronDown className="w-4 h-4 text-surface-300 group-hover:text-surface-400" />
            }
          </div>
        )}
      </button>

      {/* Expanded daily breakdown */}
      {expanded && hasBreakdown && (
        <div className="px-4 sm:px-5 pb-3 pt-0">
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {w.breakdown.map((day, idx) => {
              const dayCost = (day.baseCost || 0) + (day.overtimeCost || 0) + (day.overtime2Cost || 0)
                + (day.nightPremiumCost || 0) + (day.earlyPremiumCost || 0) + (day.holidayPremiumCost || 0);
              return (
                <div key={idx} className="flex items-center justify-between text-[11px] bg-surface-50 p-2 rounded-lg gap-2">
                  <span className="text-surface-600 flex-shrink-0 w-20">
                    {new Date(day.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 flex-1 justify-end">
                    <span className="text-surface-600">{day.dayHours.toFixed(1)}h</span>
                    {day.isWeekend && <span className="text-blue-600 font-medium">WE</span>}
                    {day.isHoliday && <span className="text-purple-600 font-medium">HOL</span>}
                    {day.overtimeHours > 0 && <span className="text-amber-600">OT {day.overtimeHours.toFixed(1)}h</span>}
                    {day.overtime2Hours > 0 && <span className="text-red-600">DT {day.overtime2Hours.toFixed(1)}h</span>}
                    {day.nightPremiumHours > 0 && <span className="text-indigo-600">Night {day.nightPremiumHours.toFixed(1)}h</span>}
                    {day.earlyPremiumHours > 0 && <span className="text-blue-600">Early {day.earlyPremiumHours.toFixed(1)}h</span>}
                    <span className="font-semibold text-surface-800">{formatCurrency(dayCost)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Loading fallback & page export ──────────────────────── */

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
