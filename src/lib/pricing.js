/**
 * StaffHub Pricing & Tier Enforcement
 *
 * Free:       0–4 workers, 1 shop  → €0
 * Standard:   5–20 workers         → €2/worker + €15/shop per month (or ×10/year = 2 months free)
 * Enterprise: 21+ workers          → €99/month flat or €990/year (2 months free)
 *
 * PayPal subscription strategy:
 *   Standard plans use "€1/unit" pricing with quantity = total monthly cost.
 *   When workers or shops change, we PATCH the subscription quantity.
 *   Enterprise plans use fixed pricing.
 */
const PRICE_PER_WORKER = 0.02;
const PRICE_PER_SHOP = 0.15;
const FREE_WORKER_LIMIT = 5;
const FREE_SHOP_LIMIT = 1;
const ENTERPRISE_THRESHOLD = 21;
const ENTERPRISE_PRICE_MONTHLY = 99;
const ENTERPRISE_PRICE_YEARLY = 990;
const YEARLY_MULTIPLIER = 10; // monthly cost × 10 = yearly (2 months free)

export const TIERS = { FREE: 'free', STANDARD: 'standard', ENTERPRISE: 'enterprise' };
export const CYCLES = { MONTHLY: 'monthly', YEARLY: 'yearly' };

export function getTier(workerCount) {
  if (workerCount < FREE_WORKER_LIMIT) return TIERS.FREE;
  if (workerCount < ENTERPRISE_THRESHOLD) return TIERS.STANDARD;
  return TIERS.ENTERPRISE;
}

export function getTierInfo(tier) {
  const tiers = {
    free: { name: 'Free', badge: 'bg-emerald-100 text-emerald-700', price: '€0', period: '',
      tagline: `Up to ${FREE_WORKER_LIMIT - 1} workers & ${FREE_SHOP_LIMIT} shop`,
      features: [`Up to ${FREE_WORKER_LIMIT - 1} workers`, `${FREE_SHOP_LIMIT} shop included`, 'Shift scheduling', 'Clock in/out', 'Calendar'] },
    standard: { name: 'Standard', badge: 'bg-brand-100 text-brand-700', price: '€2', period: '/worker/mo',
      tagline: `${FREE_WORKER_LIMIT}–${ENTERPRISE_THRESHOLD - 1} workers`,
      features: ['Everything in Free', `€${PRICE_PER_WORKER}/worker/month`, `€${PRICE_PER_SHOP}/shop/month`, 'Save ~17% with yearly billing', 'Attendance tracking', 'Cost analytics'] },
    enterprise: { name: 'Enterprise', badge: 'bg-purple-100 text-purple-700', price: '€99', period: '/month',
      tagline: `${ENTERPRISE_THRESHOLD}+ workers`,
      features: ['Everything in Standard', 'Unlimited workers & shops', `€${ENTERPRISE_PRICE_MONTHLY}/mo or €${ENTERPRISE_PRICE_YEARLY}/yr`, 'Priority support'] },
  };
  return tiers[tier] || tiers.free;
}

/**
 * Calculate cost for a given cycle
 */
