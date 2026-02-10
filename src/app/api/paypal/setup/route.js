import { NextResponse } from 'next/server';
import { setupAllPlans } from '@/lib/paypal-server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/paypal/setup
 * One-time: Creates PayPal product + 4 billing plans, stores IDs in Firestore.
 * Call once from admin (Settings page) or curl.
 */
export async function POST(req) {
  try {
    // Check if plans already exist
    const configDoc = await adminDb.collection('config').doc('paypal').get();
    if (configDoc.exists && configDoc.data()?.plans?.standardMonthly) {
      return NextResponse.json({ message: 'Plans already set up', ...configDoc.data() });
    }

    const result = await setupAllPlans();

    // Store in Firestore config collection
    await adminDb.collection('config').doc('paypal').set({
      productId: result.productId,
      plans: result.plans,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('PayPal setup error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: check current plan config
export async function GET() {
  try {
    const configDoc = await adminDb.collection('config').doc('paypal').get();
    if (!configDoc.exists) return NextResponse.json({ configured: false });
    return NextResponse.json({ configured: true, ...configDoc.data() });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
