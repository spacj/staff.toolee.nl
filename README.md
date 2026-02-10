# StaffHub — Staff Management Platform

Next.js 14 + Firebase + PayPal Subscriptions.

## Quick Start
```bash
npm install
cp .env.local.example .env.local  # Fill in your Firebase + PayPal keys
npm run dev
```

## PayPal Subscription Setup

### 1. PayPal Developer Account
- Go to https://developer.paypal.com → Dashboard → Apps & Credentials
- Create an app (or use default sandbox app)
- Copy **Client ID** and **Secret** to `.env.local`

### 2. Create Billing Plans (one-time)
- Start your dev server: `npm run dev`
- Go to **Costs & Billing** page as admin
- Click **"Create PayPal Plans"** button
- This creates 4 plans in PayPal: Standard Monthly, Standard Yearly, Enterprise Monthly, Enterprise Yearly
- Plan IDs are stored in Firestore `config/paypal` doc

### 3. Configure Webhook
In PayPal Developer Dashboard → Webhooks → Add Webhook:
- **URL:** `https://yourdomain.com/api/paypal/webhook`
- **Events to subscribe:**
  - `BILLING.SUBSCRIPTION.ACTIVATED`
  - `BILLING.SUBSCRIPTION.CANCELLED`
  - `BILLING.SUBSCRIPTION.SUSPENDED`
  - `BILLING.SUBSCRIPTION.UPDATED`
  - `PAYMENT.SALE.COMPLETED`
  - `PAYMENT.SALE.REFUNDED`
  - `CUSTOMER.DISPUTE.CREATED`
- Copy the **Webhook ID** to `.env.local` as `PAYPAL_WEBHOOK_ID`

### 4. Firebase Admin SDK
The API routes need Firebase Admin. In Firebase Console:
- Project Settings → Service Accounts → Generate New Private Key
- Copy `project_id`, `client_email`, `private_key` to `.env.local`

## How Billing Works

### Pricing Tiers
| Tier | Workers | Monthly | Yearly (save ~17%) |
|------|---------|---------|-----|
| Free | 0–4 | €0 | €0 |
| Standard | 5–20 | €2/worker + €15/shop | ×10 (2 months free) |
| Enterprise | 21+ | €99 flat | €990 flat |

### Smart Worker-Based Auto-Billing
Standard plan uses **quantity-based subscriptions** on PayPal:
- Unit price: €1/month (or €10/year)
- Quantity = total monthly cost (e.g. 8 workers + 2 shops = 8×€2 + 2×€15 = €46 → quantity=46)
- When you **add/remove workers or shops**, `syncOrgPlan()` calls `/api/paypal/sync` which PATCHes the subscription quantity
- PayPal automatically charges the new amount on the next billing cycle
- **No manual intervention needed** — pricing adjusts with your team size

### Tier Transitions
- **Free → Standard:** Admin subscribes from Costs page. Subscription created.
- **Standard → Enterprise (21+ workers):** Current subscription quantity covers it, or admin is prompted to switch plan.
- **Paid → Free (remove workers):** Subscription is auto-suspended. Reactivates when workers are added back.

## Firestore Collections
- `config/paypal` — PayPal product/plan IDs (created by setup route)
- `organizations` — subscription fields: `subscriptionId`, `subscriptionStatus`, `subscriptionCycle`, `subscriptionQuantity`, `subscriptionTier`
- `payments` — auto-recorded by webhook on each billing cycle

## Deploy
```bash
npm run build
# Deploy to Vercel, Firebase Hosting, etc.
# Set all env vars in your hosting platform
# Update NEXT_PUBLIC_BASE_URL to your production URL
# Update PayPal webhook URL to production
# Switch NEXT_PUBLIC_PAYPAL_MODE=live for production
```
