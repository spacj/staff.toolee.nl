/**
 * Staff2 Pricing & Tier Enforcement
 *
 * Free:   0–4 employees, 1 shop     → €0
 * Basic:  5–30 employees            → €2/employee + €15/extra shop (1st shop free)
 * Pro:    31+ employees             → €249/mo flat up to 50 employees,
 *                                      then +€4/employee beyond 50.
 *                                      Includes Stock, Checklists & Knowledge Base.
 *
 * Yearly billing = monthly × 10 (2 months free, ~17% discount) on every paid tier.
 *
 * Recurring billing (subscription): PayPal metered plan at €0.01/unit — the
 * subscription "quantity" equals the total monthly (or yearly) cost in cents, so
 * any tier (including Pro's variable price) bills correctly on a single plan.
 *
 * One-time fixed-price purchases (e.g. Staff Setup €50) use the PayPal Orders API
 * (capture intent) — buy on the spot. Variable services (Inventory Setup from €199,
 * Knowledge Base from €399) open a ticket for a quote.
 *
 * NOTE: internal tier keys stay 'free' / 'standard' / 'enterprise' for data
 * compatibility with existing organization documents; display names are
 * Free / Basic / Pro.
 */
const PRICE_PER_WORKER = 2;
const PRICE_PER_SHOP = 15;
const FREE_WORKER_LIMIT = 4;
const PROMO_WORKER_LIMIT = 10;
const FREE_SHOP_LIMIT = 1;
const BASIC_MAX_WORKERS = 30;          // Basic covers up to 30 employees
const ENTERPRISE_THRESHOLD = 31;       // Pro required at 31+ employees
const PRO_PRICE_MONTHLY = 249;         // Pro flat price (up to PRO_INCLUDED_WORKERS)
const PRO_INCLUDED_WORKERS = 50;       // employees included in the flat Pro price
const PRO_EXTRA_WORKER = 4;            // €/employee beyond PRO_INCLUDED_WORKERS
const YEARLY_MULTIPLIER = 10;          // ×10 = pay for 10 months, get 12

// Back-compat aliases for old "Enterprise" naming used across the app.
const ENTERPRISE_PRICE_MONTHLY = PRO_PRICE_MONTHLY;
const ENTERPRISE_DISCOUNTED_PRICE = PRO_PRICE_MONTHLY;

// ─── Inventory (Stock + Recipes) add-on & services ───
const STOCK_ADDON_MONTHLY = 19.99;    // €19.99/mo per org (free on Pro)
const STAFF_SETUP_FEE = 50;           // fixed one-time — buy on the spot
const INVENTORY_SETUP_FROM = 199;     // variable done-for-you service — request a quote
const KB_SETUP_FROM = 399;            // variable knowledge-base build — request a quote
const INVENTORY_SETUP_FEE = INVENTORY_SETUP_FROM; // back-compat alias
// Orgs created before this date keep Stock & Recipes for free (grandfathered).
const INVENTORY_LAUNCH = '2026-08-28';

export const TIERS = { FREE: 'free', STANDARD: 'standard', ENTERPRISE: 'enterprise' };
export const CYCLES = { MONTHLY: 'monthly', YEARLY: 'yearly' };

export function getTier(workerCount, freeLimit = FREE_WORKER_LIMIT) {
  if (workerCount <= freeLimit) return TIERS.FREE;
  if (workerCount <= BASIC_MAX_WORKERS) return TIERS.STANDARD;
  return TIERS.ENTERPRISE;
}

