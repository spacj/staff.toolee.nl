import { NextResponse } from 'next/server';
import { createSubscription, setupAllPlans } from '@/lib/paypal-server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/paypal/subscribe
 * Body: { orgId, tier, billingCycle, quantity, subscriberName, subscriberEmail }
 * Returns: { subscriptionId, approvalUrl }
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { orgId, tier, billingCycle, quantity, subscriberName, subscriberEmail } = body;

    if (!orgId || !tier || !billingCycle) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Auto-ensure PayPal plans are configured with decimal pricing
    let configDoc = await adminDb.collection('config').doc('paypal').get();
    const configData = configDoc.data();
    
    if (!configDoc.exists || !configData?.plans || configData?.planVersion < 2) {
      console.log('[Subscribe] Creating PayPal plans with decimal pricing...');
      try {
        const result = await setupAllPlans();
        await adminDb.collection('config').doc('paypal').set({
          productId: result.productId,
          plans: result.plans,
          planVersion: 2,
          createdAt: new Date().toISOString(),
        });
        configDoc = await adminDb.collection('config').doc('paypal').get();
      } catch (setupErr) {
        console.error('[Subscribe] Auto-setup failed:', setupErr);
        return NextResponse.json({ 
          error: 'Failed to create PayPal plans automatically: ' + setupErr.message,
          needsPlanRecreation: true
        }, { status: 500 });
      }
    }
    
    const plans = configData?.plans || {};
    console.log('[Subscribe] Using plans:', plans);

    // Determine plan ID
    let planId;
    if (tier === 'standard' && billingCycle === 'monthly') planId = plans.standardMonthly;
    else if (tier === 'standard' && billingCycle === 'yearly') planId = plans.standardYearly;
    else if (tier === 'enterprise' && billingCycle === 'monthly') planId = plans.enterpriseMonthly;
    else if (tier === 'enterprise' && billingCycle === 'yearly') planId = plans.enterpriseYearly;
    else return NextResponse.json({ error: 'Invalid tier/cycle combination' }, { status: 400 });

    // For enterprise, quantity is not used (fixed price)
    const isEnterprise = tier === 'enterprise';
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    console.log('[Subscribe Debug] Creating subscription:', {
      planId,
      quantity,
      isEnterprise,
      tier,
      billingCycle,
      subscriberName,
      subscriberEmail
    });

    const result = await createSubscription(
      planId,
      isEnterprise ? null : quantity,
      { name: subscriberName, email: subscriberEmail },
      `${origin}/costs?subscription=success&orgId=${orgId}`,
      `${origin}/costs?subscription=cancelled`
    );

    if (!result.ok) {
      console.error('PayPal subscription creation failed:', result.status, result.data);
      return NextResponse.json({ 
        error: 'Failed to create subscription', 
        detail: result.data,
        status: result.status 
      }, { status: 500 });
    }

    const approvalUrl = result.data.links?.find(l => l.rel === 'approve')?.href;

    // Store pending subscription on org
    await adminDb.collection('organizations').doc(orgId).update({
      pendingSubscriptionId: result.data.id,
      pendingSubscriptionPlan: planId,
      pendingSubscriptionTier: tier,
      pendingSubscriptionCycle: billingCycle,
      pendingSubscriptionQuantity: quantity || null,
    });

    return NextResponse.json({
      subscriptionId: result.data.id,
      approvalUrl,
      status: result.data.status,
    });
  } catch (err) {
    console.error('Subscribe error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}