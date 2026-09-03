/**
 * Comp / super-admin accounts.
 *
 * These emails always get full access to every feature (Stock, Recipes, Pro,
 * unlimited employees) and are never charged or gated by billing — independent
 * of their organization's subscription state. Used to keep owner/operator
 * accounts unlocked while the paid plans evolve.
 */
export const SUPERADMIN_EMAILS = [
  'malek@gmail.com',
  'malekalqaisi@gmail.com',
];

export function isSuperAdminEmail(email) {
  if (!email) return false;
  return SUPERADMIN_EMAILS.includes(String(email).trim().toLowerCase());
}

/** Comp flags merged onto a super-admin's organization so every gate passes. */
export const SUPERADMIN_ORG_OVERRIDES = {
  proPlan: true,
  inventoryAddon: true,
  subscriptionStatus: 'active',
  subscriptionTier: 'enterprise',
  freeWorkerLimit: 100000,
  comp: true,
};
