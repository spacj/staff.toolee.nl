#!/usr/bin/env node
/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║   StaffHub — One-Time PayPal Plan Setup Script           ║
 * ║   Run: node scripts/setup-paypal.mjs                     ║
 * ║   Only needs to run ONCE. Creates product + 4 plans.     ║
 * ╚═══════════════════════════════════════════════════════════╝
 *
 * Before running, set these environment variables:
 *   export PAYPAL_CLIENT_ID=your_client_id
 *   export PAYPAL_SECRET=your_secret
 *   export PAYPAL_MODE=sandbox     (or "live" for production)
 */

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const SECRET = process.env.PAYPAL_SECRET;
const MODE = process.env.PAYPAL_MODE || 'sandbox';
const BASE = MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

if (!CLIENT_ID || !SECRET) {
  console.error('\n❌ Missing credentials. Run with:\n');
  console.error('  PAYPAL_CLIENT_ID=xxx PAYPAL_SECRET=yyy node scripts/setup-paypal.mjs\n');
  process.exit(1);
}

console.log(`\n🔧 Setting up PayPal plans (${MODE} mode)...\n`);

// ─── Auth ─────────────────────────────────────────────
async function getToken() {
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) { console.error('Auth failed:', data); process.exit(1); }
  return data.access_token;
}

async function api(token, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) { console.error(`❌ ${path} failed:`, JSON.stringify(data, null, 2)); process.exit(1); }
  return data;
}

async function main() {
  const token = await getToken();
  console.log('✅ Authenticated with PayPal\n');

  // 1. Create Product
  const product = await api(token, '/v1/catalogs/products', {
    name: 'StaffHub',
    description: 'Staff management — scheduling, attendance, payroll.',
    type: 'SERVICE',
    category: 'SOFTWARE',
  });
  console.log(`✅ Product created: ${product.id}`);

  // 2. Create 4 Plans
  const makePlan = (name, interval, unitPrice) => api(token, '/v1/billing/plans', {
    product_id: product.id,
    name,
    description: `StaffHub ${name}`,
    billing_cycles: [{
      frequency: { interval_unit: interval, interval_count: 1 },
      tenure_type: 'REGULAR', sequence: 1, total_cycles: 0,
      pricing_scheme: { fixed_price: { value: unitPrice, currency_code: 'EUR' } },
    }],
    payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 3 },
    quantity_supported: true,
  });

  // Standard: €1/unit pricing. Quantity = total monthly cost.
  // Formula: workers×€2 + max(0, shops-1)×€15 (1st shop free)
  // Monthly: quantity × €1/month.  Yearly: quantity × €10/year (2 months free).
  const sm = await makePlan('Standard Monthly', 'MONTH', '1.00');
  console.log(`✅ Standard Monthly: ${sm.id}`);
  const sy = await makePlan('Standard Yearly', 'YEAR', '10.00');
  console.log(`✅ Standard Yearly:  ${sy.id}`);

  // Enterprise: fixed price. Quantity = 1 always.
  // Monthly: 1 × €99. Yearly: 1 × €990.
  const em = await makePlan('Enterprise Monthly', 'MONTH', '99.00');
  console.log(`✅ Enterprise Monthly: ${em.id}`);
  const ey = await makePlan('Enterprise Yearly', 'YEAR', '990.00');
  console.log(`✅ Enterprise Yearly:  ${ey.id}`);

  // 3. Print env vars
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  DONE! Add these to your .env.local (and Vercel env vars):  ║
╚══════════════════════════════════════════════════════════════╝

NEXT_PUBLIC_PAYPAL_PLAN_STANDARD_MONTHLY=${sm.id}
NEXT_PUBLIC_PAYPAL_PLAN_STANDARD_YEARLY=${sy.id}
NEXT_PUBLIC_PAYPAL_PLAN_ENTERPRISE_MONTHLY=${em.id}
NEXT_PUBLIC_PAYPAL_PLAN_ENTERPRISE_YEARLY=${ey.id}

These plan IDs are permanent — they never need to be recreated.
`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
