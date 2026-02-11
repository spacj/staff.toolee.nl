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

    // Auto-ensure PayPal plans are configured (no user prompts)
    let configDoc = await adminDb.collection('config').doc('paypal').get();
    if (!configDoc.exists || !configDoc.data()?.plans) {
      console.log('[Subscribe] Plans not configured, creating automatically...');
      const result = await setupAllPlans();
      await adminDb.collection('config').doc('paypal').set({
        productId: result.productId,
        plans: result.plans,
        planVersion: 2,
        createdAt: new Date().toISOString(),
      });
      configDoc = await adminDb.collection('config').doc('paypal').get();
    }
    if (!configDoc.exists) {
      return NextResponse.json({ error: 'PayPal plans not configured after setup.' }, { status: 500 });
    }
    const plans = configDoc.data().plans;
    
    // Debug logging for troubleshooting
    console.log('[Subscribe Debug] Creating subscription with quantity:', quantity);

    // Determine plan ID
    let planId;
    if (tier === 'standard' && billingCycle === 'monthly') planId = plans.standardMonthly;
    else if (tier === 'standard' && billingCycle === 'yearly') planId = plans.standardYearly;
    else if (tier === 'enterprise' && billingCycle === 'monthly') planId = plans.enterpriseMonthly;
    else if (tier === 'enterprise' && billingCycle === 'yearly') planId = plans.enterpriseYearly;
    else return NextResponse.json({ error: 'Invalid tier/cycle combination' }, { status: 400 });

// For standard plans, quantity = total monthly cost in cents
    // For enterprise, quantity is not used (fixed price)
    const isEnterprise = tier === 'enterprise';
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Debug logging
    console.log('Subscription request:', {
      tier, billingCycle, quantity, isEnterprise,
      planId: plans.standardMonthly || plans.standardYearly || plans.enterpriseMonthly || plans.enterpriseYearly
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
    console.error('Error stack:', err.stack);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
