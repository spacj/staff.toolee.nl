'use client';
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import PayPalCheckout from '@/components/PayPalCheckout';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkers, getShops, getShifts, getPayments, getOrganization, updateOrganization } from '@/lib/firestore';
import { calculateCost, formatCurrency, getTierInfo, TIERS } from '@/lib/pricing';
import { calculateWorkerCost } from '@/lib/scheduling';
import { cn } from '@/utils/helpers';
import {
  CreditCard, TrendingUp, Users, Store, CheckCircle, AlertTriangle,
  XCircle, Zap, RefreshCw, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function CostsPage() {
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
  };
  useEffect(() => { load(); }, [orgId]);

  // Handle return from PayPal (shouldn't happen with popup, but just in case)
  useEffect(() => {
    const sub = searchParams.get('subscription');
    if (sub === 'success') { toast.success('Subscription activated!'); router.replace('/costs'); }
    else if (sub === 'cancelled') { toast('Cancelled — no charge.'); router.replace('/costs'); }
  }, [searchParams]);

  const activeWorkers = workers.filter(w => w.status === 'active');
  const cost = useMemo(() => calculateCost(activeWorkers.length, shops.length, 'monthly'), [activeWorkers.length, shops.length]);

  // Subscription state
  const sub = orgData || organization || {};
  const hasActive = sub.subscriptionStatus === 'active';
  const hasSuspended = sub.subscriptionStatus === 'suspended';
  const hasCancelled = sub.subscriptionStatus === 'cancelled';
  const subCycle = sub.subscriptionCycle || 'monthly';
  const subCost = useMemo(() => {
    if (!hasActive && !hasSuspended) return null;
    return calculateCost(activeWorkers.length, shops.length, subCycle);
  }, [activeWorkers.length, shops.length, subCycle, hasActive, hasSuspended]);

  // Plan IDs configured?
  const plansReady = !!(
    process.env.NEXT_PUBLIC_PAYPAL_PLAN_STANDARD_MONTHLY &&
    process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
  );

  // Labor costs
  const laborCosts = useMemo(() => activeWorkers.map(w => {
    const wShifts = shifts.filter(s => s.workerId === w.id);
    const hours = wShifts.reduce((sum, s) => sum + (s.hours || 0), 0);
    return { ...w, ...calculateWorkerCost(w, hours), hours, shifts: wShifts.length };
  }), [activeWorkers, shifts]);
  const totalLabor = laborCosts.reduce((s, w) => s + (w.type === 'salaried' ? (w.monthlySalary || 0) : (w.total || 0)), 0);

  // Cancel via server route
  const handleCancel = async () => {
    if (!confirm('Cancel subscription? Access continues until current period ends.')) return;
    const subId = sub.subscriptionId;
    if (!subId) { toast.error('No active subscription found'); return; }
    setCancelling(true);
    try {
      const res = await fetch('/api/paypal/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: subId, reason: 'Cancelled from billing page' }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Cancel failed'); setCancelling(false); return; }
      // Update Firestore client-side
      await updateOrganization(orgId, { subscriptionStatus: 'cancelled', subscriptionCancelledAt: new Date().toISOString() });
      toast.success('Subscription cancelled');
      load();
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
            <p className="text-surface-500 mt-1">Manage subscription, view billing and labor costs.</p>
          </div>
        </div>

        {/* Setup warning */}
        {isManager && !plansReady && cost.tier !== TIERS.FREE && (
          <div className="card p-5 border-amber-200 bg-amber-50/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">PayPal Not Configured</p>
                <p className="text-xs text-amber-700 mt-1">Run the setup script and add plan IDs to your environment. See README for instructions.</p>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Status */}
        <div className={cn('card p-6', hasActive ? 'border-emerald-200 bg-emerald-50/30' : hasSuspended ? 'border-amber-200 bg-amber-50/30' : '')}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className={cn('badge text-sm', tierInfo.badge)}>{tierInfo.name}</span>
                {hasActive && <span className="badge bg-emerald-100 text-emerald-700"><CheckCircle className="w-3 h-3" /> Active</span>}
                {hasSuspended && <span className="badge bg-amber-100 text-amber-700"><AlertTriangle className="w-3 h-3" /> Suspended</span>}
                {hasCancelled && <span className="badge bg-red-100 text-red-700"><XCircle className="w-3 h-3" /> Cancelled</span>}
                {!sub.subscriptionStatus && cost.tier !== TIERS.FREE && <span className="badge bg-surface-100 text-surface-600">No subscription</span>}
              </div>
              <p className="text-sm text-surface-600">
                {activeWorkers.length} workers · {shops.length} shop{shops.length !== 1 ? 's' : ''}
                {hasActive && <> · Billed <span className="font-medium capitalize">{subCycle}</span></>}
              </p>
              {subCost && (
                <p className="text-2xl font-display font-bold text-surface-900 mt-1">
                  {formatCurrency(subCost.total)}<span className="text-sm font-normal text-surface-400">/{subCycle === 'yearly' ? 'yr' : 'mo'}</span>
                  {subCost.savings > 0 && <span className="text-xs text-emerald-600 ml-2">Saving {formatCurrency(subCost.savings)}/yr</span>}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {cost.tier === TIERS.FREE && !hasActive && <div className="text-sm text-emerald-600 font-medium">✓ Free — no payment needed</div>}
              {cost.tier !== TIERS.FREE && !hasActive && !hasSuspended && plansReady && (
                <button onClick={() => setShowSubscribe(true)} className="btn-primary"><CreditCard className="w-4 h-4" /> Subscribe</button>
              )}
              {hasActive && (
                <button onClick={handleCancel} disabled={cancelling} className="btn-secondary !text-red-600 hover:!bg-red-50">
                  {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Cancel
                </button>
              )}
              {hasSuspended && plansReady && (
                <button onClick={() => setShowSubscribe(true)} className="btn-primary"><RefreshCw className="w-4 h-4" /> Resubscribe</button>
              )}
            </div>
          </div>
          {hasActive && cost.tier === 'standard' && (
            <div className="mt-4 pt-4 border-t border-emerald-100/50">
              <p className="text-xs text-surface-500 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <strong>Smart billing:</strong> Adding/removing workers or shops auto-adjusts your next charge.
              </p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="flex items-center justify-between"><p className="text-sm font-medium text-surface-500">Platform Fee</p><CreditCard className="w-4 h-4 text-brand-400" /></div>
            <p className="text-3xl font-display font-bold text-surface-900">{formatCurrency(cost.total)}</p>
            <p className="text-xs text-surface-400">/month</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between"><p className="text-sm font-medium text-surface-500">Labor Cost</p><TrendingUp className="w-4 h-4 text-amber-400" /></div>
            <p className="text-3xl font-display font-bold text-surface-900">{formatCurrency(totalLabor)}</p>
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
            <p className="text-xs text-surface-400">1st free, +{formatCurrency(15)}/mo</p>
          </div>
        </div>

        {/* Labor breakdown */}
        <div className="card">
          <div className="px-5 py-4 border-b border-surface-100"><h3 className="section-title">Labor Cost — {currentPeriod}</h3></div>
          <div className="divide-y divide-surface-100">
            {laborCosts.length === 0 && <p className="p-6 text-sm text-surface-400 text-center">No active workers.</p>}
            {laborCosts.map(w => (
              <div key={w.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-surface-800">{w.firstName} {w.lastName}</p>
                  <p className="text-xs text-surface-400">{w.type === 'salaried' ? 'Salaried' : `${w.hours.toFixed(1)}h × ${formatCurrency(w.costPerHour)}`} · {w.shifts} shifts</p>
                </div>
                <p className="text-sm font-semibold text-surface-700">{formatCurrency(w.type === 'salaried' ? (w.monthlySalary || 0) : (w.total || 0))}</p>
              </div>
            ))}
            {laborCosts.length > 0 && (
              <div className="px-5 py-3 flex items-center justify-between bg-surface-50">
                <p className="text-sm font-semibold text-surface-800">Total</p>
                <p className="text-sm font-bold text-surface-900">{formatCurrency(totalLabor)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Payment History */}
        <div className="card">
          <div className="px-5 py-4 border-b border-surface-100"><h3 className="section-title">Payment History</h3></div>
          <div className="divide-y divide-surface-100">
            {payments.length === 0 && <p className="p-6 text-sm text-surface-400 text-center">No payments yet.</p>}
            {payments.map(p => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-surface-800">{p.period || p.createdAt?.slice(0, 10)}</p>
                  <p className="text-xs text-surface-400">{p.method === 'paypal_subscription' ? 'Auto · PayPal' : p.method || 'PayPal'} · {p.billingCycle || 'monthly'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-surface-700">{formatCurrency(p.amount || 0)}</p>
                  <span className={cn('badge text-[10px]',
                    p.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                    p.status === 'REFUNDED' ? 'bg-red-100 text-red-700' :
                    p.status === 'ACTIVATED' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  )}>{p.status}</span>
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
