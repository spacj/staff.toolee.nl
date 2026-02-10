import { NextResponse } from 'next/server';
import { verifyWebhookSignature, getSubscription } from '@/lib/paypal-server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * POST /api/paypal/webhook
 * Handles PayPal webhook events for subscriptions.
 *
 * Key events:
 *   BILLING.SUBSCRIPTION.ACTIVATED  → subscription active
 *   BILLING.SUBSCRIPTION.CANCELLED  → subscription cancelled
 *   BILLING.SUBSCRIPTION.SUSPENDED  → payment failed
 *   BILLING.SUBSCRIPTION.UPDATED    → quantity/plan changed
 *   PAYMENT.SALE.COMPLETED          → recurring payment successful
 *   PAYMENT.SALE.REFUNDED           → refund issued
 *   CUSTOMER.DISPUTE.CREATED        → dispute opened
 */
export async function POST(req) {
  try {
    const body = await req.text();
    const headers = Object.fromEntries(req.headers.entries());

    // 1. Verify signature (skip in development if no webhook ID)
    if (process.env.PAYPAL_WEBHOOK_ID) {
      const verify = await verifyWebhookSignature(headers, body);
      if (!verify.ok || verify.data?.verification_status !== 'SUCCESS') {
        console.warn('Webhook signature verification failed:', verify.data);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const event = JSON.parse(body);
    const eventType = event.event_type;
    const resource = event.resource;

    console.log(`[PayPal Webhook] ${eventType}`, resource?.id);

    // Find org by subscription ID
    const findOrg = async (subscriptionId) => {
      if (!subscriptionId) return null;
      const snap = await adminDb.collection('organizations')
        .where('subscriptionId', '==', subscriptionId).limit(1).get();
      if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
      // Check pending
      const snap2 = await adminDb.collection('organizations')
        .where('pendingSubscriptionId', '==', subscriptionId).limit(1).get();
      if (!snap2.empty) return { id: snap2.docs[0].id, ...snap2.docs[0].data() };
      return null;
    };

    switch (eventType) {
      // ─── Subscription Activated ────────────────
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        const org = await findOrg(resource.id);
        if (org) {
          await adminDb.collection('organizations').doc(org.id).update({
            subscriptionId: resource.id,
            subscriptionStatus: 'active',
            subscriptionPlanId: resource.plan_id,
            subscriptionStartTime: resource.start_time,
            subscriptionTier: org.pendingSubscriptionTier || org.subscriptionTier,
            subscriptionCycle: org.pendingSubscriptionCycle || org.subscriptionCycle,
            subscriptionQuantity: parseInt(resource.quantity) || org.pendingSubscriptionQuantity,
            // Clear pending fields
            pendingSubscriptionId: null,
            pendingSubscriptionPlan: null,
            pendingSubscriptionTier: null,
            pendingSubscriptionCycle: null,
            pendingSubscriptionQuantity: null,
          });
        }
        break;
      }

      // ─── Recurring Payment Success ─────────────
      case 'PAYMENT.SALE.COMPLETED': {
        const subscriptionId = resource.billing_agreement_id;
        const org = await findOrg(subscriptionId);
        if (org) {
          const period = new Date().toISOString().slice(0, 7);
          // Record payment
          await adminDb.collection('payments').add({
            orgId: org.id,
            orgName: org.name || '',
            paypalSubscriptionId: subscriptionId,
            paypalSaleId: resource.id,
            amount: parseFloat(resource.amount?.total || 0),
            currency: resource.amount?.currency || 'EUR',
            tier: org.subscriptionTier || 'standard',
            billingCycle: org.subscriptionCycle || 'monthly',
            period,
            method: 'paypal_subscription',
            status: 'COMPLETED',
            createdAt: new Date().toISOString(),
          });
          // Update org
          await adminDb.collection('organizations').doc(org.id).update({
            lastPaymentDate: new Date().toISOString(),
            lastPaymentAmount: parseFloat(resource.amount?.total || 0),
            paidThrough: period,
            subscriptionStatus: 'active',
          });
        }
        break;
      }

      // ─── Subscription Cancelled ────────────────
      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        const org = await findOrg(resource.id);
        if (org) {
          await adminDb.collection('organizations').doc(org.id).update({
            subscriptionStatus: 'cancelled',
            subscriptionCancelledAt: new Date().toISOString(),
          });
        }
        break;
      }

      // ─── Subscription Suspended (payment failed) ─
      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        const org = await findOrg(resource.id);
        if (org) {
          await adminDb.collection('organizations').doc(org.id).update({
            subscriptionStatus: 'suspended',
          });
        }
        break;
      }

      // ─── Subscription Updated (quantity change) ─
      case 'BILLING.SUBSCRIPTION.UPDATED': {
        const org = await findOrg(resource.id);
        if (org) {
          await adminDb.collection('organizations').doc(org.id).update({
            subscriptionQuantity: parseInt(resource.quantity) || org.subscriptionQuantity,
            subscriptionStatus: resource.status?.toLowerCase() || org.subscriptionStatus,
          });
        }
        break;
      }

      // ─── Refund ────────────────────────────────
      case 'PAYMENT.SALE.REFUNDED': {
        const saleId = resource.sale_id;
        // Mark matching payment as refunded
        const paySnap = await adminDb.collection('payments')
          .where('paypalSaleId', '==', saleId).limit(1).get();
        if (!paySnap.empty) {
          await paySnap.docs[0].ref.update({ status: 'REFUNDED', refundedAt: new Date().toISOString() });
        }
        break;
      }

      // ─── Dispute ───────────────────────────────
      case 'CUSTOMER.DISPUTE.CREATED': {
        console.warn('[PayPal] Dispute created:', resource.dispute_id);
        // You may want to notify admin via email here
        break;
      }

      default:
        console.log(`[PayPal Webhook] Unhandled event: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
