# StaffHub — Staff Management Platform

Next.js 14 + Firebase + PayPal automatic subscriptions.

---

## Quick Start

```bash
npm install
cp .env.local.example .env.local
# Fill in Firebase + PayPal credentials (see below)
npm run dev
```

---

## Setup Guide (Step by Step)

### Step 1 — Firebase

1. Go to [Firebase Console](https://console.firebase.google.com) → Create project
2. Enable **Authentication** → Email/Password + Google sign-in
3. Enable **Cloud Firestore** → Start in test mode
4. Go to **Project Settings** → General → Your apps → Add web app
5. Copy the config values to `.env.local`:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```

### Step 2 — Firebase Admin SDK (for webhook/sync routes)

1. Firebase Console → **Project Settings** → **Service Accounts**
2. Click **Generate New Private Key** → downloads a JSON file
3. Open the JSON and copy these values to `.env.local`:
   ```
   FIREBASE_ADMIN_PROJECT_ID=your_project_id
   FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
   ```
   **⚠️ On Vercel:** Paste the private key as-is (with real newlines) into the env var field. Vercel handles multi-line values correctly. Do NOT wrap in quotes on Vercel.

### Step 3 — PayPal Credentials

1. Go to [PayPal Developer](https://developer.paypal.com) → **Apps & Credentials**
2. Create a **Sandbox app** (or use default)
3. Copy **Client ID** and **Secret** to `.env.local`:
   ```
   NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_client_id
   PAYPAL_CLIENT_SECRET=your_secret
   NEXT_PUBLIC_PAYPAL_MODE=sandbox
   ```

### Step 4 — Create PayPal Billing Plans (run ONCE)

This creates the subscription plans on your PayPal account. Only needs to run once ever.

```bash
PAYPAL_CLIENT_ID=your_client_id PAYPAL_SECRET=your_secret node scripts/setup-paypal.mjs
```

It will print 4 plan IDs. Add them to `.env.local`:
```
NEXT_PUBLIC_PAYPAL_PLAN_STANDARD_MONTHLY=P-xxxxxxxxx
NEXT_PUBLIC_PAYPAL_PLAN_STANDARD_YEARLY=P-xxxxxxxxx
NEXT_PUBLIC_PAYPAL_PLAN_ENTERPRISE_MONTHLY=P-xxxxxxxxx
NEXT_PUBLIC_PAYPAL_PLAN_ENTERPRISE_YEARLY=P-xxxxxxxxx
```

These plan IDs are **permanent** — they never expire or need to be recreated.

### Step 5 — PayPal Webhook (recommended)

This ensures payments are tracked even if the browser closes.

1. PayPal Developer → **Webhooks** → **Add Webhook**
2. URL: `https://yourdomain.com/api/paypal/webhook`
3. Subscribe to these events:
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.SUSPENDED`
   - `PAYMENT.SALE.COMPLETED`
   - `PAYMENT.SALE.REFUNDED`
   - `CUSTOMER.DISPUTE.CREATED`
4. Copy the **Webhook ID** to `.env.local`:
   ```
   PAYPAL_WEBHOOK_ID=your_webhook_id
   ```

### Step 6 — Deploy to Vercel

1. Push code to GitHub
2. Import in [Vercel](https://vercel.com) → New Project
3. Add ALL env vars from `.env.local` to Vercel's environment variables
4. Deploy
5. Update PayPal webhook URL to your Vercel domain

**For production:** Change `NEXT_PUBLIC_PAYPAL_MODE=live` and use live PayPal credentials + plan IDs.

---

## How Billing Works

### Pricing

| Tier | Workers | Monthly | Yearly (2 months free) |
|------|---------|---------|------------------------|
| Free | 0–4 | €0 | €0 |
| Standard | 5–20 | €2/worker + €15/shop | ×10 months |
| Enterprise | 21+ | €99 flat | €990 flat |

### Automatic Billing

- **Subscribe once** → PayPal handles all future charges automatically
- User picks **monthly or yearly** billing at checkout
- PayPal charges the customer on schedule — they don't need to do anything
- If payment fails, PayPal retries up to 3 times before suspending

### Smart Worker-Count Sync

Standard plans use **quantity-based pricing** (€1/unit, quantity = total cost):
- 8 workers + 2 shops = 8×€2 + 2×€15 = €46 → quantity = 46
- When you add/remove workers or shops, `syncOrgPlan()` calls `/api/paypal/sync`
- This PATCHes the subscription quantity on PayPal
- Next billing cycle charges the updated amount automatically

### Architecture

```
┌─────────────────────────────────────────────────────┐
│  Client (browser)                                   │
│  ┌──────────────────────┐                           │
│  │ PayPal Subscribe     │ ← @paypal/react-paypal-js │
│  │ Button (popup)       │    No server route needed  │
│  └──────┬───────────────┘                           │
│         │ onApprove → saves subscriptionId           │
│         │              to Firestore directly          │
└─────────┼───────────────────────────────────────────┘
          │
┌─────────┼───────────────────────────────────────────┐
│  PayPal │                                           │
│         ├─── Auto charges every month/year ───────► │
│         │                                           │
│         └─── Webhook events ──────────────────────► │
└─────────────────────────────┼───────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────┐
│  Server (only 2 routes)     │                       │
│  /api/paypal/webhook  ◄─────┘  Records payments     │
│  /api/paypal/sync     ◄── Worker/shop changes       │
└─────────────────────────────────────────────────────┘
```

---

## Firestore Indexes

Add in Firebase Console → Firestore → Indexes:

```
notifications: [recipientId ASC, createdAt DESC]
attendance:    [workerId ASC, date DESC]
attendance:    [orgId ASC, date DESC]
```

---

## File Structure

```
src/
├── app/
│   ├── api/paypal/
│   │   ├── webhook/route.js    ← PayPal event handler
│   │   └── sync/route.js       ← Subscription quantity sync
│   ├── costs/page.js           ← Billing page
│   ├── dashboard/page.js
│   ├── staff/page.js
│   ├── calendar/page.js
│   ├── time/page.js
│   ├── attendance/page.js
│   ├── shifts/page.js
│   ├── shops/page.js
│   └── settings/page.js
├── components/
│   ├── PayPalCheckout.jsx      ← Subscribe buttons (client-side)
│   └── ...
├── lib/
│   ├── firebase.js             ← Client Firebase
│   ├── firebase-admin.js       ← Admin SDK (server only)
│   ├── firestore.js            ← All Firestore operations
│   ├── paypal-server.js        ← PayPal API helpers (server only)
│   ├── pricing.js              ← Tier logic + calculations
│   └── scheduling.js           ← Shift scheduling
└── scripts/
    └── setup-paypal.mjs        ← One-time plan creation
```
