/**
 * PayPal Server-Side Helpers — MINIMAL
 * Only used by webhook + sync API routes.
 */

const PAYPAL_BASE = process.env.NEXT_PUBLIC_PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function getAccessToken() {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error('PayPal credentials missing');
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('PayPal auth failed: ' + (data.error_description || data.error));
  return data.access_token;
}

async function paypalFetch(path, method = 'GET', body = null) {
  const token = await getAccessToken();
  const opts = {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${PAYPAL_BASE}${path}`, opts);
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

export async function verifyWebhookSignature(headers, body) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return { ok: true, data: { verification_status: 'SUCCESS' } }; // skip in dev
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

export async function updateSubscriptionQuantity(subscriptionId, newQuantity) {
  return paypalFetch(`/v1/billing/subscriptions/${subscriptionId}/revise`, 'POST', {
    quantity: String(newQuantity),
  });
}

export async function cancelSubscription(subscriptionId, reason) {
  return paypalFetch(`/v1/billing/subscriptions/${subscriptionId}/cancel`, 'POST', {
    reason: reason || 'Cancelled by customer',
  });
}

export async function suspendSubscription(subscriptionId, reason) {
  return paypalFetch(`/v1/billing/subscriptions/${subscriptionId}/suspend`, 'POST', {
    reason: reason || 'Downgraded to free tier',
  });
}

export async function activateSubscription(subscriptionId, reason) {
  return paypalFetch(`/v1/billing/subscriptions/${subscriptionId}/activate`, 'POST', {
    reason: reason || 'Reactivated',
  });
}

export { getAccessToken, paypalFetch, PAYPAL_BASE };
