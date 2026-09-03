'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkers, getShops } from '@/lib/firestore';
import { getTier, calculateCost, formatCurrency, TIERS, FREE_WORKER_LIMIT } from '@/lib/pricing';
import { AlertTriangle, CreditCard, X } from 'lucide-react';
import Link from 'next/link';

/**
 * Global subscription alert banner.
 * Shows when the org has 5+ active workers but no active PayPal subscription.
 * First 4 workers are always free — billing kicks in from the 5th.
 */
export default function SubscriptionAlert() {
  const { orgId, organization, isAdmin, isManager, isSuperAdmin } = useAuth();
  const [workerCount, setWorkerCount] = useState(0);
  const [shopCount, setShopCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    getWorkers({ orgId, status: 'active' }).then(w => setWorkerCount(w.length));
    getShops(orgId).then(s => setShopCount(s.length));
  }, [orgId]);

  const freeLimit = organization?.freeWorkerLimit || FREE_WORKER_LIMIT;
  const onPro = !!organization?.proPlan || organization?.subscriptionTier === 'enterprise';
  const tier = getTier(workerCount, freeLimit);
  const needsSubscription = tier !== TIERS.FREE || onPro || !!organization?.inventoryAddon;
  const subStatus = organization?.subscriptionStatus;
  const hasActiveSubscription = subStatus === 'active';
  const isSuspended = subStatus === 'suspended';
  const isCancelled = subStatus === 'cancelled';

  const cost = calculateCost(workerCount, shopCount, 'monthly', freeLimit, { inventoryAddon: !!organization?.inventoryAddon, proPlan: onPro });
  // Roster/toggles now cost more than what's being billed → an unconfirmed upgrade.
  const billed = Number(organization?.monthlyCost || 0);
  const unconfirmedIncrease = hasActiveSubscription && cost.monthlyTotal > billed + 0.005;

  // Comp accounts are never billed; and a healthy active sub with nothing pending is silent.
  if (dismissed || !isManager || !orgId || isSuperAdmin) return null;
  if (hasActiveSubscription && !unconfirmedIncrease) return null;
  if (!needsSubscription && !unconfirmedIncrease) return null;

  // Determine alert severity
  const isMissing = !subStatus; // never subscribed
  const isExpired = isCancelled || isSuspended;

  return (
    <div className={`relative px-4 py-3 ${isExpired ? 'bg-red-600' : unconfirmedIncrease ? 'bg-brand-600' : 'bg-amber-500'} text-white`}>
      <div className="max-w-7xl mx-auto flex items-center gap-3 text-sm">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {unconfirmedIncrease && (
            <p>
              <strong>Plan change to confirm.</strong> Your team or add-ons now cost {formatCurrency(cost.monthlyTotal)}/month (you&apos;re billed {formatCurrency(billed)}). Pay the difference now so the change takes effect immediately.
            </p>
          )}
          {!unconfirmedIncrease && isMissing && (
            <p>
              <strong>Subscription required.</strong> You have {workerCount} active workers — billing starts from the {freeLimit + 1}th worker at {formatCurrency(cost.total)}/month.
              {' '}First {freeLimit} workers are always free.
            </p>
          )}
          {!unconfirmedIncrease && isSuspended && (
            <p>
              <strong>Subscription suspended.</strong> Your payment failed or was suspended. Please update your payment method to continue using Staff2 for {workerCount} workers.
            </p>
          )}
          {!unconfirmedIncrease && isCancelled && (
            <p>
              <strong>Subscription cancelled.</strong> Re-subscribe to keep managing {workerCount} workers. Current cost: {formatCurrency(cost.total)}/month.
            </p>
          )}
        </div>
        {isAdmin && (
          <Link href="/costs" className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg font-semibold text-xs transition-colors">
            <CreditCard className="w-3.5 h-3.5" />
            {unconfirmedIncrease ? 'Confirm & pay' : isMissing ? 'Subscribe Now' : 'Fix Billing'}
          </Link>
        )}
        <button onClick={() => setDismissed(true)} className="flex-shrink-0 p-1 hover:bg-white/20 rounded-lg transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