export function getTierInfo(tier) {
  const tiers = {
    free: { name: 'Free', badge: 'bg-emerald-100 text-emerald-700', price: '€0', period: '',
      tagline: `Up to ${FREE_WORKER_LIMIT} employees & ${FREE_SHOP_LIMIT} shop`,
      features: [`Up to ${FREE_WORKER_LIMIT} employees`, `${FREE_SHOP_LIMIT} shop included`, 'Shift scheduling', 'Clock in/out', 'Calendar'] },
    standard: { name: 'Basic', badge: 'bg-brand-100 text-brand-700', price: `€${PRICE_PER_WORKER}`, period: '/employee/mo',
      tagline: `${FREE_WORKER_LIMIT + 1}–${BASIC_MAX_WORKERS} employees`,
      features: ['Everything in Free', `€${PRICE_PER_WORKER}/employee/month`, `1st shop free, then €${PRICE_PER_SHOP}/shop/mo`, 'Save ~17% with yearly billing', 'Attendance tracking', 'Cost analytics'] },
    enterprise: { name: 'Pro', badge: 'bg-purple-100 text-purple-700', price: `€${PRO_PRICE_MONTHLY}`, period: '/mo',
      tagline: `${ENTERPRISE_THRESHOLD}+ employees`,
      features: ['Everything in Basic', `Up to ${PRO_INCLUDED_WORKERS} employees included`, `+€${PRO_EXTRA_WORKER}/employee beyond ${PRO_INCLUDED_WORKERS}`, 'Stock & Recipes included', 'Checklists & Knowledge Base', 'Priority support'] },
  };
  return tiers[tier] || tiers.free;
}

/**
 * Calculate cost for a given billing cycle.
 * @param {object} opts - {
 *   inventoryAddon: paid Stock+Recipes module (€19.99/mo, free on Pro),
 *   proPlan: force the Pro plan even below the 31-employee threshold (opt-in upgrade),
 * }
 */
export function calculateCost(workerCount, shopCount, cycle = 'monthly', freeLimit = FREE_WORKER_LIMIT, opts = {}) {
  // Pro is auto-selected at 31+ employees, or chosen as an upgrade at any size.
  const tier = opts.proPlan ? TIERS.ENTERPRISE : getTier(workerCount, freeLimit);
  const isYearly = cycle === 'yearly';
  const wantsAddon = !!opts.inventoryAddon;
  // Enterprise includes Inventory; other tiers pay the monthly add-on.
  const addonMonthly = wantsAddon && tier !== TIERS.ENTERPRISE ? STOCK_ADDON_MONTHLY : 0;
  const addonCost = isYearly ? addonMonthly * YEARLY_MULTIPLIER : addonMonthly;

  if (tier === TIERS.FREE) {
    const monthlyTotal = addonMonthly;
    const total = addonCost;
    const savings = isYearly ? (addonMonthly * 12) - addonCost : 0;
    return {
      total: Math.round(total * 100) / 100, monthlyEquivalent: Math.round((isYearly ? total / 12 : total) * 100) / 100,
      workerCost: 0, shopCost: 0, addonCost: Math.round(addonCost * 100) / 100, addonMonthly,
      monthlyTotal, billableShops: 0, billableWorkers: 0,
      tier, cycle, tierInfo: getTierInfo(tier), workerCount, shopCount, savings, freeLimit, inventoryAddon: wantsAddon,
    };
  }

  if (tier === TIERS.ENTERPRISE) {
    // Pro: €249 flat up to PRO_INCLUDED_WORKERS, then +€4/employee. Inventory bundled free.
    const extraWorkers = Math.max(0, workerCount - PRO_INCLUDED_WORKERS);
    const extraMonthly = extraWorkers * PRO_EXTRA_WORKER;
    const monthly = PRO_PRICE_MONTHLY + extraMonthly;
    const total = isYearly ? monthly * YEARLY_MULTIPLIER : monthly;
    const monthlyEquiv = isYearly ? total / 12 : monthly;
    const savings = isYearly ? (monthly * 12) - total : 0;
    return {
      total: Math.round(total * 100) / 100,
      monthlyEquivalent: Math.round(monthlyEquiv * 100) / 100,
      workerCost: isYearly ? Math.round(extraMonthly * YEARLY_MULTIPLIER * 100) / 100 : extraMonthly,
      shopCost: 0, addonCost: 0, addonMonthly: 0,
      proBase: PRO_PRICE_MONTHLY, extraWorkers,
      monthlyTotal: monthly, billableShops: 0, billableWorkers: extraWorkers,
      tier, cycle, tierInfo: getTierInfo(tier), workerCount, shopCount, savings, freeLimit, inventoryAddon: wantsAddon,
    };
  }

  // Standard — first `freeLimit` workers are free, additional workers €2/mo each
  // First shop is free, additional shops €15/mo each
  const billableWorkers = Math.max(0, workerCount - freeLimit);
  const workerCostMonthly = billableWorkers * PRICE_PER_WORKER;
  const billableShops = Math.max(0, shopCount - 1);
  const shopCostMonthly = billableShops * PRICE_PER_SHOP;
  const monthlyTotal = workerCostMonthly + shopCostMonthly + addonMonthly;
  const total = isYearly ? monthlyTotal * YEARLY_MULTIPLIER : monthlyTotal;
  const monthlyEquiv = isYearly ? total / 12 : monthlyTotal;
  const savings = isYearly ? (monthlyTotal * 12) - total : 0;

  return {
    total: Math.round(total * 100) / 100,
    monthlyEquivalent: Math.round(monthlyEquiv * 100) / 100,
    workerCost: isYearly ? Math.round(workerCostMonthly * YEARLY_MULTIPLIER * 100) / 100 : workerCostMonthly,
    shopCost: isYearly ? Math.round(shopCostMonthly * YEARLY_MULTIPLIER * 100) / 100 : shopCostMonthly,
    addonCost: Math.round(addonCost * 100) / 100, addonMonthly,
    monthlyTotal, billableShops, billableWorkers,
    tier, cycle, tierInfo: getTierInfo(tier), workerCount, shopCount, savings, freeLimit, inventoryAddon: wantsAddon,
  };
}

