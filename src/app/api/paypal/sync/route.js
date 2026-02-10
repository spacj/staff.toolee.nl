import { NextResponse } from 'next/server';
import { updateSubscriptionQuantity, suspendSubscription, activateSubscription } from '@/lib/paypal-server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/paypal/sync
 * Body: { orgId }
 *
 * Called after worker/shop changes. Recalculates the cost and updates the
 * PayPal subscription quantity so the next billing cycle charges correctly.
 *
 * Also handles tier transitions:
 *   - Downgrade to free → suspend subscription
 *   - Upgrade from free → reactivate or create new subscription
 *   - Standard ↔ Enterprise → quantity change (or plan change prompt)
 */
const PRICE_PER_WORKER = parseFloat(process.env.NEXT_PUBLIC_PRICE_PER_WORKER || '2');
const PRICE_PER_SHOP = parseFloat(process.env.NEXT_PUBLIC_PRICE_PER_SHOP || '15');
const FREE_LIMIT = parseInt(process.env.NEXT_PUBLIC_FREE_WORKER_LIMIT || '5');
const ENTERPRISE_LIMIT = parseInt(process.env.NEXT_PUBLIC_ENTERPRISE_THRESHOLD || '21');

export async function POST(req) {
  try {
    const { orgId } = await req.json();
    if (!orgId) return NextResponse.json({ error: 'Missing orgId' }, { status: 400 });

    // Get org
    const orgDoc = await adminDb.collection('organizations').doc(orgId).get();
    if (!orgDoc.exists) return NextResponse.json({ error: 'Org not found' }, { status: 404 });
    const org = orgDoc.data();

    // Count workers and shops
    const workersSnap = await adminDb.collection('workers')
      .where('orgId', '==', orgId).where('status', '==', 'active').get();
    const shopsSnap = await adminDb.collection('shops')
      .where('orgId', '==', orgId).get();

    const workerCount = workersSnap.size;
    const shopCount = shopsSnap.size;

    // Calculate tier and cost
    let tier, monthlyCost;
    if (workerCount < FREE_LIMIT) {
      tier = 'free'; monthlyCost = 0;
    } else if (workerCount < ENTERPRISE_LIMIT) {
      tier = 'standard';
      monthlyCost = (workerCount * PRICE_PER_WORKER) + (shopCount * PRICE_PER_SHOP);
    } else {
      tier = 'enterprise';
      monthlyCost = parseFloat(process.env.NEXT_PUBLIC_ENTERPRISE_PRICE || '99');
    }

    // Update org tier
    await adminDb.collection('organizations').doc(orgId).update({
      plan: tier,
      activeWorkerCount: workerCount,
      shopCount,
      monthlyCost,
    });

    const subscriptionId = org.subscriptionId;
    const subStatus = org.subscriptionStatus;

    // No active subscription — nothing to sync
    if (!subscriptionId || subStatus === 'cancelled') {
      return NextResponse.json({ synced: false, tier, monthlyCost, reason: 'No active subscription' });
    }

    // ─── Free tier: suspend subscription ──────────
    if (tier === 'free' && subStatus === 'active') {
      await suspendSubscription(subscriptionId, 'Downgraded to free tier');
      await adminDb.collection('organizations').doc(orgId).update({ subscriptionStatus: 'suspended' });
      return NextResponse.json({ synced: true, action: 'suspended', tier });
    }

    // ─── Paid tier: reactivate if suspended ───────
    if (tier !== 'free' && subStatus === 'suspended') {
      await activateSubscription(subscriptionId, 'Upgraded from free tier');
      await adminDb.collection('organizations').doc(orgId).update({ subscriptionStatus: 'active' });
    }

    // ─── Standard: update quantity ────────────────
    if (tier === 'standard' && org.subscriptionTier === 'standard') {
      const newQuantity = Math.round(monthlyCost);
      if (newQuantity !== (org.subscriptionQuantity || 0)) {
        const result = await updateSubscriptionQuantity(subscriptionId, newQuantity);
        if (result.ok) {
          await adminDb.collection('organizations').doc(orgId).update({
            subscriptionQuantity: newQuantity,
          });
          return NextResponse.json({ synced: true, action: 'quantity_updated', quantity: newQuantity, monthlyCost });
        } else {
          console.error('Quantity update failed:', result.data);
          return NextResponse.json({ synced: false, error: 'PayPal quantity update failed', detail: result.data });
        }
      }
    }

    // ─── Tier changed (standard↔enterprise): needs new subscription ─
    if (tier !== org.subscriptionTier && tier !== 'free') {
      return NextResponse.json({
        synced: false,
        action: 'plan_change_needed',
        currentTier: org.subscriptionTier,
        newTier: tier,
        message: `Tier changed from ${org.subscriptionTier} to ${tier}. Cancel current subscription and create a new one.`,
      });
    }

    return NextResponse.json({ synced: true, tier, monthlyCost, workerCount, shopCount });
  } catch (err) {
    console.error('Sync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
