'use client';
import { useState, useRef, useEffect } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useAuth } from '@/contexts/AuthContext';
import { updateOrganization, createPayment } from '@/lib/firestore';
import { formatCurrency, calculateCost, getSubscriptionQuantity, calculateProration, CYCLES, PRICE_PER_WORKER, PRICE_PER_SHOP, FREE_WORKER_LIMIT } from '@/lib/pricing';
import { CheckCircle, AlertCircle, Zap, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Client-side PayPal Subscription Buttons.
 * No server route needed — PayPal JS SDK handles subscription creation directly.
 * Plan IDs come from env vars (set once via scripts/setup-paypal.mjs).
 */

const PLAN_IDS = {
  standard: {
    monthly: process.env.NEXT_PUBLIC_PAYPAL_PLAN_STANDARD_MONTHLY,
    yearly: process.env.NEXT_PUBLIC_PAYPAL_PLAN_STANDARD_YEARLY,
  },
  enterprise: {
    monthly: process.env.NEXT_PUBLIC_PAYPAL_PLAN_ENTERPRISE_MONTHLY,
    yearly: process.env.NEXT_PUBLIC_PAYPAL_PLAN_ENTERPRISE_YEARLY,
  },
};

export default function PayPalCheckout({ tier, workerCount, shopCount, onSuccess }) {
  const { orgId, user, organization } = useAuth();
  const [cycle, setCycle] = useState(CYCLES.MONTHLY);
  const [status, setStatus] = useState('idle'); // idle | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const freeLimit = organization?.freeWorkerLimit || FREE_WORKER_LIMIT;
  const cost = calculateCost(workerCount, shopCount, cycle, freeLimit);
  const quantity = getSubscriptionQuantity(workerCount, shopCount, freeLimit);
  const planId = PLAN_IDS[tier]?.[cycle];
  const isMonthly = cycle === CYCLES.MONTHLY;
  const monthlyAlt = calculateCost(workerCount, shopCount, 'monthly', freeLimit);
  const yearlyAlt = calculateCost(workerCount, shopCount, 'yearly', freeLimit);

  // Calculate proration if upgrading an active subscription
  const previousCost = organization?.monthlyCost
    ? { monthlyTotal: organization.monthlyCost, total: organization.monthlyCost }
    : null;
  const proration = previousCost && organization?.subscriptionStatus === 'active'
    ? calculateProration(previousCost, monthlyAlt)
    : null;

  // Free tier
  if (cost.total === 0) {
    return (
      <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
        <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">Free plan — no payment needed!</p>
          <p className="text-xs text-emerald-600 mt-0.5">Add more workers to unlock Standard features.</p>
        </div>
      </div>
    );
  }

  // No plan configured
  if (!planId) {
    return (
      <div className="p-5 bg-red-50 border border-red-200 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">PayPal plans not configured</p>
            <p className="text-xs text-red-600 mt-1">
              Run the setup script first: <code className="bg-red-100 px-1 rounded">PAYPAL_CLIENT_ID=xxx PAYPAL_SECRET=yyy node scripts/setup-paypal.mjs</code>
              then add the plan IDs to your environment variables.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="p-6 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="text-lg font-display font-bold text-surface-900">Subscription Active!</h3>
        <p className="text-sm text-surface-500 mt-2">
          PayPal will charge {formatCurrency(cost.total)}/{isMonthly ? 'month' : 'year'} automatically. You&apos;re all set.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Billing cycle toggle */}
      <div>
        <label className="label mb-2">Billing Cycle</label>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setCycle(CYCLES.MONTHLY)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${isMonthly ? 'border-brand-500 bg-brand-50' : 'border-surface-200 hover:border-surface-300'}`}>
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className={`w-4 h-4 ${isMonthly ? 'text-brand-600' : 'text-surface-400'}`} />
              <span className={`text-sm font-semibold ${isMonthly ? 'text-brand-700' : 'text-surface-700'}`}>Monthly</span>
            </div>
            <p className="text-lg font-display font-bold text-surface-900">{formatCurrency(monthlyAlt.total)}<span className="text-xs font-normal text-surface-400">/mo</span></p>
          </button>
          <button type="button" onClick={() => setCycle(CYCLES.YEARLY)}
            className={`p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden ${!isMonthly ? 'border-brand-500 bg-brand-50' : 'border-surface-200 hover:border-surface-300'}`}>
            {yearlyAlt.savings > 0 && (
              <span className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">SAVE {formatCurrency(yearlyAlt.savings)}</span>
            )}
            <div className="flex items-center gap-2 mb-1">
              <Zap className={`w-4 h-4 ${!isMonthly ? 'text-brand-600' : 'text-surface-400'}`} />
              <span className={`text-sm font-semibold ${!isMonthly ? 'text-brand-700' : 'text-surface-700'}`}>Yearly</span>
            </div>
            <p className="text-lg font-display font-bold text-surface-900">{formatCurrency(yearlyAlt.total)}<span className="text-xs font-normal text-surface-400">/yr</span></p>
            <p className="text-[11px] text-surface-400">{formatCurrency(yearlyAlt.monthlyEquivalent)}/mo effective</p>
          </button>
        </div>
      </div>

      {/* Invoice summary */}
      <div className="p-4 bg-surface-50 border border-surface-200 rounded-xl space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-surface-500">Plan</span>
          <span className="font-semibold capitalize text-surface-800">{cost.tier}</span>
        </div>
        {cost.tier === 'standard' && (
          <>
            <div className="flex justify-between">
              <span className="text-surface-500">First {freeLimit} workers</span>
              <span className="text-emerald-600 font-medium">Free</span>
            </div>
            {cost.billableWorkers > 0 && (
              <div className="flex justify-between">
                <span className="text-surface-500">{cost.billableWorkers} extra worker{cost.billableWorkers > 1 ? 's' : ''} × {formatCurrency(PRICE_PER_WORKER)}/mo{!isMonthly ? ' × 10' : ''}</span>
                <span className="text-surface-700">{formatCurrency(cost.workerCost)}</span>
              </div>
            )}
            {cost.billableShops > 0 && (
              <div className="flex justify-between">
                <span className="text-surface-500">{cost.billableShops} extra shop{cost.billableShops > 1 ? 's' : ''} × {formatCurrency(PRICE_PER_SHOP)}/mo{!isMonthly ? ' × 10' : ''}</span>
                <span className="text-surface-700">{formatCurrency(cost.shopCost)}</span>
              </div>
            )}
            {shopCount > 0 && cost.billableShops === 0 && (
              <div className="flex justify-between">
                <span className="text-surface-500">1 shop</span>
                <span className="text-emerald-600 font-medium">Free</span>
              </div>
            )}
          </>
        )}
        {cost.savings > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>Yearly savings</span><span className="font-semibold">−{formatCurrency(cost.savings)}</span>
          </div>
        )}
        {proration && proration.isUpgrade && proration.proratedDifference > 0 && (
          <div className="flex justify-between text-amber-600 pt-1 border-t border-surface-200">
            <span>Prorated upgrade ({proration.daysRemaining} days remaining)</span>
            <span className="font-semibold">+{formatCurrency(proration.proratedDifference)}</span>
          </div>
        )}
        <div className="flex justify-between pt-2 border-t border-surface-200">
          <span className="font-semibold text-surface-800">Total</span>
          <span className="text-lg font-display font-bold text-surface-900">{formatCurrency(cost.total)}/{isMonthly ? 'mo' : 'yr'}</span>
        </div>
      </div>

      {/* Auto-billing info */}
      <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
        <p className="font-semibold">🔄 Automatic billing</p>
        <p>PayPal charges {formatCurrency(cost.total)} every {isMonthly ? 'month' : 'year'}. When your team changes, the amount auto-adjusts next cycle.</p>
      </div>

      {/* Error */}
      {status === 'error' && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-700 flex items-start gap-2"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {errorMsg}</p>
        </div>
      )}

      {/* PayPal Subscribe Buttons */}
      <PayPalScriptProvider options={{
        'client-id': process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
        vault: true,
        intent: 'subscription',
        currency: 'EUR',
      }}>
        <PayPalButtons
          style={{ layout: 'vertical', color: 'blue', shape: 'rect', label: 'subscribe', height: 48 }}
          createSubscription={(data, actions) => {
            const opts = { plan_id: planId };
            // Standard plans: set quantity = total cost in cents (€0.01/unit)
            if (tier === 'standard' && quantity) {
              opts.quantity = String(quantity);
            }
            return actions.subscription.create(opts);
          }}
          onApprove={async (data) => {
            try {
              // Save subscription to Firestore directly (no server route needed)
              await updateOrganization(orgId, {
                subscriptionId: data.subscriptionID,
                subscriptionStatus: 'active',
                subscriptionTier: tier,
                subscriptionCycle: cycle,
                subscriptionQuantity: quantity || null,
                subscriptionStartTime: new Date().toISOString(),
                monthlyCost: cost.monthlyTotal || cost.total,
                pendingSubscriptionId: null,
              });
              // Record the subscription event
              await createPayment({
                orgId,
                paypalSubscriptionId: data.subscriptionID,
                amount: cost.total,
                currency: 'EUR',
                tier,
                billingCycle: cycle,
                workerCount,
                shopCount,
                period: new Date().toISOString().slice(0, 7),
                method: 'paypal_subscription',
                status: 'ACTIVATED',
              });
              if (mountedRef.current) setStatus('success');
              toast.success('Subscription activated!');
              setTimeout(() => onSuccess?.(), 2000);
            } catch (err) {
              console.error('Save error:', err);
              // Even if Firestore save fails, PayPal subscription is active
              // The webhook will pick it up
              toast.success('Subscription activated! (syncing...)');
              if (mountedRef.current) setStatus('success');
              setTimeout(() => onSuccess?.(), 2000);
            }
          }}
          onError={(err) => {
            console.error('PayPal error:', err);
            if (mountedRef.current) {
              setStatus('error');
              setErrorMsg(typeof err === 'string' ? err : 'PayPal encountered an error. Please try again.');
            }
          }}
          onCancel={() => {
            if (mountedRef.current) toast('Subscription cancelled — no charge.');
          }}
        />
      </PayPalScriptProvider>
      <p className="text-[11px] text-surface-400 text-center">Cancel anytime from Costs & Billing.</p>
    </div>
  );
}
