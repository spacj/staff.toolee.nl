import { NextResponse } from 'next/server';
import { cancelSubscription } from '@/lib/paypal-server';

/**
 * POST /api/paypal/cancel
 * Body: { subscriptionId, reason }
 * Only calls PayPal — no firebase-admin needed.
 * Firestore update happens client-side.
 */
export async function POST(req) {
  try {
    const { subscriptionId, reason } = await req.json();
    if (!subscriptionId) {
      return NextResponse.json({ error: 'Missing subscriptionId' }, { status: 400 });
    }
    const result = await cancelSubscription(subscriptionId, reason || 'Cancelled by customer');
    // PayPal returns 204 No Content on success (result.status === 204)
    if (result.ok || result.status === 204) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'PayPal cancel failed', detail: result.data }, { status: 500 });
  } catch (err) {
    console.error('Cancel error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
