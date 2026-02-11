'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, calculateCost, getSubscriptionQuantity, CYCLES } from '@/lib/pricing';
import { CreditCard, CheckCircle, AlertCircle, Loader2, ExternalLink, Zap, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * PayPal Subscription Checkout.
 * Creates a subscription via our API, then redirects user to PayPal to approve.
 * After approval, PayPal redirects back to /costs?subscription=success.
 * The webhook confirms activation and records first payment.
 */
export default function PayPalCheckout({ tier, workerCount, shopCount, onSuccess }) {
  const { orgId, organization, user, userProfile } = useAuth();
  const [billingCycle, setBillingCycle] = useState(CYCLES.MONTHLY);
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [errorMsg, setErrorMsg] = useState('');

  const cost = calculateCost(workerCount, shopCount, billingCycle);
  const quantity = getSubscriptionQuantity(workerCount, shopCount);

  // Free tier — no payment needed
  if (cost.total === 0) {
    return (
      <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
        <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">You're on the Free plan — no payment needed!</p>
          <p className="text-xs text-emerald-600 mt-0.5">Add {5 - workerCount} more workers to unlock Standard features.</p>
        </div>
      </div>
    );
  }

  const handleSubscribe = async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/paypal/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          tier,
          billingCycle,
          quantity: quantity || undefined,
          subscriberName: userProfile?.displayName || user?.displayName || '',
          subscriberEmail: user?.email || '',
        }),
      });
      const data = await res.json();

      if (!res.ok) {
      if (data.needsPlanRecreation) {
        // Offer direct recreation option
        if (confirm('PayPal plans need updating. Click OK to recreate plans with decimal pricing now.')) {
          // Trigger plan recreation
          try {
            const setupRes = await fetch('/api/paypal/setup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ force: true })
            });
            if (setupRes.ok) {
              toast.success('PayPal plans updated! Please refresh the page and try again.');
              // Don't retry automatically - require page refresh
              setStatus('idle');
              return;
            }
          } catch (setupErr) {
            console.error('Failed to recreate plans:', setupErr);
          }
        }
        throw new Error('PayPal plans need to be updated to support decimal pricing. Please refresh the page after updating.');
      }
          } catch (setupErr) {
            console.error('Failed to recreate plans:', setupErr);
          }
        }
        throw new Error('PayPal plans need to be updated to support decimal pricing. Please contact your administrator to recreate PayPal plans.');
      }
        throw new Error(data.error || 'Failed to create subscription');
      }

      if (data.approvalUrl) {
        // Redirect to PayPal for approval
        window.location.href = data.approvalUrl;
      } else {
        throw new Error('No approval URL returned from PayPal');
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message);
      toast.error('Subscription failed: ' + err.message);
    }
  };

  const isMonthly = billingCycle === CYCLES.MONTHLY;
  const monthlyAlt = calculateCost(workerCount, shopCount, CYCLES.MONTHLY);
  const yearlyAlt = calculateCost(workerCount, shopCount, CYCLES.YEARLY);

  return (
    <div className="space-y-5">
      {/* Billing cycle toggle */}
      <div>
        <label className="label mb-2">Billing Cycle</label>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setBillingCycle(CYCLES.MONTHLY)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${isMonthly ? 'border-brand-500 bg-brand-50' : 'border-surface-200 hover:border-surface-300'}`}>
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className={`w-4 h-4 ${isMonthly ? 'text-brand-600' : 'text-surface-400'}`} />
              <span className={`text-sm font-semibold ${isMonthly ? 'text-brand-700' : 'text-surface-700'}`}>Monthly</span>
            </div>
            <p className="text-lg font-display font-bold text-surface-900">{formatCurrency(monthlyAlt.total)}<span className="text-xs font-normal text-surface-400">/mo</span></p>
          </button>
          <button type="button" onClick={() => setBillingCycle(CYCLES.YEARLY)}
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
        <div className="flex justify-between">
          <span className="text-surface-500">Billing</span>
          <span className="font-medium text-surface-700 capitalize">{billingCycle}</span>
        </div>
        {cost.tier === 'standard' && (
          <>
            <div className="flex justify-between">
              <span className="text-surface-500">{workerCount} workers × {formatCurrency(2)}/mo{!isMonthly ? ' × 10mo' : ''}</span>
              <span className="text-surface-700">{formatCurrency(cost.workerCost)}</span>
            </div>
            {shopCount > 0 && (
              <div className="flex justify-between">
                <span className="text-surface-500">{shopCount} shop{shopCount > 1 ? 's' : ''} × {formatCurrency(15)}/mo{!isMonthly ? ' × 10mo' : ''}</span>
                <span className="text-surface-700">{formatCurrency(cost.shopCost)}</span>
              </div>
            )}
          </>
        )}
        {cost.savings > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>Yearly savings</span>
            <span className="font-semibold">−{formatCurrency(cost.savings)}</span>
          </div>
        )}
        <div className="flex justify-between pt-2 border-t border-surface-200">
          <span className="font-semibold text-surface-800">Total</span>
          <span className="text-lg font-display font-bold text-surface-900">{formatCurrency(cost.total)}</span>
        </div>
      </div>

      {/* How it works */}
      <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 space-y-1">
        <p className="font-semibold">🔄 Automatic recurring billing</p>
        <p>PayPal will charge {formatCurrency(cost.total)} every {isMonthly ? 'month' : 'year'} automatically. When you add or remove workers/shops, the amount adjusts on the next billing cycle — no action needed.</p>
      </div>

      {/* Error */}
      {status === 'error' && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-red-700">{errorMsg}</p>
              <button onClick={() => { setStatus('idle'); setErrorMsg(''); }} className="text-xs text-red-600 underline mt-1">Try again</button>
            </div>
          </div>
        </div>
      )}

      {/* Subscribe button */}
      <button onClick={handleSubscribe} disabled={status === 'loading'}
        className="w-full py-3.5 bg-[#0070ba] hover:bg-[#005ea6] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
        {status === 'loading' ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Connecting to PayPal...</>
        ) : (
          <><CreditCard className="w-4 h-4" /> Subscribe with PayPal — {formatCurrency(cost.total)}/{isMonthly ? 'mo' : 'yr'}</>
        )}
      </button>
      <p className="text-[11px] text-surface-400 text-center">You'll be redirected to PayPal to approve. Cancel anytime from Costs & Billing.</p>
    </div>
  );
}
