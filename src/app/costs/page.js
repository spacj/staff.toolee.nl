'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import PayPalCheckout from '@/components/PayPalCheckout';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkers, getShops, getShifts, getPayments, getOrganization } from '@/lib/firestore';
import { calculateCost, formatCurrency, getTierInfo, TIERS, calculateMonthlyCost } from '@/lib/pricing';
import { calculateWorkerCost } from '@/lib/scheduling';
import { cn } from '@/utils/helpers';
import {
  CreditCard, TrendingUp, Users, Store, ArrowUpRight, CheckCircle, AlertTriangle,
  XCircle, Clock, Zap, RefreshCw, ExternalLink, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

function CostsContent() {
  const { orgId, organization, isAdmin, user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [workers, setWorkers] = useState([]);
  const [shops, setShops] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [orgData, setOrgData] = useState(null);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [planConfig, setPlanConfig] = useState(null);
  const [planConfigLoading, setPlanConfigLoading] = useState(true);
  const [justUpdatedPlans, setJustUpdatedPlans] = useState(false);

  const currentPeriod = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().split('T')[0];
  const monthStart = `${currentPeriod}-01`;
  const monthEnd = `${currentPeriod}-31`;

  const load = () => {
    if (!orgId) return;
    getWorkers({ orgId }).then(setWorkers);
    getShops(orgId).then(setShops);
    getShifts({ orgId, startDate: monthStart, endDate: monthEnd }).then(setShifts);
    getPayments({ orgId, limit: 20 }).then(setPayments);
    getOrganization(orgId).then(setOrgData);
    // Check if PayPal plans are configured
    setPlanConfigLoading(true);
    fetch('/api/paypal/setup').then(r => r.json()).then(data => {
      console.log('[Page Load] Received plan config:', data);
      setPlanConfig(data);
      setPlanConfigLoading(false);
    }).catch((err) => {
      console.error('[Page Load] Error fetching plan config:', err);
      setPlanConfigLoading(false);
    });
  };
  useEffect(() => { load(); }, [orgId]);

  // Reset justUpdatedPlans flag after 10 seconds
  useEffect(() => {
    if (justUpdatedPlans) {
      const timer = setTimeout(() => setJustUpdatedPlans(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [justUpdatedPlans]);

  // Handle PayPal return from subscription approval
  useEffect(() => {
    const sub = searchParams.get('subscription');
    if (sub === 'success') {
      toast.success('Subscription activated! PayPal will confirm shortly.');
      // Reload after delay to let webhook fire
      setTimeout(() => { load(); router.replace('/costs'); }, 3000);
    } else if (sub === 'cancelled') {
      toast('Subscription setup cancelled.');
      router.replace('/costs');
    }
  }, [searchParams]);

  const activeWorkers = workers.filter(w => w.status === 'active');
  const cost = useMemo(() => calculateCost(activeWorkers.length, shops.length, 'monthly'), [activeWorkers.length, shops.length]);

  // Subscription state
  const sub = orgData || organization || {};
  const hasActiveSubscription = sub.subscriptionStatus === 'active';
  const hasSuspendedSubscription = sub.subscriptionStatus === 'suspended';
  const hasCancelledSubscription = sub.subscriptionStatus === 'cancelled';
  const subscriptionCycle = sub.subscriptionCycle || 'monthly';
  const subscriptionCost = useMemo(() => {
    if (!hasActiveSubscription && !hasSuspendedSubscription) return null;
    return calculateCost(activeWorkers.length, shops.length, subscriptionCycle);
  }, [activeWorkers.length, shops.length, subscriptionCycle, hasActiveSubscription, hasSuspendedSubscription]);

  // Labor costs
  const laborCosts = useMemo(() => {
    return activeWorkers.map(w => {
      const wShifts = shifts.filter(s => s.workerId === w.id);
      const hours = wShifts.reduce((sum, s) => sum + (s.hours || 0), 0);
      const result = calculateWorkerCost(w, hours);
      return { ...w, ...result, hours, shifts: wShifts.length };
    });
  }, [activeWorkers, shifts]);

  const totalLaborCost = laborCosts.reduce((sum, w) => {
    return sum + (w.type === 'salaried' ? (w.monthlySalary || 0) : (w.total || 0));
  }, 0);

  // ─── Setup PayPal Plans (admin one-time) ────
const handleSetupPlans = async () => {
    if (!confirm('This creates PayPal billing plans. Run once only. Continue?')) return;
    setSetupLoading(true);
    try {
      const res = await fetch('/api/paypal/setup', { method: 'POST', body: JSON.stringify({}) });
      const data = await res.json();
      if (res.ok) {
        toast.success('PayPal plans created! Please refresh the page.');
        setPlanConfig(data);
        // Force page reload after successful plan creation
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        toast.error(data.error || 'Setup failed');
      }
      setSetupLoading(false);
    } catch (err) {
      toast.error(err.message);
      setSetupLoading(false);
    }
  };

  const handleRecreatePlans = async () => {
    if (!confirm('This will recreate PayPal billing plans with new decimal pricing. Existing subscriptions will continue working. Continue?')) return;
    setSetupLoading(true);
    try {
      const res = await fetch('/api/paypal/setup', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('PayPal plans updated with decimal pricing! Page will refresh automatically.');
        // Update config immediately
        setPlanConfig(data);
        setJustUpdatedPlans(true);
        // Force page reload after successful plan update
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        toast.error(data.error || 'Setup failed');
      }
      setSetupLoading(false);
    } catch (err) {
      toast.error(err.message);
      setSetupLoading(false);
    }
  };

  // ─── Cancel Subscription ────────────────────
  const handleCancel = async () => {
    if (!confirm('Cancel your subscription? You\'ll keep access until the current billing period ends.')) return;
    setCancelling(true);
    try {
      const res = await fetch('/api/paypal/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, reason: 'Cancelled from StaffHub billing page' }),
      });
      const data = await res.json();
      if (res.ok) { toast.success('Subscription cancelled'); load(); }
      else toast.error(data.error || 'Cancel failed');
    } catch (err) { toast.error(err.message); }
    setCancelling(false);
  };

  const tierInfo = getTierInfo(cost.tier);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Costs & Billing</h1>
            <p className="text-surface-500 mt-1">Manage your subscription, view billing and labor costs.</p>
          </div>
        </div>

        {/* ═══ Subscription Status Card ═══ */}
        <div className={cn('card p-6', hasActiveSubscription ? 'border-emerald-200 bg-emerald-50/30' : hasSuspendedSubscription ? 'border-amber-200 bg-amber-50/30' : '')}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className={cn('badge text-sm', tierInfo.badge)}>{tierInfo.name} Plan</span>
                {hasActiveSubscription && <span className="badge bg-emerald-100 text-emerald-700"><CheckCircle className="w-3 h-3" /> Active</span>}
                {hasSuspendedSubscription && <span className="badge bg-amber-100 text-amber-700"><AlertTriangle className="w-3 h-3" /> Suspended</span>}
                {hasCancelledSubscription && <span className="badge bg-red-100 text-red-700"><XCircle className="w-3 h-3" /> Cancelled</span>}
                {!sub.subscriptionStatus && cost.tier !== TIERS.FREE && <span className="badge bg-surface-100 text-surface-600">No subscription</span>}
              </div>
              <p className="text-sm text-surface-600">
                {activeWorkers.length} workers · {shops.length} shop{shops.length !== 1 ? 's' : ''}
                {hasActiveSubscription && <> · Billed <span className="font-medium capitalize">{subscriptionCycle}</span></>}
              </p>
              {subscriptionCost && (
                <p className="text-2xl font-display font-bold text-surface-900 mt-1">
                  {formatCurrency(subscriptionCost.total)}<span className="text-sm font-normal text-surface-400">/{subscriptionCycle === 'yearly' ? 'yr' : 'mo'}</span>
                  {subscriptionCost.savings > 0 && <span className="text-xs text-emerald-600 ml-2">Saving {formatCurrency(subscriptionCost.savings)}/yr</span>}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Free plan: no subscription needed */}
              {cost.tier === TIERS.FREE && !hasActiveSubscription && (
                <div className="text-sm text-emerald-600 font-medium">✓ Free — no payment needed</div>
              )}
              {/* Need subscription */}
              {cost.tier !== TIERS.FREE && !hasActiveSubscription && !hasSuspendedSubscription && (
                <button onClick={() => setShowSubscribe(true)} className="btn-primary"><CreditCard className="w-4 h-4" /> Subscribe</button>
              )}
              {/* Active: show cancel option */}
              {hasActiveSubscription && (
                <button onClick={handleCancel} disabled={cancelling} className="btn-secondary !text-red-600 hover:!bg-red-50">
                  {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Cancel Subscription
                </button>
              )}
              {/* Suspended: resubscribe */}
              {hasSuspendedSubscription && (
                <button onClick={() => setShowSubscribe(true)} className="btn-primary"><RefreshCw className="w-4 h-4" /> Resubscribe</button>
              )}
            </div>
          </div>

          {/* Auto-sync info */}
          {hasActiveSubscription && cost.tier === 'standard' && (
            <div className="mt-4 pt-4 border-t border-emerald-100/50">
              <p className="text-xs text-surface-500 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <strong>Smart billing:</strong> When you add/remove workers or shops, your subscription amount updates automatically for the next billing cycle.
              </p>
            </div>
          )}
        </div>

        {/* ═══ Stats ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="flex items-center justify-between"><p className="text-sm font-medium text-surface-500">Platform Fee</p><CreditCard className="w-4 h-4 text-brand-400" /></div>
            <p className="text-3xl font-display font-bold text-surface-900">{formatCurrency(cost.total)}</p>
            <p className="text-xs text-surface-400">/month</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between"><p className="text-sm font-medium text-surface-500">Labor Cost</p><TrendingUp className="w-4 h-4 text-amber-400" /></div>
            <p className="text-3xl font-display font-bold text-surface-900">{formatCurrency(totalLaborCost)}</p>
            <p className="text-xs text-surface-400">this month (est.)</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between"><p className="text-sm font-medium text-surface-500">Workers</p><Users className="w-4 h-4 text-emerald-400" /></div>
            <p className="text-3xl font-display font-bold text-surface-900">{activeWorkers.length}</p>
            <p className="text-xs text-surface-400">× {formatCurrency(2)}/mo</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between"><p className="text-sm font-medium text-surface-500">Shops</p><Store className="w-4 h-4 text-purple-400" /></div>
            <p className="text-3xl font-display font-bold text-surface-900">{shops.length}</p>
            <p className="text-xs text-surface-400">× {formatCurrency(15)}/mo</p>
          </div>
        </div>

        {/* ═══ Labor Cost Breakdown ═══ */}
        <div className="card">
          <div className="px-5 py-4 border-b border-surface-100">
            <h3 className="section-title">Labor Cost Breakdown — {currentPeriod}</h3>
          </div>
          <div className="divide-y divide-surface-100">
            {laborCosts.length === 0 && <p className="p-6 text-sm text-surface-400 text-center">No active workers.</p>}
            {laborCosts.map(w => (
              <div key={w.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-surface-800">{w.firstName} {w.lastName}</p>
                  <p className="text-xs text-surface-400">{w.type === 'salaried' ? 'Salaried' : `${w.hours.toFixed(1)}h × ${formatCurrency(w.costPerHour)}`} · {w.shifts} shifts</p>
                </div>
                <p className="text-sm font-semibold text-surface-700">
                  {formatCurrency(w.type === 'salaried' ? (w.monthlySalary || 0) : (w.total || 0))}
                </p>
              </div>
            ))}
            {laborCosts.length > 0 && (
              <div className="px-5 py-3 flex items-center justify-between bg-surface-50">
                <p className="text-sm font-semibold text-surface-800">Total Labor</p>
                <p className="text-sm font-bold text-surface-900">{formatCurrency(totalLaborCost)}</p>
              </div>
            )}
          </div>
        </div>

        {/* ═══ Payment History ═══ */}
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
                  <p className="text-xs text-surface-400">
                    {p.method === 'paypal_subscription' ? 'Auto · PayPal' : p.method || 'PayPal'} · {p.tier || '—'} · {p.billingCycle || 'monthly'}
                    {p.workerCount ? ` · ${p.workerCount}w/${p.shopCount || 0}s` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-surface-700">{formatCurrency(p.amount || 0)}</p>
                  <span className={cn('badge text-[10px]',
                    p.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                    p.status === 'REFUNDED' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  )}>{p.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

{/* ═══ Debug Info (remove in production) ═══ */}
        {process.env.NODE_ENV === 'development' && (
          <div className="card p-3 border-gray-200 bg-gray-50/30 text-xs">
            <div><strong>Debug Info:</strong></div>
            <div>isAdmin: {isAdmin ? 'true' : 'false'}</div>
            <div>planConfigLoading: {planConfigLoading ? 'true' : 'false'}</div>
            <div>planConfig.configured: {planConfig?.configured ? 'true' : 'false'}</div>
            <div>planConfig.planVersion: {planConfig?.planVersion || 'undefined'}</div>
            <div>justUpdatedPlans: {justUpdatedPlans ? 'true' : 'false'}</div>
            <div>setupLoading: {setupLoading ? 'true' : 'false'}</div>
            <div>Full planConfig: {JSON.stringify(planConfig, null, 2)}</div>
            <button 
              onClick={() => {
                setPlanConfigLoading(true);
                fetch('/api/paypal/setup').then(r => r.json()).then(data => {
                  console.log('[Manual Refresh] Received plan config:', data);
                  setPlanConfig(data);
                  setPlanConfigLoading(false);
                }).catch((err) => {
                  console.error('[Manual Refresh] Error:', err);
                  setPlanConfigLoading(false);
                });
              }}
              className="mt-2 text-xs bg-gray-200 px-2 py-1 rounded"
            >
              Refresh Plan Config
            </button>
          </div>
        )}

        {/* ═══ Admin: Setup PayPal Plans ═══ */}
        {isAdmin && !planConfigLoading && !planConfig?.configured && (
          <div className="card p-5 border-amber-200 bg-amber-50/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">PayPal Plans Not Set Up</p>
                <p className="text-xs text-amber-700 mt-1">Before customers can subscribe, you need to create billing plans on PayPal. This only needs to be done once. Make sure PAYPAL_CLIENT_SECRET and NEXT_PUBLIC_PAYPAL_CLIENT_ID are set in .env.local.</p>
                <button onClick={handleSetupPlans} disabled={setupLoading} className="btn-primary mt-3 !text-sm">
                  {setupLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating plans...</> : <><Zap className="w-4 h-4" /> Create PayPal Plans</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Admin: Recreate PayPal Plans (Decimal Pricing) ═══ */}
        {planConfig?.configured && planConfig?.planVersion < 2 && !setupLoading && !justUpdatedPlans && (
          <div className="card p-5 border-blue-200 bg-blue-50/30">
            <div className="flex items-start gap-3">
              <RefreshCw className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">PayPal Plans Need Update</p>
                <p className="text-xs text-blue-700 mt-1">Your PayPal plans use old pricing (€1/unit). Update to support decimal pricing (€0.50/worker, €2.99/shop). This will recreate all billing plans with new pricing structure.</p>
                {isAdmin ? (
                  <button onClick={() => handleRecreatePlans()} disabled={setupLoading} className="btn-primary mt-3 !text-sm bg-blue-600 hover:bg-blue-700">
                    {setupLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating plans...</> : <><RefreshCw className="w-4 h-4" /> Update PayPal Plans</>}
                  </button>
                ) : (
                  <div className="mt-3 text-xs text-blue-600">
                    <p>Contact your administrator to update PayPal plans, or</p>
                    <button 
                      onClick={() => handleRecreatePlans()} 
                      disabled={setupLoading}
                      className="text-blue-700 underline hover:no-underline mt-1"
                    >
                      {setupLoading ? 'Updating...' : 'click here to update manually'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ Subscribe Modal ═══ */}
        <Modal open={showSubscribe} onClose={() => setShowSubscribe(false)} title="Subscribe to StaffHub" size="lg">
          <PayPalCheckout
            tier={cost.tier}
            workerCount={activeWorkers.length}
            shopCount={shops.length}
            onSuccess={() => { setShowSubscribe(false); load(); }}
          />
        </Modal>
      </div>
    </Layout>
  );
}

export default function CostsPage() {
  return (
    <Suspense fallback={
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      </Layout>
    }>
      <CostsContent />
    </Suspense>
  );
}