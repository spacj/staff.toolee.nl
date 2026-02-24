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
  const { orgId, organization, isAdmin, isManager } = useAuth();
  const [workerCount, setWorkerCount] = useState(0);
  const [shopCount, setShopCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    getWorkers({ orgId, status: 'active' }).then(w => setWorkerCount(w.length));
    getShops(orgId).then(s => setShopCount(s.length));
  }, [orgId]);

  // Don't show if: dismissed, not a manager, still loading, or on free tier
  const freeLimit = organization?.freeWorkerLimit || FREE_WORKER_LIMIT;
  const tier = getTier(workerCount, freeLimit);
  const needsSubscription = tier !== TIERS.FREE;
  const subStatus = organization?.subscriptionStatus;
  const hasActiveSubscription = subStatus === 'active';
  const isSuspended = subStatus === 'suspended';
  const isCancelled = subStatus === 'cancelled';

  if (dismissed || !isManager || !orgId || !needsSubscription || hasActiveSubscription) return null;

  const cost = calculateCost(workerCount, shopCount, 'monthly', freeLimit);

  // Determine alert severity
  const isMissing = !subStatus; // never subscribed
  const isExpired = isCancelled || isSuspended;

  return (
    <div className={`relative px-4 py-3 ${isExpired ? 'bg-red-600' : 'bg-amber-500'} text-white`}>
      <div className="max-w-7xl mx-auto flex items-center gap-3 text-sm">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {isMissing && (
            <p>
              <strong>Subscription required.</strong> You have {workerCount} active workers — billing starts from the {freeLimit + 1}th worker at {formatCurrency(cost.total)}/month.
              {' '}First {freeLimit} workers are always free.
            </p>
          )}
          {isSuspended && (
            <p>
              <strong>Subscription suspended.</strong> Your payment failed or was suspended. Please update your payment method to continue using StaffHub for {workerCount} workers.
            </p>
          )}
          {isCancelled && (
            <p>
              <strong>Subscription cancelled.</strong> Re-subscribe to keep managing {workerCount} workers. Current cost: {formatCurrency(cost.total)}/month.
            </p>
          )}
        </div>
        {isAdmin && (
          <Link href="/costs" className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg font-semibold text-xs transition-colors">
            <CreditCard className="w-3.5 h-3.5" />
            {isMissing ? 'Subscribe Now' : 'Fix Billing'}
          </Link>
        )}
        <button onClick={() => setDismissed(true)} className="flex-shrink-0 p-1 hover:bg-white/20 rounded-lg transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
