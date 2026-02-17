import { NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/paypal-server';
import { queryCollection, updateDocument, createDocument } from '@/lib/firestore-rest';

/**
 * POST /api/paypal/webhook
 * Receives PayPal subscription events and updates Firestore via REST API.
 * No firebase-admin needed.
 */
export async function POST(req) {
  try {
    const body = await req.text();
    const headers = Object.fromEntries(req.headers.entries());

    const verify = await verifyWebhookSignature(headers, body);
    if (!verify.ok || verify.data?.verification_status !== 'SUCCESS') {
      console.warn('[Webhook] Signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);
    const eventType = event.event_type;
    const resource = event.resource || {};
    const subscriptionId = resource.id || resource.billing_agreement_id;

    console.log(`[Webhook] ${eventType}`, subscriptionId);

    if (!subscriptionId) {
      console.warn('[Webhook] No subscription ID in event');
      return NextResponse.json({ received: true, skipped: 'no subscription id' });
    }

    // Find the organization with this subscription
    let orgs = await queryCollection('organizations', 'subscriptionId', 'EQUAL', subscriptionId);
    if (orgs.length === 0) {
      // Try pending subscription ID
      orgs = await queryCollection('organizations', 'pendingSubscriptionId', 'EQUAL', subscriptionId);
    }

    if (orgs.length === 0) {
      console.warn(`[Webhook] No org found for subscription ${subscriptionId}`);
      return NextResponse.json({ received: true, skipped: 'org not found' });
    }

    const org = orgs[0];
    return await handleEvent(eventType, resource, subscriptionId, org);
  } catch (err) {
    console.error('[Webhook] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleEvent(eventType, resource, subscriptionId, org) {
  const orgId = org.id;
  let orgUpdate = {};
  let userStatus = null;

  switch (eventType) {
    case 'BILLING.SUBSCRIPTION.ACTIVATED': {
      orgUpdate = {
        subscriptionId,
        subscriptionStatus: 'active',
        pendingSubscriptionId: null,
        subscriptionActivatedAt: new Date().toISOString(),
      };
      userStatus = 'active';
      console.log(`[Webhook] ACTIVATED for org ${orgId}`);
      break;
    }

    case 'PAYMENT.SALE.COMPLETED': {
      const amount = resource.amount?.total || resource.amount?.value || '0';
      const currency = resource.amount?.currency || resource.amount?.currency_code || 'EUR';
      // Record payment
      await createDocument('payments', {
        orgId,
        paypalSubscriptionId: subscriptionId,
        paypalSaleId: resource.id,
        amount: parseFloat(amount),
        currency,
        status: 'COMPLETED',
        period: new Date().toISOString().slice(0, 7),
        method: 'paypal_subscription',
        createdAt: new Date().toISOString(),
      });
      orgUpdate = {
        subscriptionStatus: 'active',
        lastPaymentAt: new Date().toISOString(),
        lastPaymentAmount: parseFloat(amount),
      };
      userStatus = 'active';
      console.log(`[Webhook] Payment COMPLETED for org ${orgId}: ${amount} ${currency}`);
      break;
    }

    case 'BILLING.SUBSCRIPTION.CANCELLED': {
      orgUpdate = {
        subscriptionStatus: 'cancelled',
        subscriptionCancelledAt: new Date().toISOString(),
      };
      userStatus = 'cancelled';
      console.log(`[Webhook] CANCELLED for org ${orgId}`);
      break;
    }

    case 'BILLING.SUBSCRIPTION.SUSPENDED': {
      orgUpdate = {
        subscriptionStatus: 'suspended',
        subscriptionSuspendedAt: new Date().toISOString(),
      };
      userStatus = 'suspended';
      console.log(`[Webhook] SUSPENDED for org ${orgId}`);
      break;
    }

    case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
      orgUpdate = {
        subscriptionStatus: 'suspended',
        lastPaymentFailedAt: new Date().toISOString(),
      };
      userStatus = 'suspended';
      console.log(`[Webhook] Payment FAILED for org ${orgId}`);
      break;
    }

    default:
      console.log(`[Webhook] Unhandled event: ${eventType}`);
      return NextResponse.json({ received: true, skipped: 'unhandled event' });
  }

  // Update organization
  if (Object.keys(orgUpdate).length > 0) {
    orgUpdate.updatedAt = new Date().toISOString();
    await updateDocument('organizations', orgId, orgUpdate);
  }

  // Update all user profiles in this organization
  if (userStatus) {
    const users = await queryCollection('users', 'orgId', 'EQUAL', orgId);
    for (const u of users) {
      await updateDocument('users', u.id, {
        subscriptionStatus: userStatus,
        updatedAt: new Date().toISOString(),
      });
    }
    console.log(`[Webhook] Updated ${users.length} user profiles for org ${orgId}`);
  }

  return NextResponse.json({ received: true, processed: eventType });
}
