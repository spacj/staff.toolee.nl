'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import PayPalCheckout from '@/components/PayPalCheckout';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkers, getShops, getShifts, getPayments, getOrganization } from '@/lib/firestore';
import { calculateCost, formatCurrency, getTierInfo, TIERS } from '@/lib/pricing';
import { calculateWorkerCost } from '@/lib/scheduling';
import { cn } from '@/utils/helpers';
import {
  CreditCard, TrendingUp, Users, Store, CheckCircle, AlertTriangle,
  XCircle, Zap, RefreshCw, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

function CostsContent() {
  const { orgId, organization, isManager, user } = useAuth();
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
  }, [searchParams, router]);

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

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page Title */}
        <div>
          <h1 className="page-title">Costs & Billing</h1>
          <p className="text-sm text-surface-500">Manage subscription, labor costs, and payment history</p>
        </div>

        {/* Current Subscription Status */}
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
                    {hasActiveSubscription && '✓ Active Subscription'}
                    {hasSuspendedSubscription && '⚠ Suspended Subscription'}
                    {hasCancelledSubscription && '✗ Cancelled Subscription'}
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
                  {sub.lastPaymentDate && (
                    <p className={cn('text-xs mt-1', {
                      'text-emerald-600': hasActiveSubscription,
                      'text-amber-600': hasSuspendedSubscription,
                      'text-red-600': hasCancelledSubscription,
                    })}>
                      Last payment: {new Date(sub.lastPaymentDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              {hasActiveSubscription && (
                <button onClick={() => handleRecreatePlans()} disabled={setupLoading} className="text-xs text-surface-600 hover:text-surface-900 underline">
                  {setupLoading ? 'Loading...' : 'Change Plan'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* CTA: Subscribe if no subscription */}
        {!hasActiveSubscription && !hasSuspendedSubscription && (
          <div className="card p-5 border-blue-200 bg-blue-50/30">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-900">Start Your Subscription</p>
                <p className="text-xs text-blue-700 mt-1">Unlock advanced features: attendance tracking, cost analytics, and more.</p>
              </div>
              <button onClick={() => setShowSubscribe(true)} className="btn-primary !text-sm">
                <CreditCard className="w-4 h-4" /> Subscribe Now
              </button>
            </div>
          </div>
        )}

        {/* ═══ Billing Summary ═══ */}
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
            <p className="text-xs text-surface-400 mt-1">Location{shops.length !== 1 ? 's' : ''}</p>
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

        {/* ═══ Cost Breakdown ═══ */}
        <div className="card">
          <div className="px-5 py-4 border-b border-surface-100">
            <h3 className="section-title">Cost Breakdown</h3>
          </div>
          <div className="divide-y divide-surface-100">
            <div className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-surface-800">StaffHub Subscription</p>
                <p className="text-xs text-surface-500 mt-0.5">{cost.tier === 'free' ? 'Free forever' : `${cost.tier} plan`}</p>
              </div>
              <p className="text-sm font-semibold text-surface-900">{formatCurrency(cost.total)}</p>
            </div>

            {laborCosts.length > 0 && (
              <div className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-surface-800">Labor Cost</p>
                  <p className="text-xs text-surface-500 mt-0.5">{shifts.length} shifts logged</p>
                </div>
                <p className="text-sm font-semibold text-surface-900">{formatCurrency(totalLaborCost)}</p>
              </div>
            )}

            {laborCosts.length > 0 && (
              <div className="px-5 py-3 flex items-center justify-between bg-surface-50">
                <p className="text-sm font-semibold text-surface-800">Total Monthly</p>
                <p className="text-sm font-bold text-surface-900">{formatCurrency(cost.total + totalLaborCost)}</p>
              </div>
            )}
          </div>

          {/* Labor Costs Breakdown */}
          {laborCosts.length > 0 && (
            <div className="border-t border-surface-100">
              <div className="px-5 py-3 bg-surface-50">
                <p className="text-xs font-semibold text-surface-700 uppercase">Workers</p>
              </div>
              <div className="divide-y divide-surface-100">
                {laborCosts.map(w => (
                  <div key={w.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-surface-800">{w.firstName} {w.lastName}</p>
                      <p className="text-xs text-surface-500 mt-0.5">{w.hours}h • {w.shifts} shifts</p>
                    </div>
                    <p className="text-sm font-semibold text-surface-900">{formatCurrency(w.type === 'salaried' ? (w.monthlySalary || 0) : (w.total || 0))}</p>
                  </div>
                ))}
              </div>

              {laborCosts.length > 0 && (
                <div className="px-5 py-3 flex items-center justify-between bg-surface-50">
                  <p className="text-sm font-semibold text-surface-800">Total Labor</p>
                  <p className="text-sm font-bold text-surface-900">{formatCurrency(totalLaborCost)}</p>
                </div>
              )}
            </div>
          )}
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
                  <p className="text-xs text-surface-500 mt-0.5">
                    {p.method === 'paypal_subscription' ? 'Auto · PayPal' : p.method || 'PayPal'} · {p.tier || '—'} · {p.billingCycle || 'monthly'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-surface-900">{formatCurrency(p.amount || 0)}</p>
                  <p className={cn('text-xs mt-0.5', {
                    'text-emerald-600': p.status === 'COMPLETED',
                    'text-amber-600': p.status === 'PENDING',
                    'text-red-600': p.status === 'REFUNDED',
                  })}>
                    {p.status === 'COMPLETED' && '✓ Completed'}
                    {p.status === 'PENDING' && '⏳ Pending'}
                    {p.status === 'REFUNDED' && '↩ Refunded'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Subscribe Modal */}
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
