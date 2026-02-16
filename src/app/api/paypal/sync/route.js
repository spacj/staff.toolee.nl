import { NextResponse } from 'next/server';
import { updateSubscriptionQuantity, suspendSubscription, activateSubscription } from '@/lib/paypal-server';

/**
 * POST /api/paypal/sync
 * Body: { subscriptionId, action, quantity }
 * 
 * Client sends everything — no firebase-admin needed.
 * Actions: "update_quantity" | "suspend" | "activate"
 */
export async function POST(req) {
  try {
    const { subscriptionId, action, quantity, reason } = await req.json();
    if (!subscriptionId) return NextResponse.json({ error: 'Missing subscriptionId' }, { status: 400 });

    let result;
    switch (action) {
      case 'update_quantity':
        if (!quantity) return NextResponse.json({ error: 'Missing quantity' }, { status: 400 });
        result = await updateSubscriptionQuantity(subscriptionId, quantity);
        break;
      case 'suspend':
        result = await suspendSubscription(subscriptionId, reason || 'Downgraded to free tier');
        break;
      case 'activate':
        result = await activateSubscription(subscriptionId, reason || 'Reactivated');
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    if (result.ok || result.status === 204) {
      return NextResponse.json({ success: true, action });
    }
    return NextResponse.json({ error: 'PayPal failed', detail: result.data }, { status: 500 });
  } catch (err) {
    console.error('Sync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
