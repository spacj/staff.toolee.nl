'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { getAllOrganizations, getStockItems } from '@/lib/firestore';
import { cn } from '@/utils/helpers';
import { Building2, Package, AlertTriangle, TrendingDown, PackageOpen, Search, ArrowRight } from 'lucide-react';

export default function InventoryDashboard() {
  const { user, isInventory } = useAuth();
  const router = useRouter();
  const [orgs, setOrgs] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user && !isInventory) router.replace('/dashboard');
  }, [user, isInventory, router]);

  useEffect(() => {
    if (!user || !isInventory) return;
    (async () => {
      try {
        const orgList = await getAllOrganizations();
        setOrgs(orgList);
        const results = await Promise.all(
          orgList.map(async (o) => {
            try {
              const items = await getStockItems({ orgId: o.id });
              return [o.id, summarize(items)];
            } catch {
              return [o.id, summarize([])];
            }
          })
        );
        setStats(Object.fromEntries(results));
      } finally {
        setLoading(false);
      }
    })();
  }, [user, isInventory]);

  const filteredOrgs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(o => (o.name || '').toLowerCase().includes(q));
  }, [orgs, search]);

  const totals = useMemo(() => {
    return Object.values(stats).reduce((acc, s) => ({
      items: acc.items + s.items,
      inUse: acc.inUse + s.inUse,
      low: acc.low + s.low,
      out: acc.out + s.out,
    }), { items: 0, inUse: 0, low: 0, out: 0 });
  }, [stats]);

  if (!isInventory) return null;

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-surface-900">Inventory</h1>
          <p className="text-sm text-surface-500 mt-1">Manage stock across every organization on the platform.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard icon={Building2} label="Organizations" value={orgs.length} color="text-surface-900" />
          <StatCard icon={Package} label="Items" value={totals.items} color="text-surface-900" />
          <StatCard icon={PackageOpen} label="In use" value={totals.inUse} color="text-sky-600" />
          <StatCard icon={TrendingDown} label="Low stock" value={totals.low} color="text-amber-600" />
          <StatCard icon={AlertTriangle} label="Out of stock" value={totals.out} color="text-red-600" />
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            className="input-field pl-9 w-full"
            placeholder="Search organizations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="card p-8 text-center text-surface-500">Loading organizations…</div>
        ) : filteredOrgs.length === 0 ? (
          <div className="card p-8 text-center text-surface-500">No organizations found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrgs.map(o => {
              const s = stats[o.id] || { items: 0, inUse: 0, low: 0, out: 0 };
              const hasAlerts = s.out > 0 || s.low > 0;
              return (
                <Link
                  key={o.id}
                  href={`/stock?orgId=${encodeURIComponent(o.id)}`}
                  className={cn(
                    'card p-4 flex flex-col gap-3 hover:shadow-md transition-all active:scale-[0.99]',
                    s.out > 0 && 'border-red-200 bg-red-50/20',
                    s.out === 0 && s.low > 0 && 'border-amber-200 bg-amber-50/20'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-surface-900 truncate">{o.name || 'Untitled org'}</p>
                      <p className="text-xs text-surface-400 mt-0.5">{s.items} item{s.items !== 1 ? 's' : ''} tracked</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-surface-400 flex-shrink-0 mt-1" />
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <Mini label="Items" value={s.items} color="text-surface-700" />
                    <Mini label="In use" value={s.inUse} color="text-sky-600" />
                    <Mini label="Low" value={s.low} color="text-amber-600" />
                    <Mini label="Out" value={s.out} color="text-red-600" />
                  </div>

                  {hasAlerts && (
                    <div className={cn(
                      'text-[11px] font-semibold px-2 py-1 rounded-lg flex items-center gap-1.5',
                      s.out > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    )}>
                      <AlertTriangle className="w-3 h-3" />
                      {s.out > 0 ? `${s.out} out of stock` : `${s.low} below minimum`}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

function summarize(items) {
  let inUse = 0, low = 0, out = 0;
  for (const i of items) {
    inUse += i.inUseQuantity || 0;
    if (i.minimumQuantity > 0) {
      if (i.quantity === 0) out++;
      else if (i.quantity < i.minimumQuantity) low++;
    }
  }
  return { items: items.length, inUse, low, out };
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card p-3 sm:p-4">
      <div className="flex items-center gap-2 text-xs text-surface-500 font-medium">
        <Icon className="w-3.5 h-3.5" />{label}
      </div>
      <p className={cn('text-xl sm:text-2xl font-bold mt-1', color)}>{value}</p>
    </div>
  );
}

function Mini({ label, value, color }) {
  return (
    <div>
      <p className={cn('text-lg font-bold', color)}>{value}</p>
      <p className="text-[10px] text-surface-400 uppercase tracking-wide">{label}</p>
    </div>
  );
}