export function calculateCost(workerCount, shopCount, cycle = 'monthly') {
  const tier = getTier(workerCount);
  const isYearly = cycle === 'yearly';

  if (tier === TIERS.FREE) {
    return { total: 0, monthlyEquivalent: 0, workerCost: 0, shopCost: 0, tier, cycle, tierInfo: getTierInfo(tier), workerCount, shopCount, savings: 0 };
  }

  if (tier === TIERS.ENTERPRISE) {
    const monthly = ENTERPRISE_PRICE_MONTHLY;
    const yearly = ENTERPRISE_PRICE_YEARLY;
    const total = isYearly ? yearly : monthly;
    const monthlyEquiv = isYearly ? yearly / 12 : monthly;
    const savings = isYearly ? (monthly * 12) - yearly : 0;
    return { total, monthlyEquivalent: Math.round(monthlyEquiv * 100) / 100, workerCost: 0, shopCost: 0, tier, cycle, tierInfo: getTierInfo(tier), workerCount, shopCount, savings };
  }

  // Standard
  const workerCostMonthly = workerCount * PRICE_PER_WORKER;
  const shopCostMonthly = shopCount * PRICE_PER_SHOP;
  const monthlyTotal = workerCostMonthly + shopCostMonthly;
  const total = isYearly ? monthlyTotal * YEARLY_MULTIPLIER : monthlyTotal;
  const monthlyEquiv = isYearly ? total / 12 : monthlyTotal;
  const savings = isYearly ? (monthlyTotal * 12) - total : 0;

  return {
    total: Math.round(total * 100) / 100,
    monthlyEquivalent: Math.round(monthlyEquiv * 100) / 100,
    workerCost: isYearly ? Math.round(workerCostMonthly * YEARLY_MULTIPLIER * 100) / 100 : workerCostMonthly,
    shopCost: isYearly ? Math.round(shopCostMonthly * YEARLY_MULTIPLIER * 100) / 100 : shopCostMonthly,
    monthlyWorkerCost: workerCostMonthly,
    monthlyShopCost: shopCostMonthly,
    monthlyTotal,
    tier, cycle,
    tierInfo: getTierInfo(tier), workerCount, shopCount, savings,
  };
}

// Backwards-compatible alias
export function calculateMonthlyCost(workerCount, shopCount) {
  return calculateCost(workerCount, shopCount, 'monthly');
}

/**
 * Get the PayPal subscription quantity.
 * For Standard: quantity = monthly cost in whole euros (€1/unit pricing).
 * For Enterprise: null (fixed price plan).
 */
export function getSubscriptionQuantity(workerCount, shopCount) {
  const tier = getTier(workerCount);
  if (tier !== TIERS.STANDARD) return null;
  return Math.round(workerCount * PRICE_PER_WORKER + shopCount * PRICE_PER_SHOP);
}

export function canAddWorker(currentActiveWorkers, currentShopCount, orgPlan) {
  const afterCount = currentActiveWorkers + 1;
  const currentTier = getTier(currentActiveWorkers);
  const newTier = getTier(afterCount);
  const newCost = calculateCost(afterCount, currentShopCount, 'monthly');

  if (currentTier === TIERS.FREE && newTier === TIERS.STANDARD) {
    return {
      allowed: true, requiresUpgrade: true,
      message: `Adding a ${FREE_WORKER_LIMIT}th worker upgrades you to Standard. You'll need an active subscription at ${formatCurrency(newCost.total)}/month (or save ~17% yearly).`,
      newTier: TIERS.STANDARD, newCost,
    };
  }
  if (currentTier === TIERS.STANDARD && newTier === TIERS.ENTERPRISE) {
    return {
      allowed: true, requiresUpgrade: true,
      message: `Adding a ${ENTERPRISE_THRESHOLD}st worker upgrades you to Enterprise at ${formatCurrency(ENTERPRISE_PRICE_MONTHLY)}/month flat.`,
      newTier: TIERS.ENTERPRISE, newCost,
    };
  }
  return { allowed: true, requiresUpgrade: false, message: null, newTier: currentTier, newCost };
}

export function canAddShop(currentShopCount, currentActiveWorkers) {
  const tier = getTier(currentActiveWorkers);
  if (tier === TIERS.FREE && currentShopCount >= FREE_SHOP_LIMIT) {
    return {
      allowed: false,
      message: `Free plan includes ${FREE_SHOP_LIMIT} shop. Add ${FREE_WORKER_LIMIT - currentActiveWorkers} more workers to unlock Standard.`,
    };
  }
  if (tier === TIERS.STANDARD) {
    return { allowed: true, message: `Each shop costs ${formatCurrency(PRICE_PER_SHOP)}/month (auto-adjusted on your subscription).` };
  }
  return { allowed: true, message: null };
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

export {
  PRICE_PER_WORKER, PRICE_PER_SHOP, FREE_WORKER_LIMIT, FREE_SHOP_LIMIT,
  ENTERPRISE_THRESHOLD, ENTERPRISE_PRICE_MONTHLY, ENTERPRISE_PRICE_YEARLY, YEARLY_MULTIPLIER,
};