// Backwards-compatible alias
export function calculateMonthlyCost(workerCount, shopCount) {
  return calculateCost(workerCount, shopCount, 'monthly');
}

/**
 * Get the PayPal subscription "quantity" for the €0.01/unit metered plan.
 * Every paid tier (Basic and Pro) bills on the same metered plan, so the
 * quantity is simply the recurring cost for the chosen cycle expressed in cents.
 * Returns null when there is nothing to charge (truly free).
 *
 * @param {string} cycle - 'monthly' (default) or 'yearly'
 */
export function getSubscriptionQuantity(workerCount, shopCount, freeLimit = FREE_WORKER_LIMIT, opts = {}, cycle = 'monthly') {
  const cost = calculateCost(workerCount, shopCount, cycle, freeLimit, opts);
  const total = cycle === 'yearly' ? cost.total : cost.monthlyTotal;
  if (!total || total <= 0) return null;
  return Math.round(total * 100); // cents, billed on the €0.01/unit plan
}

/**
 * Whether an organization is on the Pro plan — either chosen as an upgrade
 * (org.proPlan) or reached automatically by employee count with an active sub.
 */
export function hasProPlan(org) {
  if (!org) return false;
  if (org.proPlan === true) return true;
  if (org.subscriptionTier === 'enterprise' && org.subscriptionStatus === 'active') return true;
  return false;
}

/**
 * Whether an organization can access the Inventory module (Stock + Recipes).
 * True if they bought the add-on, are on Pro, or were grandfathered
 * (created before the add-on launched).
 */
export function hasInventoryAccess(org) {
  if (!org) return false;
  if (org.inventoryAddon) return true;
  if (hasProPlan(org)) return true;
  const raw = org.createdAt;
  const created = raw?.toDate ? raw.toDate() : raw ? new Date(raw) : null;
  if (created && !Number.isNaN(created.getTime()) && created < new Date(INVENTORY_LAUNCH)) return true;
  return false;
}

/**
 * Get the current billing period string.
 * Monthly: "2026-02"  Yearly: "2026"
 */
export function getCurrentPeriod(cycle = 'monthly') {
  const now = new Date();
  return cycle === 'yearly' ? String(now.getFullYear()) : now.toISOString().slice(0, 7);
}

/**
 * Check if a payment covers the current date.
 * Reads `paidThrough` (ISO date string) from the organization doc.
 * Monthly paidThrough = "2026-02-28" (end of paid month)
 * Yearly paidThrough = "2027-01-15" (one year from payment date)
 */
export function isPaidThrough(paidThroughDate) {
  if (!paidThroughDate) return false;
  const now = new Date();
  const paid = new Date(paidThroughDate);
  return paid >= now;
}

/**
 * Calculate the paidThrough date for a new payment.
 */
export function calcPaidThrough(cycle = 'monthly') {
  const now = new Date();
  if (cycle === 'yearly') {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  }
  // Monthly: end of current month
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of month
  return d.toISOString().split('T')[0];
}

