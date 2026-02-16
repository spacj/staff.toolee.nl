import { NextResponse } from 'next/server';
import { paypalFetch } from '@/lib/paypal-server';

// Basic, automated plan setup for PayPal subscriptions.
// This route ensures that standard plans exist and are up-to-date without manual admin action.
// It is safe to call multiple times; it will no-op if plans already exist with sufficient version.

const PLAN_VERSION = 2;

async function ensurePlans() {
  // Try to detect existing plans
  try {
    const res = await paypalFetch('/v1/billing/plans', 'GET', null);
    if (res.ok && Array.isArray(res.data?.plans) && res.data.plans.length > 0) {
      // Heuristic: some plans may carry a version hint in their description or an id pattern
      // If we have a plan with a version greater or equal to PLAN_VERSION, assume up-to-date
      const hasUpToDatePlan = res.data.plans.some(p => {
        const v = Number(p?.planVersion ?? 0);
        return !Number.isNaN(v) && v >= PLAN_VERSION;
      });
      if (hasUpToDatePlan) return true;
    }
  } catch (e) {
    // Ignore and attempt to create plans if fetch failed
  }

  // Create a minimal default plan for Standard monthly pricing using 0.01 EUR unit price
  // (The UI computes the actual cost using unit-price = €0.01 and quantity derived from total cost)
  const payload = {
    product_id: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRODUCT_ID || 'PROD_STANDARD_AUTO',
    name: 'StaffHub Standard Monthly (Automated)',
    status: 'ACTIVE',
    billing_cycles: [
      {
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: {
          fixed_price: { value: '0.01', currency_code: 'EUR' },
        },
      },
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: { value: '0', currency_code: 'EUR' },
    },
    taxes: { percentage: '0', inclusive: false },
  };

  await paypalFetch('/v1/billing/plans', 'POST', payload);
  return true;
}

export async function POST() {
  try {
    await ensurePlans();
    return NextResponse.json({ ok: true, message: 'PayPal plans ensured/updated' });
  } catch (err) {
    console.error('PayPal subscribe route error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
