import { NextResponse } from 'next/server';
import { createSubscription } from '@/lib/paypal-server';
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

// Get plan IDs from Firestore config
    const configDoc = await adminDb.collection('config').doc('paypal').get();
    if (!configDoc.exists) {
      return NextResponse.json({ error: 'PayPal plans not configured. Run setup first.' }, { status: 400 });
    }
    const { plans, planVersion } = configDoc.data();
    
    // Check if plans support decimal pricing (version 2+)
    const supportsDecimalPricing = planVersion >= 2;
    console.log('[Subscribe Debug] Plan version:', planVersion, 'Supports decimal:', supportsDecimalPricing, 'Quantity:', quantity);
    
    if (!supportsDecimalPricing && quantity && quantity > 100) {
      console.log('[Subscribe Debug] Decimal pricing not supported, returning error');
      return NextResponse.json({ 
        error: 'PayPal plans need to be recreated to support decimal pricing. Please contact admin.',
        needsPlanRecreation: true,
        currentVersion: planVersion || 1,
        requiredVersion: 2
      }, { status: 400 });
    }

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

    // Check if quantity suggests a pricing mismatch (quantity > 100 suggests cents-based pricing)
    if (quantity && quantity > 100 && !isEnterprise) {
      console.warn('Large quantity detected, may need to recreate PayPal plans with €0.01/unit pricing');
    }

    const result = await createSubscription(
      planId,
      isEnterprise ? null : quantity,
      { name: subscriberName, email: subscriberEmail },
      `${origin}/costs?subscription=success&orgId=${orgId}`,
      `${origin}/costs?subscription=cancelled`
    );

if (!result.ok) {
      console.error('PayPal subscription creation failed:', result.status, result.data);
      
      // Specific handling for 422 semantic error (pricing mismatch)
      if (result.status === 422) {
        return NextResponse.json({ 
          error: 'PayPal pricing mismatch. Please recreate PayPal plans with new decimal pricing.',
          detail: result.data,
          needsPlanRecreation: true,
          status: result.status 
        }, { status: 422 });
      }
      
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
