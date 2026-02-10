import { NextResponse } from 'next/server';
import { cancelSubscription } from '@/lib/paypal-server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * POST /api/paypal/cancel
 * Body: { orgId, reason }
 */
export async function POST(req) {
  try {
    const { orgId, reason } = await req.json();
    if (!orgId) return NextResponse.json({ error: 'Missing orgId' }, { status: 400 });

    const orgDoc = await adminDb.collection('organizations').doc(orgId).get();
    if (!orgDoc.exists) return NextResponse.json({ error: 'Org not found' }, { status: 404 });
    const org = orgDoc.data();

    if (!org.subscriptionId) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
    }

    await cancelSubscription(org.subscriptionId, reason || 'Cancelled by admin');
    await adminDb.collection('organizations').doc(orgId).update({
      subscriptionStatus: 'cancelled',
      subscriptionCancelledAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: 'Subscription cancelled' });
  } catch (err) {
    console.error('Cancel error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
