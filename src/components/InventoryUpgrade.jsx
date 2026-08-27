'use client';
import Link from 'next/link';
import { Package, Check, ArrowRight, Wrench, ScanLine, Bell, CookingPot } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { STOCK_ADDON_MONTHLY, INVENTORY_SETUP_FEE, formatCurrency } from '@/lib/pricing';

/**
 * Upgrade screen shown on Stock / Recipes for orgs without the Inventory add-on.
 * Grandfathered/Enterprise/subscribed orgs never see this (see hasInventoryAccess).
 */
export default function InventoryUpgrade({ feature = 'Inventory' }) {
  const { isManager } = useAuth();

  const features = [
    { icon: ScanLine, text: 'Barcode scanning to add & count stock in seconds' },
    { icon: Bell, text: 'Low-stock & out-of-stock alerts with one-tap refills' },
    { icon: CookingPot, text: 'Recipe costing with automatic stock deduction' },
    { icon: Package, text: 'Multi-shop inventory, par levels & activity log' },
  ];

  return (
    <div className="max-w-2xl mx-auto py-6">
      <div className="card overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-orange-400 via-rose-500 to-brand-500" />
        <div className="p-6 sm:p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-rose-500/20">
            <Package className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-surface-900">Unlock the Inventory module</h1>
          <p className="text-sm text-surface-500 mt-1.5 max-w-md mx-auto">
            {feature} is part of StaffHub’s Inventory add-on — everything you need to control stock and know your margins.
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
            {features.map((f) => (
              <div key={f.text} className="flex items-start gap-2.5 rounded-xl border border-surface-200/70 bg-surface-50/60 p-3">
                <f.icon className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
                <span className="text-xs text-surface-700">{f.text}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 inline-flex items-baseline gap-1.5">
            <span className="text-3xl font-display font-bold text-surface-900">{formatCurrency(STOCK_ADDON_MONTHLY)}</span>
            <span className="text-sm text-surface-500">/month</span>
          </div>
          <p className="text-xs text-surface-400 mt-0.5">or {formatCurrency(STOCK_ADDON_MONTHLY * 10)}/year — 2 months free · free on Enterprise</p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            {isManager ? (
              <Link href="/costs" className="btn-primary w-full sm:w-auto">
                Enable in Billing <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <span className="text-sm text-surface-500">Ask your manager to enable Inventory in Billing.</span>
            )}
          </div>

          {/* Done-for-you setup service */}
          <div className="mt-6 pt-5 border-t border-surface-100 flex items-center gap-3 text-left">
            <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
              <Wrench className="w-4 h-4 text-brand-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-surface-800">Prefer done-for-you? Inventory Setup Service</p>
              <p className="text-xs text-surface-500">We import your products, set par levels, build your recipes and train your team — {formatCurrency(INVENTORY_SETUP_FEE)} one-time.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
