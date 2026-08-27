'use client';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/utils/helpers';
import {
  LayoutDashboard, Smartphone, CookingPot, Package, Users, Store, Calendar,
  TrendingUp, Clock, Play, Square, Check, X, CheckCircle, AlertTriangle,
  BarChart3, DollarSign, ChevronDown, RotateCw,
} from 'lucide-react';

/**
 * Interactive product demo for the marketing homepage.
 *
 * Self-contained mock screens (no auth, no data) styled to match the real app,
 * shown inside device frames — owner on a desktop window, worker on a phone.
 * The screens are genuinely interactive: the clock-in timer ticks, approvals
 * resolve, stock refills, and "making" a recipe deducts from live stock that
 * the Stock tab shares. Tabs auto-rotate until the visitor takes control.
 */

const TABS = [
  { id: 'owner', label: 'Owner dashboard', short: 'Owner', icon: LayoutDashboard, frame: 'desktop', url: 'staffhub.app/dashboard' },
  { id: 'worker', label: 'Worker app', short: 'Worker', icon: Smartphone, frame: 'phone', url: 'My Time' },
  { id: 'recipes', label: 'Recipes', short: 'Recipes', icon: CookingPot, frame: 'desktop', url: 'staffhub.app/recipes' },
  { id: 'stock', label: 'Stock', short: 'Stock', icon: Package, frame: 'desktop', url: 'staffhub.app/stock' },
];

const INITIAL_STOCK = [
  { id: 'beans', name: 'Arabica Coffee Beans', unit: 'kg', qty: 4.2, min: 6 },
  { id: 'oat', name: 'Oat Milk', unit: 'L', qty: 0, min: 8 },
  { id: 'sugar', name: 'Cane Sugar', unit: 'kg', qty: 12, min: 4 },
  { id: 'cups', name: 'Paper Cups (12oz)', unit: 'pcs', qty: 320, min: 200 },
];

const RECIPES = [
  { id: 'latte', name: 'Signature Latte', cat: 'Drinks', cost: '€0.82', tint: 'bg-amber-100 text-amber-700',
    ingredients: [{ id: 'beans', amount: 0.02 }, { id: 'oat', amount: 0.25 }, { id: 'cups', amount: 1 }] },
  { id: 'lemonade', name: 'House Lemonade', cat: 'Drinks', cost: '€0.54', tint: 'bg-blue-100 text-blue-700',
    ingredients: [{ id: 'sugar', amount: 0.03 }, { id: 'cups', amount: 1 }] },
  { id: 'coldbrew', name: 'Cold Brew Batch', cat: 'Prep', cost: '€3.20', tint: 'bg-purple-100 text-purple-700',
    ingredients: [{ id: 'beans', amount: 0.35 }, { id: 'cups', amount: 4 }] },
  { id: 'flatwhite', name: 'Flat White', cat: 'Drinks', cost: '€0.78', tint: 'bg-emerald-100 text-emerald-700',
    ingredients: [{ id: 'beans', amount: 0.02 }, { id: 'oat', amount: 0.18 }, { id: 'cups', amount: 1 }] },
];

const stockStatus = (it) => (it.qty <= 0 ? 'out' : it.qty < it.min ? 'low' : 'ok');
const stockPct = (it) => Math.max(0, Math.min(100, Math.round((it.qty / (it.min * 2)) * 100)));

