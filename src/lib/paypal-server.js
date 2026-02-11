/**
 * PayPal Server-Side API Helpers
 *
 * Uses PayPal Subscriptions API for recurring billing.
 * Strategy: Plans use €0.01/unit pricing. Quantity = total monthly cost in cents.
 * When workers/shops change → update subscription quantity → PayPal auto-adjusts billing.
 *
 * Plans created:
 *   standard-monthly  → €0.01/unit/month  (quantity = total monthly cost × 100)
 *   standard-yearly   → €0.01/unit/year   (quantity = same — effectively 2 months free)
 *   enterprise-monthly → €99/month fixed
 *   enterprise-yearly  → €990/year fixed (2 months free)
 */

const PAYPAL_BASE = process.env.NEXT_PUBLIC_PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// ─── Auth ─────────────────────────────────────────────
async function getAccessToken() {
  const auth = Buffer.from(
    `${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('PayPal auth failed: ' + JSON.stringify(data));
  return data.access_token;
}

async function paypalFetch(path, method = 'GET', body = null) {
  const token = await getAccessToken();
  const opts = {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${PAYPAL_BASE}${path}`, opts);
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

// ─── Products ─────────────────────────────────────────
export async function createProduct() {
  return paypalFetch('/v1/catalogs/products', 'POST', {
    name: 'StaffHub',
    description: 'Staff management platform — scheduling, attendance, payroll.',
    type: 'SERVICE',
    category: 'SOFTWARE',
  });
}

// ─── Plans ────────────────────────────────────────────
export async function createPlan(productId, { name, interval, intervalCount, fixedPrice, unitPrice }) {
  const billingCycles = [];

  if (fixedPrice) {
    // Fixed-price plan (Enterprise)
    billingCycles.push({
      frequency: { interval_unit: interval, interval_count: intervalCount || 1 },
      tenure_type: 'REGULAR',
      sequence: 1,
      total_cycles: 0, // infinite
      pricing_scheme: { fixed_price: { value: fixedPrice, currency_code: 'EUR' } },
    });
  } else {
    // Quantity-based plan (Standard) — €0.01/unit, quantity = total cost in cents
    billingCycles.push({
      frequency: { interval_unit: interval, interval_count: intervalCount || 1 },
      tenure_type: 'REGULAR',
      sequence: 1,
      total_cycles: 0,
      pricing_scheme: { fixed_price: { value: unitPrice || '0.01', currency_code: 'EUR' } },
    });
  }

  return paypalFetch('/v1/billing/plans', 'POST', {
    product_id: productId,
    name,
    description: `StaffHub ${name}`,
    billing_cycles: billingCycles,
    payment_preferences: {
      auto_bill_outstanding: true,
      payment_failure_threshold: 3,
    },
  });
}

// ─── Setup all plans at once ──────────────────────────
export async function setupAllPlans() {
  // 1. Create product
  const productRes = await createProduct();
  if (!productRes.ok) throw new Error('Failed to create product: ' + JSON.stringify(productRes.data));
  const productId = productRes.data.id;

  // 2. Create plans
  const plans = {};

  // Standard Monthly: €0.01/unit/month (quantity = total monthly cost × 100)
  const sm = await createPlan(productId, { name: 'Standard Monthly', interval: 'MONTH', unitPrice: '0.01' });
  if (!sm.ok) throw new Error('Standard Monthly plan failed');
  plans.standardMonthly = sm.data.id;

  // Standard Yearly: €1/unit/year (quantity = monthly cost × 100 → effective 2 months free)
  const sy = await createPlan(productId, { name: 'Standard Yearly', interval: 'YEAR', unitPrice: '1.00' });
  if (!sy.ok) throw new Error('Standard Yearly plan failed');
  plans.standardYearly = sy.data.id;

  // Enterprise Monthly: flat €99/month
  const em = await createPlan(productId, { name: 'Enterprise Monthly', interval: 'MONTH', fixedPrice: '99.00' });
  if (!em.ok) throw new Error('Enterprise Monthly plan failed');
  plans.enterpriseMonthly = em.data.id;

  // Enterprise Yearly: flat €990/year (2 months free)
  const ey = await createPlan(productId, { name: 'Enterprise Yearly', interval: 'YEAR', fixedPrice: '990.00' });
  if (!ey.ok) throw new Error('Enterprise Yearly plan failed');
  plans.enterpriseYearly = ey.data.id;

  return { productId, plans };
}

// ─── Subscriptions ────────────────────────────────────
export async function createSubscription(planId, quantity, subscriber, returnUrl, cancelUrl) {
  const body = {
    plan_id: planId,
    subscriber: {
      name: { given_name: subscriber.name?.split(' ')[0] || '', surname: subscriber.name?.split(' ').slice(1).join(' ') || '' },
      email_address: subscriber.email,
    },
    application_context: {
      brand_name: 'StaffHub',
      locale: 'en-US',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'SUBSCRIBE_NOW',
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  };

  // For quantity-based plans (Standard), set quantity
  if (quantity && quantity > 0) {
    body.quantity = String(quantity);
  }

  return paypalFetch('/v1/billing/subscriptions', 'POST', body);
}

export async function getSubscription(subscriptionId) {
  return paypalFetch(`/v1/billing/subscriptions/${subscriptionId}`);
}

export async function updateSubscriptionQuantity(subscriptionId, newQuantity) {
  // PayPal uses PATCH to revise subscription
  return paypalFetch(`/v1/billing/subscriptions/${subscriptionId}/revise`, 'POST', {
    quantity: String(newQuantity),
  });
}

export async function cancelSubscription(subscriptionId, reason) {
  return paypalFetch(`/v1/billing/subscriptions/${subscriptionId}/cancel`, 'POST', {
    reason: reason || 'Customer requested cancellation',
  });
}

export async function suspendSubscription(subscriptionId, reason) {
  return paypalFetch(`/v1/billing/subscriptions/${subscriptionId}/suspend`, 'POST', {
    reason: reason || 'Downgraded to free tier',
  });
}

export async function activateSubscription(subscriptionId, reason) {
  return paypalFetch(`/v1/billing/subscriptions/${subscriptionId}/activate`, 'POST', {
    reason: reason || 'Upgraded from free tier',
  });
}

// ─── Webhook Verification ─────────────────────────────
export async function verifyWebhookSignature(headers, body) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return { ok: false, data: { error: 'PAYPAL_WEBHOOK_ID not configured' } };

  return paypalFetch('/v1/notifications/verify-webhook-signature', 'POST', {
    auth_algo: headers['paypal-auth-algo'],
    cert_url: headers['paypal-cert-url'],
    transmission_id: headers['paypal-transmission-id'],
    transmission_sig: headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id: webhookId,
    webhook_event: typeof body === 'string' ? JSON.parse(body) : body,
  });
}

export { getAccessToken, paypalFetch, PAYPAL_BASE };