export function canAddWorker(currentActiveWorkers, currentShopCount, orgPlan, freeLimit = FREE_WORKER_LIMIT) {
  const afterCount = currentActiveWorkers + 1;
  const currentTier = getTier(currentActiveWorkers, freeLimit);
  const newTier = getTier(afterCount, freeLimit);
  const newCost = calculateCost(afterCount, currentShopCount, 'monthly', freeLimit);

  if (currentTier === TIERS.FREE && newTier === TIERS.STANDARD) {
    return {
      allowed: true, requiresUpgrade: true,
      message: `Adding a ${freeLimit + 1}th employee moves you to the Basic plan at ${formatCurrency(newCost.total)}/month.`,
      newTier: TIERS.STANDARD, newCost,
    };
  }
  if (currentTier === TIERS.STANDARD && newTier === TIERS.ENTERPRISE) {
    return {
      allowed: true, requiresUpgrade: true,
      message: `Adding a ${ENTERPRISE_THRESHOLD}th employee moves you to the Pro plan at ${formatCurrency(PRO_PRICE_MONTHLY)}/month (includes Stock, Checklists & Knowledge Base).`,
      newTier: TIERS.ENTERPRISE, newCost,
    };
  }
  return { allowed: true, requiresUpgrade: false, message: null, newTier: currentTier, newCost };
}

export function canAddShop(currentShopCount, currentActiveWorkers, freeLimit = FREE_WORKER_LIMIT) {
  const tier = getTier(currentActiveWorkers, freeLimit);
  if (tier === TIERS.FREE && currentShopCount >= FREE_SHOP_LIMIT) {
    return { allowed: false, message: `Free plan includes ${FREE_SHOP_LIMIT} shop. Add more employees to unlock the Basic plan.` };
  }
  if (tier === TIERS.STANDARD) {
    return { allowed: true, message: currentShopCount === 0 ? 'Your first shop is free!' : `Additional shops cost ${formatCurrency(PRICE_PER_SHOP)}/month each.` };
  }
  return { allowed: true, message: null };
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

/**
 * Calculate the prorated cost difference when a plan changes mid-cycle.
 * Used when adding/removing workers or shops during an active billing period.
 *
 * @param {Object} oldCost - Previous calculateCost() result
 * @param {Object} newCost - New calculateCost() result
 * @returns {{ proratedDifference: number, daysRemaining: number, totalDaysInMonth: number, dailyRate: number }}
 */
export function calculateProration(oldCost, newCost) {
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const totalDaysInMonth = endOfMonth.getDate();
  const dayOfMonth = now.getDate();
  const daysRemaining = totalDaysInMonth - dayOfMonth;

  const monthlyDifference = (newCost.monthlyTotal || newCost.total) - (oldCost.monthlyTotal || oldCost.total);

  if (monthlyDifference <= 0) {
    // Downgrade: no charge now, takes effect next billing cycle
    return { proratedDifference: 0, daysRemaining, totalDaysInMonth, dailyRate: 0, monthlyDifference, isUpgrade: false };
  }

  // Upgrade: charge prorated difference for remainder of current month
  const dailyRate = monthlyDifference / totalDaysInMonth;
  const proratedDifference = Math.round(dailyRate * daysRemaining * 100) / 100;

  return { proratedDifference, daysRemaining, totalDaysInMonth, dailyRate: Math.round(dailyRate * 100) / 100, monthlyDifference, isUpgrade: true };
}

export {
  PRICE_PER_WORKER, PRICE_PER_SHOP, FREE_WORKER_LIMIT, FREE_SHOP_LIMIT,
  BASIC_MAX_WORKERS, ENTERPRISE_THRESHOLD, ENTERPRISE_PRICE_MONTHLY, ENTERPRISE_DISCOUNTED_PRICE,
  PRO_PRICE_MONTHLY, PRO_INCLUDED_WORKERS, PRO_EXTRA_WORKER, YEARLY_MULTIPLIER,
  PROMO_WORKER_LIMIT, STOCK_ADDON_MONTHLY, STAFF_SETUP_FEE,
  INVENTORY_SETUP_FROM, KB_SETUP_FROM, INVENTORY_SETUP_FEE, INVENTORY_LAUNCH,
};