export default function LandingDemo() {
  const [active, setActive] = useState('owner');
  const [interacted, setInteracted] = useState(false);
  const [stock, setStock] = useState(INITIAL_STOCK);
  const timer = useRef(null);

  const onInteract = () => setInteracted(true);

  // Auto-advance through the tabs until the visitor takes control.
  useEffect(() => {
    if (interacted) return;
    timer.current = setInterval(() => {
      setActive((cur) => {
        const i = TABS.findIndex((t) => t.id === cur);
        return TABS[(i + 1) % TABS.length].id;
      });
    }, 4500);
    return () => clearInterval(timer.current);
  }, [interacted]);

  const pick = (id) => { onInteract(); setActive(id); };
  const current = TABS.find((t) => t.id === active);
  const attention = stock.filter((s) => stockStatus(s) !== 'ok').length;

  return (
    <section id="demo" className="py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand-200/25 rounded-full blur-3xl" />
      </div>
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 bg-white border border-brand-200 text-brand-700 text-xs sm:text-sm font-medium px-4 py-2 rounded-full mb-4 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Live, interactive demo
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold text-slate-900 mb-3 sm:mb-4">See StaffHub in action</h2>
          <p className="text-sm sm:text-lg text-slate-600 max-w-2xl mx-auto">Actually try it — clock in, approve leave, refill stock, make a recipe. The same app your managers run on a laptop and your team carries in their pocket.</p>
        </div>

        {/* Tab switcher */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <div className="inline-flex flex-wrap justify-center gap-1 sm:gap-1.5 bg-white/80 backdrop-blur border border-slate-200 rounded-2xl p-1.5 shadow-sm">
            {TABS.map((t) => {
              const on = t.id === active;
              return (
                <button
                  key={t.id}
                  onClick={() => pick(t.id)}
                  className={cn(
                    'inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all relative',
                    on ? 'bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/25' : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  <t.icon className="w-4 h-4" />
                  <span className="sm:hidden">{t.short}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                  {t.id === 'stock' && attention > 0 && (
                    <span className={cn('ml-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center', on ? 'bg-white/25 text-white' : 'bg-red-500 text-white')}>{attention}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Device stage */}
        <div className="flex justify-center">
          {current.frame === 'phone' ? (
            <PhoneFrame><WorkerScreen onInteract={onInteract} /></PhoneFrame>
          ) : (
            <BrowserFrame url={current.url}>
              {active === 'owner' && <OwnerScreen onInteract={onInteract} />}
              {active === 'recipes' && <RecipesScreen stock={stock} setStock={setStock} onInteract={onInteract} />}
              {active === 'stock' && <StockScreen stock={stock} setStock={setStock} onInteract={onInteract} />}
            </BrowserFrame>
          )}
        </div>
        <p className="text-center text-xs text-slate-400 mt-4">This is a real, interactive preview — nothing here is saved. <a href="/register" className="text-brand-600 font-medium hover:underline">Create your free account →</a></p>
      </div>
    </section>
  );
}

/* ─── Device frames ─────────────────────────────────────────── */

function BrowserFrame({ url, children }) {
  return (
    <div className="w-full max-w-4xl rounded-2xl bg-slate-900 shadow-2xl shadow-slate-900/25 border border-slate-800 overflow-hidden animate-in">
      <div className="flex items-center gap-2 px-4 h-10 bg-slate-800/80 border-b border-slate-700/60">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-400" />
          <span className="w-3 h-3 rounded-full bg-amber-400" />
          <span className="w-3 h-3 rounded-full bg-emerald-400" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-1.5 bg-slate-700/50 rounded-md px-3 py-1 text-[11px] text-slate-300 max-w-[70%] truncate">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70 flex-shrink-0" /> {url}
          </div>
        </div>
      </div>
      <div className="bg-surface-50 h-[470px] overflow-y-auto scrollbar-none">{children}</div>
    </div>
  );
}

function PhoneFrame({ children }) {
  return (
    <div className="relative w-[290px] sm:w-[320px] rounded-[2.5rem] bg-slate-900 p-2.5 shadow-2xl shadow-slate-900/30 border border-slate-800 animate-in">
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-28 h-5 bg-slate-900 rounded-b-2xl z-20" />
      <div className="rounded-[2rem] overflow-hidden bg-surface-50 h-[560px] overflow-y-auto scrollbar-none">
        {children}
      </div>
    </div>
  );
}

/* ─── Screen: Owner dashboard ───────────────────────────────── */

function OwnerScreen({ onInteract }) {
  const [approvals, setApprovals] = useState([
    { id: 1, name: 'Marco Bianchi', type: 'Holiday', when: 'Aug 28 → Sep 1', tone: 'bg-blue-100 text-blue-700', status: 'pending' },
    { id: 2, name: 'Lena Fischer', type: 'Sick leave', when: 'Aug 27', tone: 'bg-red-100 text-red-700', status: 'pending' },
    { id: 3, name: 'Tomás Reyes', type: 'Personal', when: 'Aug 30', tone: 'bg-surface-100 text-surface-600', status: 'pending' },
  ]);
  const resolve = (id, status) => { onInteract(); setApprovals((a) => a.map((x) => (x.id === id ? { ...x, status } : x))); };
  const pending = approvals.filter((a) => a.status === 'pending').length;

  const stats = [
    { label: 'Active Staff', value: '24', sub: '18 clocked in', icon: Users, tint: 'from-brand-500 to-brand-700' },
    { label: 'Shops', value: '3', sub: 'locations', icon: Store, tint: 'from-purple-500 to-purple-700' },
    { label: "Today's Shifts", value: '12', sub: 'scheduled', icon: Calendar, tint: 'from-emerald-500 to-emerald-700' },
    { label: 'Monthly Cost', value: '€1,240', sub: 'Professional plan', icon: TrendingUp, tint: 'from-amber-500 to-amber-700' },
  ];
  return (
    <div className="p-4 sm:p-5 text-left">
      <div className="rounded-xl bg-gradient-to-br from-surface-900 via-surface-800 to-brand-900 text-white p-4 mb-4">
        <p className="text-white/50 text-xs font-medium">Good morning</p>
        <p className="text-lg font-display font-bold leading-tight">Sofia — here's what's happening today</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {stats.map((s) => (
          <div key={s.label} className={cn('rounded-xl p-3 text-white bg-gradient-to-br', s.tint)}>
            <s.icon className="w-4 h-4 text-white/80 mb-2" />
            <p className="text-xl font-display font-bold leading-none">{s.value}</p>
            <p className="text-[10px] text-white/70 mt-1">{s.label}</p>
            <p className="text-[9px] text-white/50">{s.sub}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-surface-200/70 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-display font-semibold text-surface-800">Pending approvals</p>
          <span className={cn('badge !text-[10px]', pending > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>
            {pending > 0 ? `${pending} waiting` : 'All clear'}
          </span>
        </div>
        <div className="space-y-2.5">
          {approvals.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                  {a.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-surface-800 truncate">{a.name}</p>
                  <p className="text-[10px] text-surface-400">
                    <span className={cn('badge !text-[9px] !px-1.5 !py-0 mr-1', a.tone)}>{a.type}</span>{a.when}
                  </p>
                </div>
              </div>
              {a.status === 'pending' ? (
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => resolve(a.id, 'approved')} className="w-7 h-7 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors active:scale-90"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => resolve(a.id, 'declined')} className="w-7 h-7 rounded-lg bg-surface-100 hover:bg-red-100 text-surface-500 hover:text-red-600 flex items-center justify-center transition-colors active:scale-90"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <span className={cn('badge !text-[10px] flex-shrink-0 animate-in', a.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
                  {a.status === 'approved' ? 'Approved' : 'Declined'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Screen: Worker (My Time) — phone ──────────────────────── */

function WorkerScreen({ onInteract }) {
  // Start "clocked in" ~3h24m ago so the timer visibly ticks.
  const [clockInAt, setClockInAt] = useState(() => Date.now() - (3 * 3600 + 24 * 60) * 1000);
  const [clockedIn, setClockedIn] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [records, setRecords] = useState([
    { d: 'Mon 25', h: '8.0h', status: 'Approved', ok: true },
    { d: 'Tue 26', h: '7.5h', status: 'Approved', ok: true },
  ]);

  useEffect(() => {
    if (!clockedIn) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [clockedIn]);

  const elapsedMs = clockedIn ? now - clockInAt : 0;
  const h = Math.floor(elapsedMs / 3600000);
  const m = Math.floor((elapsedMs % 3600000) / 60000);
  const s = Math.floor((elapsedMs % 60000) / 1000);
  const elapsedH = (elapsedMs / 3600000);

  const toggle = () => {
    onInteract();
    if (clockedIn) {
      setRecords((r) => [{ d: 'Wed 27', h: `${elapsedH.toFixed(1)}h`, status: 'Pending', ok: false }, ...r]);
      setClockedIn(false);
    } else {
      setClockInAt(Date.now());
      setNow(Date.now());
      setClockedIn(true);
    }
  };

  const monthH = 32.5 + (clockedIn ? elapsedH : 0);

  return (
    <div className="p-4 text-left">
      <p className="text-lg font-display font-bold text-surface-900">My Time</p>
      <p className="text-xs text-surface-500 mb-4">Clock in/out and track your hours.</p>

      <div className={cn('rounded-2xl border bg-white overflow-hidden mb-4', clockedIn ? 'border-emerald-200' : 'border-surface-200')}>
        {clockedIn && <div className="h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />}
        <div className="p-5 text-center">
          <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg', clockedIn ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/25' : 'bg-gradient-to-br from-surface-200 to-surface-300')}>
            <Clock className={cn('w-8 h-8', clockedIn ? 'text-white' : 'text-surface-500')} />
          </div>
          {clockedIn ? (
            <>
              <p className="text-base font-display font-bold text-emerald-800">You're clocked in</p>
              <p className="text-xs text-emerald-600 mt-1 tabular-nums">{h}h {String(m).padStart(2, '0')}m {String(s).padStart(2, '0')}s</p>
              <button onClick={toggle} className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-gradient-to-b from-danger-500 to-danger-600 hover:from-danger-600 hover:to-red-700 text-white text-sm font-medium py-3 rounded-xl shadow-sm active:scale-[0.98] transition-all">
                <Square className="w-4 h-4" /> Clock Out
              </button>
            </>
          ) : (
            <>
              <p className="text-base font-display font-bold text-surface-800">Ready to start?</p>
              <p className="text-xs text-surface-500 mt-1">Wed 27 Aug</p>
              <button onClick={toggle} className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-gradient-to-b from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white text-sm font-medium py-3 rounded-xl shadow-sm shadow-brand-500/20 active:scale-[0.98] transition-all">
                <Play className="w-4 h-4" /> Clock In
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <div className="rounded-xl border border-surface-200/70 bg-white p-3">
          <BarChart3 className="w-4 h-4 text-brand-400" />
          <p className="text-lg font-display font-bold text-surface-900 mt-1 tabular-nums">{monthH.toFixed(1)}h</p>
          <p className="text-[10px] text-surface-400">This month</p>
        </div>
        <div className="rounded-xl border border-surface-200/70 bg-white p-3">
          <DollarSign className="w-4 h-4 text-amber-400" />
          <p className="text-lg font-display font-bold text-surface-900 mt-1 tabular-nums">€{Math.round(monthH * 15)}</p>
          <p className="text-[10px] text-surface-400">Expected pay</p>
        </div>
      </div>

      <div className="rounded-xl border border-surface-200/70 bg-white p-3">
        <p className="text-xs font-display font-semibold text-surface-800 mb-2">This week</p>
        <div className="space-y-2">
          {clockedIn && (
            <div className="flex items-center justify-between text-xs animate-in">
              <span className="text-surface-600">Wed 27</span>
              <span className="flex items-center gap-1.5">
                <span className="text-surface-700 font-medium tabular-nums">{elapsedH.toFixed(1)}h</span>
                <span className="badge !text-[9px] bg-emerald-100 text-emerald-700">In progress</span>
              </span>
            </div>
          )}
          {records.map((r, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-surface-600">{r.d}</span>
              <span className="flex items-center gap-1.5">
                <span className="text-surface-700 font-medium">{r.h}</span>
                <span className={cn('badge !text-[9px]', r.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>{r.status}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Screen: Recipes (shares live stock) ───────────────────── */

function RecipesScreen({ stock, setStock, onInteract }) {
  const [expanded, setExpanded] = useState(null);
  const [made, setMade] = useState({});
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  const stockById = (id) => stock.find((s) => s.id === id);

  const make = (recipe) => {
    onInteract();
    const short = recipe.ingredients.find((ing) => { const it = stockById(ing.id); return !it || it.qty < ing.amount; });
    if (short) {
      const it = stockById(short.id);
      setFlash({ id: recipe.id, ok: false, msg: `Not enough ${it?.name || 'stock'}` });
      return;
    }
    setStock((prev) => prev.map((sit) => {
      const ing = recipe.ingredients.find((i) => i.id === sit.id);
      return ing ? { ...sit, qty: Math.round((sit.qty - ing.amount) * 100) / 100 } : sit;
    }));
    setMade((m) => ({ ...m, [recipe.id]: (m[recipe.id] || 0) + 1 }));
    setFlash({ id: recipe.id, ok: true, msg: 'Made · stock deducted' });
  };

  return (
    <div className="p-4 sm:p-5 text-left">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-base font-display font-bold text-surface-900">Recipes</p>
          <p className="text-xs text-surface-500">Cost every product and deduct stock in one tap.</p>
        </div>
        <span className="badge bg-brand-100 text-brand-700 !text-[10px]">{RECIPES.length} recipes</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {RECIPES.map((r) => {
          const open = expanded === r.id;
          return (
            <div key={r.id} className="rounded-xl border border-surface-200/70 bg-white overflow-hidden">
              <div className="p-3.5 flex items-center gap-3">
                <button onClick={() => { onInteract(); setExpanded(open ? null : r.id); }} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center flex-shrink-0">
                    <CookingPot className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-surface-800 truncate">{r.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={cn('badge !text-[9px] !px-1.5 !py-0', r.tint)}>{r.cat}</span>
                      <span className="text-[10px] text-surface-400">{r.cost}/serving</span>
                      {made[r.id] > 0 && <span className="text-[10px] text-emerald-600 font-medium">· {made[r.id]} made</span>}
                    </div>
                  </div>
                  <ChevronDown className={cn('w-4 h-4 text-surface-400 flex-shrink-0 transition-transform', open && 'rotate-180')} />
                </button>
              </div>
              {open && (
                <div className="px-3.5 pb-3.5 animate-in">
                  <div className="rounded-lg bg-surface-50 p-2.5 space-y-1.5">
                    {r.ingredients.map((ing) => {
                      const it = stockById(ing.id);
                      const enough = it && it.qty >= ing.amount;
                      return (
                        <div key={ing.id} className="flex items-center justify-between text-[11px]">
                          <span className="text-surface-600">{it?.name}</span>
                          <span className={cn('font-medium tabular-nums', enough ? 'text-surface-700' : 'text-red-600')}>
                            {ing.amount}{it?.unit} {enough ? '' : '· short'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between mt-2.5 gap-2">
                    {flash?.id === r.id ? (
                      <span className={cn('text-[11px] font-medium animate-in', flash.ok ? 'text-emerald-600' : 'text-red-600')}>{flash.msg}</span>
                    ) : <span />}
                    <button onClick={() => make(r)} className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg active:scale-95 transition-all flex-shrink-0">
                      <Check className="w-3.5 h-3.5" /> Make one
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-surface-400 mt-3 flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Making a recipe updates the Stock tab live — try it, then switch tabs.</p>
    </div>
  );
}

/* ─── Screen: Stock (shares live stock) ─────────────────────── */

function StockScreen({ stock, setStock, onInteract }) {
  const meta = {
    ok: { badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500', label: 'In stock' },
    low: { badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500', label: 'Low' },
    out: { badge: 'bg-red-100 text-red-700', bar: 'bg-red-500', label: 'Out' },
  };
  const refill = (id) => { onInteract(); setStock((prev) => prev.map((s) => (s.id === id ? { ...s, qty: s.min * 2 } : s))); };
  const attention = stock.filter((s) => stockStatus(s) !== 'ok').length;

  return (
    <div className="p-4 sm:p-5 text-left">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-base font-display font-bold text-surface-900">Stock</p>
          <p className="text-xs text-surface-500">Live levels with low-stock alerts and one-tap refills.</p>
        </div>
        <span className={cn('inline-flex items-center gap-1 badge !text-[10px]', attention > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>
          {attention > 0 ? <><AlertTriangle className="w-3 h-3" /> {attention} need attention</> : <><CheckCircle className="w-3 h-3" /> All stocked</>}
        </span>
      </div>
      <div className="rounded-xl border border-surface-200/70 bg-white divide-y divide-surface-100 overflow-hidden">
        {stock.map((it) => {
          const st = stockStatus(it);
          const m = meta[st];
          return (
            <div key={it.id} className="p-3.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-surface-800 truncate">{it.name}</p>
                  <span className={cn('badge !text-[9px] !px-1.5 !py-0', m.badge)}>{m.label}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-surface-100 overflow-hidden max-w-[220px]">
                  <div className={cn('h-full rounded-full transition-all duration-500', m.bar)} style={{ width: `${stockPct(it)}%` }} />
                </div>
              </div>
              <div className="text-right flex-shrink-0 w-14">
                <p className="text-sm font-display font-bold text-surface-900 tabular-nums">{it.qty}<span className="text-[10px] text-surface-400 font-normal ml-0.5">{it.unit}</span></p>
                <p className="text-[9px] text-surface-400">min {it.min}{it.unit}</p>
              </div>
              {st !== 'ok' ? (
                <button onClick={() => refill(it.id)} className="inline-flex items-center gap-1 bg-surface-900 hover:bg-brand-600 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg active:scale-95 transition-all flex-shrink-0">
                  <RotateCw className="w-3 h-3" /> Refill
                </button>
              ) : (
                <span className="w-[62px] flex justify-center flex-shrink-0"><CheckCircle className="w-4 h-4 text-emerald-400" /></span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
