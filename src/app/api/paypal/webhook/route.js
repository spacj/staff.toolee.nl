import { NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/paypal-server';

/**
 * POST /api/paypal/webhook
 * Receives PayPal events. Logs them for debugging.
 * 
 * Payment tracking & subscription status are handled client-side
 * via PayPalCheckout.jsx and syncOrgPlan(). This webhook is a
 * safety net — it doesn't need firebase-admin.
 */
export async function POST(req) {
  try {
    const body = await req.text();
    const headers = Object.fromEntries(req.headers.entries());

    const verify = await verifyWebhookSignature(headers, body);
    if (!verify.ok || verify.data?.verification_status !== 'SUCCESS') {
      console.warn('Webhook signature failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);
    console.log(`[PayPal Webhook] ${event.event_type}`, event.resource?.id);

    // Events are logged. Client-side handles Firestore updates.
    // For production, you could forward these to a Cloud Function
    // or use Firebase REST API to update Firestore.

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
