'use client';
import { useState, useEffect } from 'react';
import { cn } from '@/utils/helpers';
import BarcodeScanner from '@/components/BarcodeScanner';
import BarcodeAddFlow from '@/components/BarcodeAddFlow';
import { findByBarcode, boxUnits } from '@/lib/stock-barcode';
import {
  LayoutDashboard, MessageCircle, Users, Store, ClipboardList, Calendar, Clock,
  CalendarCheck, ClipboardCheck, BookOpen, Package, CookingPot, CreditCard, Settings,
  Shield, Bell, Play, Square, Check, X, CheckCircle, AlertTriangle, BarChart3,
  DollarSign, TrendingUp, ChevronDown, RotateCw, Send, Wand2, Coffee, Plus, Smartphone,
  Loader2, MapPin, Minus, Sparkles, ScanLine,
} from 'lucide-react';

/**
 * Interactive product demo for the marketing homepage.
 *
 * Two independent phone apps shown side by side — one for the owner/manager and
 * one for the worker. Each is a self-contained mobile replica of the real app
 * (status bar, top bar, bottom nav) with its OWN state, so interacting with one
 * never affects the other. All content renders at mobile size regardless of the
 * viewer's screen. Genuinely interactive: an AI auto-scheduler, a ticking
 * clock-in timer, leave/attendance approvals, refillable stock, a Recipes→Stock
 * loop, multi-shop coverage, togglable availability and checklists.
 */

const OWNER_NAV = [
  { id: 'dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard },
  { id: 'chat', label: 'Chat', short: 'Chat', icon: MessageCircle },
  { id: 'staff', label: 'Staff', short: 'Staff', icon: Users },
  { id: 'shops', label: 'Shops', short: 'Shops', icon: Store },
  { id: 'shifts', label: 'Shift Templates', short: 'Shifts', icon: ClipboardList },
  { id: 'calendar', label: 'Calendar', short: 'Calendar', icon: Calendar },
  { id: 'staff-availability', label: 'Staff Availability', short: 'Avail', icon: CalendarCheck },
  { id: 'attendance', label: 'Attendance', short: 'Hours', icon: Clock },
  { id: 'checklists', label: 'Checklists', short: 'Lists', icon: ClipboardCheck },
  { id: 'knowledge', label: 'Knowledge Base', short: 'Guides', icon: BookOpen },
  { id: 'costs', label: 'Costs & Billing', short: 'Costs', icon: CreditCard },
  { id: 'settings', label: 'Settings', short: 'Settings', icon: Settings },
];

const WORKER_NAV = [
  { id: 'dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard },
  { id: 'time', label: 'My Time', short: 'Time', icon: Clock },
  { id: 'calendar', label: 'My Schedule', short: 'Schedule', icon: Calendar },
  { id: 'availability', label: 'My Availability', short: 'Avail', icon: CalendarCheck },
  { id: 'my-checklists', label: 'My Checklists', short: 'Tasks', icon: ClipboardCheck },
  { id: 'chat', label: 'Chat', short: 'Chat', icon: MessageCircle },
  { id: 'knowledge', label: 'Knowledge Base', short: 'Guides', icon: BookOpen },
  { id: 'settings', label: 'Settings', short: 'Settings', icon: Settings },
];

const INVENTORY_NAV = [
  { id: 'stock', label: 'Stock', short: 'Stock', icon: Package },
  { id: 'recipes', label: 'Recipes', short: 'Recipes', icon: CookingPot },
];

const NAVS = { owner: OWNER_NAV, worker: WORKER_NAV, inventory: INVENTORY_NAV };
const DEFAULT_SECTION = { owner: 'dashboard', worker: 'time', inventory: 'stock' };
const ROLE_META = {
  owner: { icon: LayoutDashboard, pill: 'bg-brand-600 text-white' },
  worker: { icon: Smartphone, pill: 'bg-slate-900 text-white' },
  inventory: { icon: Package, pill: 'bg-emerald-600 text-white' },
};

const INITIAL_STOCK = [
  { id: 'beans', name: 'Arabica Coffee Beans', unit: 'kg', qty: 4.2, min: 6, step: 0.5, barcode: '5011121555842' },
  { id: 'oat', name: 'Oat Milk', unit: 'L', qty: 0, min: 8, step: 1, barcode: '8410031000345' },
  { id: 'sugar', name: 'Cane Sugar', unit: 'kg', qty: 12, min: 4, step: 1, barcode: '4008400202631' },
  { id: 'cups', name: 'Paper Cups (12oz)', unit: 'pcs', qty: 320, min: 200, step: 20, barcode: '5000159407236' },
];

// Simulate order in the demo scanner: a recognised code, then an unknown one.
const DEMO_BARCODES = ['5011121555842', '9990001112223'];

// Per-section coach-marks shown as the visitor navigates the demo.
const TIPS = {
  common: {
    stock: 'Tap Scan to add stock by barcode, adjust with − / +, or Refill low items — all live.',
    recipes: 'Expand a recipe and tap Make one — its ingredients are deducted from Stock automatically.',
    chat: 'Message your whole team. Try typing and hitting send.',
    knowledge: 'Guides and SOPs your team can open anytime.',
    settings: 'Manage your account and preferences here.',
  },
  owner: {
    dashboard: 'Your daily overview. Approve pending leave right here — tap the green ✓.',
    shops: 'You run multiple locations. Tap a shop to see its team, hours and coverage gaps.',
    shifts: 'Reusable shift templates power the auto-scheduler.',
    calendar: 'Tap Auto-Schedule and watch AI build a balanced week from staff availability.',
    'staff-availability': 'See who can work at a glance before you schedule.',
    attendance: 'Review and approve clocked hours in one tap.',
    checklists: 'Track opening, closing and compliance tasks per shop.',
    costs: 'See labor cost per shop and exactly what your plan costs.',
    staff: 'Add people and set how each is paid.',
  },
  worker: {
    dashboard: 'Quick actions for your shift — jump straight to what you need.',
    time: 'You’re clocked in and the timer is live. Tap Clock Out to end your shift.',
    calendar: 'Your upcoming shifts, at a glance.',
    availability: 'Tap a day to tell managers when you can work.',
    'my-checklists': 'Tick off your opening tasks — progress saves as you go.',
  },
  inventory: {
    stock: 'Tap Scan to add stock by barcode (try Simulate scan twice), adjust with − / +, or Refill.',
    recipes: 'Make a drink and watch its ingredients come off your Stock in real time.',
  },
};
const getTip = (role, id) => TIPS[role]?.[id] || TIPS.common[id] || null;

const RECIPES = [
  { id: 'latte', name: 'Signature Latte', cat: 'Drinks', cost: '€0.82', tint: 'bg-amber-100 text-amber-700', ingredients: [{ id: 'beans', amount: 0.02 }, { id: 'oat', amount: 0.25 }, { id: 'cups', amount: 1 }] },
  { id: 'lemonade', name: 'House Lemonade', cat: 'Drinks', cost: '€0.54', tint: 'bg-blue-100 text-blue-700', ingredients: [{ id: 'sugar', amount: 0.03 }, { id: 'cups', amount: 1 }] },
  { id: 'coldbrew', name: 'Cold Brew Batch', cat: 'Prep', cost: '€3.20', tint: 'bg-purple-100 text-purple-700', ingredients: [{ id: 'beans', amount: 0.35 }, { id: 'cups', amount: 4 }] },
  { id: 'flatwhite', name: 'Flat White', cat: 'Drinks', cost: '€0.78', tint: 'bg-emerald-100 text-emerald-700', ingredients: [{ id: 'beans', amount: 0.02 }, { id: 'oat', amount: 0.18 }, { id: 'cups', amount: 1 }] },
];

const stockStatus = (it) => (it.qty <= 0 ? 'out' : it.qty < it.min ? 'low' : 'ok');
const stockPct = (it) => Math.max(0, Math.min(100, Math.round((it.qty / (it.min * 2)) * 100)));
const initials = (n) => n.split(' ').map((w) => w[0]).join('').slice(0, 2);

export default function LandingDemo() {
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
            Interactive demo — try it
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold text-slate-900 mb-3 sm:mb-4">One platform, an app for every role</h2>
          <p className="text-sm sm:text-lg text-slate-600 max-w-2xl mx-auto">Owners run the whole business, your team gets a focused app for their shifts, and inventory lives in its own Stock &amp; Recipes app. Tap the bottom bar to browse sections and actually try it — auto-schedule a week, approve leave, make a recipe and watch stock update. Each phone is fully independent.</p>
        </div>

        <div className="flex flex-wrap items-start justify-center gap-8 lg:gap-10">
          <PhoneApp role="owner" roleLabel="Owner / Manager" />
          <PhoneApp role="worker" roleLabel="Worker" />
          <PhoneApp role="inventory" roleLabel="Stock & Recipes" />
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">A real, interactive preview — nothing is saved. This is exactly what managers and staff see on their phones. <a href="/register" className="text-brand-600 font-medium hover:underline">Create your free account →</a></p>
      </div>
    </section>
  );
}

/* ─── Phone app (per role) ──────────────────────────────────── */

function PhoneApp({ role, roleLabel }) {
  const nav = NAVS[role];
  const meta = ROLE_META[role];
  const [active, setActive] = useState(DEFAULT_SECTION[role]);
  // Each phone owns a cloned copy of the stock so the two demos never share state.
  const [stock, setStock] = useState(() => INITIAL_STOCK.map((s) => ({ ...s })));
  const [dismissedTips, setDismissedTips] = useState(() => new Set());
  const onInteract = () => {}; // retained for screen signatures; no cross-phone effects
  const go = (id) => setActive(id);
  const current = nav.find((n) => n.id === active) || nav[0];

  const tip = getTip(role, active);
  const showTip = tip && !dismissedTips.has(active);
  const dismissTip = () => setDismissedTips((prev) => new Set(prev).add(active));

  // Barcode scanning — state lives here so the scanner renders inline inside the
  // phone frame (contained, not a full-screen page modal).
  const [scanOpen, setScanOpen] = useState(false);
  const [flowCode, setFlowCode] = useState(null);
  const onScan = (codeVal) => {
    setScanOpen(false);
    const match = findByBarcode(stock, codeVal);
    if (match) {
      const add = match.kind === 'box' ? boxUnits(match.item) : 1;
      setStock((prev) => prev.map((s) => (s.id === match.item.id ? { ...s, qty: Math.round((s.qty + add) * 100) / 100 } : s)));
    } else setFlowCode(codeVal);
  };
  const addSingle = (codeVal, name) => { setFlowCode(null); setStock((prev) => [...prev, { id: 'b' + Date.now(), name: name || 'New item', unit: 'pcs', qty: 1, min: 4, step: 1, barcode: codeVal }]); };
  const addBoxNew = (codeVal, units, name) => { setFlowCode(null); setStock((prev) => [...prev, { id: 'b' + Date.now(), name: name || 'New item', unit: 'pcs', qty: units, min: Math.max(1, Math.round(units / 2)), step: units, boxBarcode: codeVal, unitsPerBox: units }]); };
  const addBoxExisting = (item, codeVal, units) => { setFlowCode(null); setStock((prev) => prev.map((s) => (s.id === item.id ? { ...s, qty: s.qty + Number(units), boxBarcode: codeVal, unitsPerBox: Number(units) } : s))); };

  return (
    <div className="flex flex-col items-center">
      <div className={cn('inline-flex items-center gap-2 mb-4 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold shadow-sm', meta.pill)}>
        <meta.icon className="w-4 h-4" />
        {roleLabel}
      </div>
      <PhoneFrame>
        {/* Status bar */}
        <div className="h-7 flex items-center justify-between px-4 flex-shrink-0 text-[10px] font-semibold text-surface-500">
          <span className="tabular-nums">9:41</span>
          <span className="flex items-center gap-1"><span className="w-3.5 h-2 rounded-[2px] border border-surface-400" /></span>
        </div>
        {/* App top bar */}
        <div className="h-11 flex items-center justify-between px-3.5 bg-white/90 backdrop-blur border-b border-surface-200/60 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center flex-shrink-0"><Shield className="w-3.5 h-3.5 text-white" /></div>
            <span className="text-sm font-display font-semibold text-surface-800 truncate">{current.label}</span>
          </div>
          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 relative"><Bell className="w-4 h-4" /><span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" /></span>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-none">
          <Section role={role} active={active} stock={stock} setStock={setStock} onInteract={onInteract} go={go} openScanner={() => setScanOpen(true)} />
        </div>
        {/* Bottom nav */}
        <div className="flex-shrink-0 border-t border-surface-200/60 bg-white/95 backdrop-blur">
          <div className="flex overflow-x-auto scrollbar-none gap-0 px-1 py-1.5">
            {nav.map((item) => {
              const on = item.id === active;
              return (
                <button key={item.id} onClick={() => go(item.id)}
                  className={cn('flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[9px] font-medium flex-shrink-0 transition-all',
                    on ? 'text-brand-600 bg-brand-50' : 'text-surface-400 hover:text-surface-600')}>
                  <item.icon className="w-[18px] h-[18px]" />
                  {item.short}
                </button>
              );
            })}
          </div>
        </div>
        {/* Contextual pop-up tutorial for the current section */}
        {showTip && !scanOpen && !flowCode && <Coachmark tip={tip} onDismiss={dismissTip} />}
        {/* Barcode scanner + add flow — contained inside the phone */}
        {scanOpen && <BarcodeScanner inline open onClose={() => setScanOpen(false)} onDetected={onScan} allowSimulate simulateCodes={DEMO_BARCODES} />}
        {flowCode && <BarcodeAddFlow inline code={flowCode} items={stock} collectName onClose={() => setFlowCode(null)} onSingle={addSingle} onBoxNew={addBoxNew} onBoxExisting={addBoxExisting} />}
      </PhoneFrame>
    </div>
  );
}

function PhoneFrame({ children }) {
  return (
    <div className="relative w-[288px] sm:w-[330px] rounded-[2.75rem] bg-slate-900 p-2.5 shadow-2xl shadow-slate-900/30 border border-slate-800 animate-in">
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-28 h-5 bg-slate-900 rounded-b-2xl z-20" />
      <div className="relative rounded-[2.25rem] overflow-hidden bg-surface-50 h-[580px] flex flex-col">
        {children}
      </div>
    </div>
  );
}

function Coachmark({ tip, onDismiss }) {
  return (
    <div className="absolute left-3 right-3 bottom-16 z-30 animate-in">
      <div className="rounded-xl bg-surface-900 text-white shadow-xl shadow-slate-900/40 p-3 flex items-start gap-2.5">
        <div className="w-6 h-6 rounded-lg bg-brand-500/25 flex items-center justify-center flex-shrink-0"><Sparkles className="w-3.5 h-3.5 text-brand-300" /></div>
        <p className="text-[11px] leading-relaxed text-white/90 flex-1">{tip}</p>
        <button onClick={onDismiss} aria-label="Dismiss tip" className="text-white/50 hover:text-white transition-colors flex-shrink-0 -mt-0.5"><X className="w-4 h-4" /></button>
      </div>
      <div className="w-3 h-3 bg-surface-900 rotate-45 mx-auto -mt-1.5" />
    </div>
  );
}

/* ─── Section router ─────────────────────────────────────────── */

function Section({ role, active, stock, setStock, onInteract, go, openScanner }) {
  const worker = role === 'worker';
  switch (active) {
    case 'dashboard': return worker ? <WorkerDashboard go={go} /> : <OwnerDashboard onInteract={onInteract} go={go} />;
    case 'chat': return <ChatScreen role={role} onInteract={onInteract} />;
    case 'staff': return <StaffScreen />;
    case 'shops': return <ShopsScreen onInteract={onInteract} />;
    case 'shifts': return <TemplatesScreen />;
    case 'calendar': return worker ? <MyScheduleScreen /> : <CalendarScreen onInteract={onInteract} />;
    case 'staff-availability': return <StaffAvailabilityScreen />;
    case 'availability': return <AvailabilityScreen onInteract={onInteract} />;
    case 'attendance': return <AttendanceScreen onInteract={onInteract} />;
    case 'checklists': return <ChecklistsScreen />;
    case 'my-checklists': return <MyChecklistsScreen onInteract={onInteract} />;
    case 'knowledge': return <KnowledgeScreen />;
    case 'stock': return <StockScreen stock={stock} setStock={setStock} onInteract={onInteract} openScanner={openScanner} />;
    case 'recipes': return <RecipesScreen stock={stock} setStock={setStock} onInteract={onInteract} />;
    case 'costs': return <CostsScreen />;
    case 'time': return <WorkerTimeScreen onInteract={onInteract} />;
    case 'settings': return <SettingsScreen role={role} />;
    default: return <OwnerDashboard onInteract={onInteract} go={go} />;
  }
}

const Pad = ({ children }) => <div className="p-4 text-left">{children}</div>;
const Head = ({ title, sub, right }) => (
  <div className="flex items-center justify-between gap-2 mb-4">
    <div><p className="text-base font-display font-bold text-surface-900">{title}</p>{sub && <p className="text-xs text-surface-500">{sub}</p>}</div>
    {right}
  </div>
);
const Avatar = ({ name, className }) => (
  <div className={cn('rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center text-[11px] font-bold flex-shrink-0', className || 'w-8 h-8')}>{initials(name)}</div>
);

/* ─── Owner dashboard ───────────────────────────────────────── */

function OwnerDashboard({ onInteract, go }) {
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
    { label: 'Monthly Cost', value: '€1,240', sub: 'Basic plan', icon: TrendingUp, tint: 'from-amber-500 to-amber-700' },
  ];
  return (
    <Pad>
      <div className="rounded-xl bg-gradient-to-br from-surface-900 via-surface-800 to-brand-900 text-white p-4 mb-4">
        <p className="text-white/50 text-xs font-medium">Good morning</p>
        <p className="text-lg font-display font-bold leading-tight">Sofia — here's what's happening today</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 mb-4">
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
          <span className={cn('badge !text-[10px]', pending > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>{pending > 0 ? `${pending} waiting` : 'All clear'}</span>
        </div>
        <div className="space-y-2.5">
          {approvals.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar name={a.name} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-surface-800 truncate">{a.name}</p>
                  <p className="text-[10px] text-surface-400"><span className={cn('badge !text-[9px] !px-1.5 !py-0 mr-1', a.tone)}>{a.type}</span>{a.when}</p>
                </div>
              </div>
              {a.status === 'pending' ? (
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => resolve(a.id, 'approved')} className="w-7 h-7 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors active:scale-90"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => resolve(a.id, 'declined')} className="w-7 h-7 rounded-lg bg-surface-100 hover:bg-red-100 text-surface-500 hover:text-red-600 flex items-center justify-center transition-colors active:scale-90"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <span className={cn('badge !text-[10px] flex-shrink-0 animate-in', a.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>{a.status === 'approved' ? 'Approved' : 'Declined'}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </Pad>
  );
}

/* ─── Worker dashboard ──────────────────────────────────────── */

function WorkerDashboard({ go }) {
  const actions = [
    { id: 'time', label: 'Clock In/Out', desc: 'Start your shift', icon: Clock, tint: 'bg-brand-100 text-brand-600' },
    { id: 'calendar', label: 'My Schedule', desc: 'View your shifts', icon: Calendar, tint: 'bg-emerald-100 text-emerald-600' },
    { id: 'availability', label: 'Availability', desc: 'When you can work', icon: CalendarCheck, tint: 'bg-amber-100 text-amber-600' },
    { id: 'my-checklists', label: 'My Tasks', desc: 'Today’s checklists', icon: ClipboardCheck, tint: 'bg-purple-100 text-purple-600' },
  ];
  return (
    <Pad>
      <div className="rounded-xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white p-5 mb-4">
        <p className="text-brand-200 text-xs font-medium">Good morning</p>
        <p className="text-xl font-display font-bold mt-0.5">Alex</p>
        <p className="text-brand-200 text-sm mt-1">Next shift: Today 14:00–22:00 · Downtown</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a) => (
          <button key={a.id} onClick={() => go(a.id)} className="rounded-xl border border-surface-200/70 bg-white p-4 flex flex-col items-center text-center gap-2 hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center', a.tint)}><a.icon className="w-6 h-6" /></div>
            <p className="text-sm font-semibold text-surface-800">{a.label}</p>
            <p className="text-[11px] text-surface-400">{a.desc}</p>
          </button>
        ))}
      </div>
    </Pad>
  );
}

/* ─── Worker: My Time (ticking clock) ───────────────────────── */

function WorkerTimeScreen({ onInteract }) {
  const [clockInAt, setClockInAt] = useState(() => Date.now() - (3 * 3600 + 24 * 60) * 1000);
  const [clockedIn, setClockedIn] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [records, setRecords] = useState([
    { d: 'Mon 25', h: '8.0h', status: 'Approved', ok: true },
    { d: 'Tue 26', h: '7.5h', status: 'Approved', ok: true },
  ]);
  useEffect(() => { if (!clockedIn) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [clockedIn]);
  const elapsedMs = clockedIn ? now - clockInAt : 0;
  const h = Math.floor(elapsedMs / 3600000), m = Math.floor((elapsedMs % 3600000) / 60000), s = Math.floor((elapsedMs % 60000) / 1000);
  const elapsedH = elapsedMs / 3600000;
  const toggle = () => {
    onInteract();
    if (clockedIn) { setRecords((r) => [{ d: 'Wed 27', h: `${elapsedH.toFixed(1)}h`, status: 'Pending', ok: false }, ...r]); setClockedIn(false); }
    else { setClockInAt(Date.now()); setNow(Date.now()); setClockedIn(true); }
  };
  const monthH = 32.5 + (clockedIn ? elapsedH : 0);
  return (
    <Pad>
      <Head title="My Time" sub="Clock in/out and track your hours." />
      <div className={cn('rounded-2xl border bg-white overflow-hidden mb-4 max-w-md', clockedIn ? 'border-emerald-200' : 'border-surface-200')}>
        {clockedIn && <div className="h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />}
        <div className="p-5 text-center">
          <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg', clockedIn ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/25' : 'bg-gradient-to-br from-surface-200 to-surface-300')}>
            <Clock className={cn('w-8 h-8', clockedIn ? 'text-white' : 'text-surface-500')} />
          </div>
          {clockedIn ? (
            <>
              <p className="text-base font-display font-bold text-emerald-800">You're clocked in</p>
              <p className="text-xs text-emerald-600 mt-1 tabular-nums">{h}h {String(m).padStart(2, '0')}m {String(s).padStart(2, '0')}s</p>
              <button onClick={toggle} className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-gradient-to-b from-danger-500 to-danger-600 hover:from-danger-600 hover:to-red-700 text-white text-sm font-medium py-3 rounded-xl active:scale-[0.98] transition-all"><Square className="w-4 h-4" /> Clock Out</button>
            </>
          ) : (
            <>
              <p className="text-base font-display font-bold text-surface-800">Ready to start?</p>
              <p className="text-xs text-surface-500 mt-1">Wed 27 Aug</p>
              <button onClick={toggle} className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-gradient-to-b from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white text-sm font-medium py-3 rounded-xl shadow-brand-500/20 active:scale-[0.98] transition-all"><Play className="w-4 h-4" /> Clock In</button>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Stat icon={BarChart3} tint="text-brand-400" value={`${monthH.toFixed(1)}h`} label="This month" />
        <Stat icon={DollarSign} tint="text-amber-400" value={`€${Math.round(monthH * 15)}`} label="Expected pay" />
      </div>
    </Pad>
  );
}

const Stat = ({ icon: Icon, tint, value, label }) => (
  <div className="rounded-xl border border-surface-200/70 bg-white p-3">
    <Icon className={cn('w-4 h-4', tint)} />
    <p className="text-lg font-display font-bold text-surface-900 mt-1 tabular-nums">{value}</p>
    <p className="text-[10px] text-surface-400">{label}</p>
  </div>
);

/* ─── Chat ──────────────────────────────────────────────────── */

function ChatScreen({ role, onInteract }) {
  const [msgs, setMsgs] = useState([
    { me: false, name: 'Sofia (Manager)', text: 'Morning team! Coffee delivery arrives at 10.', t: '08:32' },
    { me: false, name: 'Lena', text: 'On it — I’ll restock the beans.', t: '08:35' },
    { me: true, name: 'You', text: 'I can cover the afternoon rush if needed 💪', t: '08:41' },
  ]);
  const [text, setText] = useState('');
  const send = () => { if (!text.trim()) return; onInteract(); setMsgs((m) => [...m, { me: true, name: 'You', text: text.trim(), t: 'now' }]); setText(''); };
  return (
    <Pad>
      <Head title="Team Chat" sub="Downtown · 6 members" right={<span className="badge bg-emerald-100 text-emerald-700 !text-[10px]">● Live</span>} />
      <div className="space-y-2.5 mb-3">
        {msgs.map((mm, i) => (
          <div key={i} className={cn('flex gap-2', mm.me && 'flex-row-reverse')}>
            {!mm.me && <Avatar name={mm.name} className="w-7 h-7" />}
            <div className={cn('max-w-[75%] rounded-2xl px-3 py-2', mm.me ? 'bg-brand-600 text-white' : 'bg-white border border-surface-200/70')}>
              {!mm.me && <p className="text-[10px] font-semibold text-surface-500 mb-0.5">{mm.name}</p>}
              <p className={cn('text-xs', mm.me ? 'text-white' : 'text-surface-700')}>{mm.text}</p>
              <p className={cn('text-[9px] mt-0.5', mm.me ? 'text-white/60' : 'text-surface-400')}>{mm.t}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 max-w-lg">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Message the team…" className="flex-1 bg-white border border-surface-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
        <button onClick={send} className="w-9 h-9 rounded-xl bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center active:scale-95 transition-all"><Send className="w-4 h-4" /></button>
      </div>
    </Pad>
  );
}

/* ─── Staff ─────────────────────────────────────────────────── */

const STAFF = [
  { name: 'Lena Fischer', role: 'manager', pos: 'Shift Lead', pay: 'Salaried', color: 'bg-purple-500' },
  { name: 'Marco Bianchi', role: 'worker', pos: 'Barista', pay: '€15/hr', color: 'bg-brand-500' },
  { name: 'Tomás Reyes', role: 'worker', pos: 'Barista', pay: '€14/hr', color: 'bg-emerald-500' },
  { name: 'Aisha Khan', role: 'worker', pos: 'Kitchen', pay: '€16/hr', color: 'bg-amber-500' },
  { name: 'Nina Petrova', role: 'worker', pos: 'Front of House', pay: '€14/hr', color: 'bg-rose-500' },
  { name: 'Jonas Weber', role: 'worker', pos: 'Barista', pay: '€15/hr', color: 'bg-cyan-500' },
];

function StaffScreen() {
  return (
    <Pad>
      <Head title="Staff" sub="6 active · 1 inactive" right={<span className="btn-primary !py-1.5 !px-3 !text-xs pointer-events-none"><Plus className="w-3.5 h-3.5" /> Add</span>} />
      <div className="grid grid-cols-1 gap-2.5">
        {STAFF.map((w) => (
          <div key={w.name} className="rounded-xl border border-surface-200/70 bg-white p-3.5 flex items-center gap-3">
            <div className="relative">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white', w.color)}>{initials(w.name)}</div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-surface-800 truncate">{w.name}</p>
              <p className="text-[11px] text-surface-400">{w.pos}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className={cn('badge !text-[9px] capitalize', w.role === 'manager' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700')}>{w.role}</span>
              <p className="text-[11px] text-surface-500 mt-1">{w.pay}</p>
            </div>
          </div>
        ))}
      </div>
    </Pad>
  );
}

/* ─── Shops (multi-location org, interactive) ───────────────── */

const SHOPS = [
  { id: 'downtown', name: 'Downtown', addr: '12 Market St', manager: 'Lena Fischer', staff: 11, hours: '06:00 – 22:00', filled: 5, needed: 6, color: '#4c6ef5' },
  { id: 'riverside', name: 'Riverside', addr: '48 Canal Rd', manager: 'Nina Petrova', staff: 8, hours: '07:00 – 20:00', filled: 4, needed: 4, color: '#7c3aed' },
  { id: 'airport', name: 'Airport Kiosk', addr: 'Terminal 2', manager: 'Jonas Weber', staff: 5, hours: '05:00 – 23:00', filled: 2, needed: 3, color: '#059669' },
];

const Mini = ({ icon: Icon, label, value }) => (
  <div className="rounded-lg bg-surface-50 border border-surface-200/60 p-2.5 min-w-0">
    <div className="flex items-center gap-1.5 text-[10px] text-surface-400 mb-0.5"><Icon className="w-3 h-3 flex-shrink-0" /> {label}</div>
    <p className="text-[11px] font-medium text-surface-700 truncate">{value}</p>
  </div>
);

function ShopsScreen({ onInteract }) {
  const [openId, setOpenId] = useState('downtown');
  return (
    <Pad>
      <Head title="Shops" sub="Bean & Brew Co. · 3 locations" right={<span className="btn-primary !py-1.5 !px-3 !text-xs pointer-events-none"><Plus className="w-3.5 h-3.5" /> Add</span>} />
      <div className="space-y-2.5">
        {SHOPS.map((s) => {
          const open = openId === s.id;
          const gap = s.needed - s.filled;
          return (
            <div key={s.id} className="rounded-xl border border-surface-200/70 bg-white overflow-hidden">
              <button onClick={() => { onInteract(); setOpenId(open ? null : s.id); }} className="w-full p-3.5 flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: s.color + '22' }}><Store className="w-5 h-5" style={{ color: s.color }} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-surface-800 truncate">{s.name}</p>
                    <span className="badge bg-emerald-100 text-emerald-700 !text-[9px] !px-1.5 !py-0 flex-shrink-0">Open</span>
                  </div>
                  <p className="text-[11px] text-surface-400 flex items-center gap-1 truncate"><MapPin className="w-3 h-3 flex-shrink-0" /> {s.addr}</p>
                </div>
                {gap > 0
                  ? <span className="badge bg-amber-100 text-amber-700 !text-[9px] flex-shrink-0">{gap} to fill</span>
                  : <span className="badge bg-emerald-100 text-emerald-700 !text-[9px] flex-shrink-0">Covered</span>}
                <ChevronDown className={cn('w-4 h-4 text-surface-400 flex-shrink-0 transition-transform', open && 'rotate-180')} />
              </button>
              {open && (
                <div className="px-3.5 pb-3.5 animate-in">
                  <div className="grid grid-cols-2 gap-2">
                    <Mini icon={Users} label="Team" value={`${s.staff} staff`} />
                    <Mini icon={Clock} label="Hours" value={s.hours} />
                    <Mini icon={Shield} label="Manager" value={s.manager} />
                    <Mini icon={Calendar} label="Today" value={`${s.filled}/${s.needed} shifts`} />
                  </div>
                  {gap > 0 && (
                    <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                      <p className="text-[11px] text-amber-800">{gap} shift{gap > 1 ? 's' : ''} open today — post it or auto-schedule.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Pad>
  );
}

/* ─── Shift Templates ───────────────────────────────────────── */

function TemplatesScreen() {
  const t = [
    { name: 'Opening', time: '06:00 – 14:00', type: 'morning', badge: 'badge-morning' },
    { name: 'Mid', time: '10:00 – 18:00', type: 'afternoon', badge: 'badge-afternoon' },
    { name: 'Closing', time: '14:00 – 22:00', type: 'afternoon', badge: 'badge-afternoon' },
    { name: 'Night', time: '22:00 – 06:00', type: 'night', badge: 'badge-night' },
  ];
  return (
    <Pad>
      <Head title="Shift Templates" sub="Reusable shifts for auto-scheduling" right={<span className="btn-primary !py-1.5 !px-3 !text-xs pointer-events-none"><Plus className="w-3.5 h-3.5" /> New</span>} />
      <div className="rounded-xl border border-surface-200/70 bg-white divide-y divide-surface-100 overflow-hidden max-w-xl">
        {t.map((x) => (
          <div key={x.name} className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-100 flex items-center justify-center"><Clock className="w-4 h-4 text-surface-500" /></div>
              <div><p className="text-sm font-medium text-surface-800">{x.name}</p><p className="text-[11px] text-surface-400 tabular-nums">{x.time}</p></div>
            </div>
            <span className={cn('badge !text-[10px] capitalize', x.badge)}>{x.type}</span>
          </div>
        ))}
      </div>
    </Pad>
  );
}

/* ─── Calendar (owner) — interactive AI auto-scheduler ──────── */

const WEEK = [
  { d: 'Mon', n: '25' }, { d: 'Tue', n: '26' }, { d: 'Wed', n: '27' }, { d: 'Thu', n: '28' },
  { d: 'Fri', n: '29' }, { d: 'Sat', n: '30' }, { d: 'Sun', n: '31' },
];
const PLAN = {
  Mon: [['Opening', 'Lena', 'm'], ['Closing', 'Marco', 'a']],
  Tue: [['Opening', 'Aisha', 'm'], ['Mid', 'Nina', 'a']],
  Wed: [['Opening', 'Marco', 'm'], ['Closing', 'Jonas', 'a']],
  Thu: [['Mid', 'Lena', 'a'], ['Closing', 'Tomás', 'a']],
  Fri: [['Opening', 'Nina', 'm'], ['Closing', 'Marco', 'a'], ['Night', 'Jonas', 'n']],
  Sat: [['Mid', 'Aisha', 'a'], ['Closing', 'Lena', 'a']],
  Sun: [['Mid', 'Tomás', 'a']],
};
const SHIFT_DOT = { m: 'bg-amber-400', a: 'bg-orange-400', n: 'bg-indigo-400' };

function CalendarScreen({ onInteract }) {
  const [scheduled, setScheduled] = useState(false);
  const [generating, setGenerating] = useState(false);
  const total = Object.values(PLAN).reduce((s, a) => s + a.length, 0);

  const generate = () => {
    onInteract();
    setGenerating(true);
    setTimeout(() => { setGenerating(false); setScheduled(true); }, 900);
  };

  return (
    <Pad>
      <Head title="Calendar" sub="Downtown · Week of Aug 25"
        right={scheduled ? <button onClick={() => { onInteract(); setScheduled(false); }} className="text-[11px] font-medium text-surface-500 hover:text-surface-700">Reset</button> : null} />

      {!scheduled && (
        <div className="rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50/80 to-brand-50/30 p-4 mb-3 text-center">
          <div className="w-11 h-11 rounded-2xl bg-brand-100 flex items-center justify-center mx-auto mb-2"><Wand2 className="w-5 h-5 text-brand-600" /></div>
          <p className="text-sm font-semibold text-surface-800">Let AI build your week</p>
          <p className="text-[11px] text-surface-500 mt-0.5 mb-3">Assigns staff from their availability, target hours and your shift templates — no conflicts, no gaps.</p>
          <button onClick={generate} disabled={generating}
            className="inline-flex items-center gap-2 bg-gradient-to-b from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl active:scale-[0.98] transition-all disabled:opacity-70">
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Wand2 className="w-4 h-4" /> Auto-Schedule</>}
          </button>
        </div>
      )}

      {scheduled && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 mb-3 flex items-center gap-2 animate-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <p className="text-[11px] text-emerald-800"><span className="font-semibold">{total} shifts assigned</span> across 6 staff — balanced by availability.</p>
        </div>
      )}

      <div className="space-y-2">
        {WEEK.map((day) => {
          const items = scheduled ? (PLAN[day.d] || []) : [];
          return (
            <div key={day.d} className="rounded-xl border border-surface-200/70 bg-white p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold text-surface-700">{day.d}</span>
                <span className="text-[10px] text-surface-400 tabular-nums">Aug {day.n}</span>
              </div>
              {items.length === 0 ? (
                <p className="text-[11px] text-surface-300">{generating ? 'Assigning…' : 'No shifts yet'}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {items.map((it, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-surface-50 border border-surface-200/70 pl-2 pr-2.5 py-1 text-[11px] animate-in">
                      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', SHIFT_DOT[it[2]])} />
                      <span className="font-medium text-surface-700">{it[0]}</span>
                      <span className="text-surface-300">·</span>
                      <span className="text-surface-600">{it[1]}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 mt-3 text-[10px] text-surface-500">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Morning</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-400" /> Afternoon</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-400" /> Night</span>
      </div>
    </Pad>
  );
}

/* ─── Worker: My Schedule ───────────────────────────────────── */

function MyScheduleScreen() {
  const shifts = [
    { day: 'Today', date: 'Wed 27', time: '14:00 – 22:00', shop: 'Downtown', badge: 'badge-afternoon', type: 'Afternoon' },
    { day: 'Tomorrow', date: 'Thu 28', time: '06:00 – 14:00', shop: 'Downtown', badge: 'badge-morning', type: 'Morning' },
    { day: 'Saturday', date: 'Sat 30', time: '10:00 – 18:00', shop: 'Riverside', badge: 'badge-afternoon', type: 'Mid' },
  ];
  return (
    <Pad>
      <Head title="My Schedule" sub="Your upcoming shifts" />
      <div className="space-y-2.5 max-w-lg">
        {shifts.map((s) => (
          <div key={s.date} className="rounded-xl border border-surface-200/70 bg-white p-3.5 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand-50 flex flex-col items-center justify-center flex-shrink-0">
              <span className="text-[9px] text-brand-500 font-semibold uppercase">{s.date.split(' ')[0]}</span>
              <span className="text-sm font-bold text-brand-700 leading-none">{s.date.split(' ')[1]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-surface-800">{s.day} · <span className="tabular-nums">{s.time}</span></p>
              <p className="text-[11px] text-surface-400 flex items-center gap-1"><Store className="w-3 h-3" /> {s.shop}</p>
            </div>
            <span className={cn('badge !text-[10px]', s.badge)}>{s.type}</span>
          </div>
        ))}
      </div>
    </Pad>
  );
}

/* ─── Staff Availability (owner matrix) ─────────────────────── */

function StaffAvailabilityScreen() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const rows = [
    { name: 'Lena', a: [1, 1, 0, 1, 1, 0, 0] },
    { name: 'Marco', a: [0, 1, 1, 1, 1, 1, 0] },
    { name: 'Aisha', a: [1, 0, 1, 1, 0, 1, 1] },
    { name: 'Nina', a: [1, 1, 1, 0, 0, 1, 1] },
  ];
  return (
    <Pad>
      <Head title="Staff Availability" sub="Who can work, at a glance" />
      <div className="rounded-xl border border-surface-200/70 bg-white p-3 max-w-md">
        <div className="grid grid-cols-8 gap-1 mb-1 text-[10px] font-semibold text-surface-400 text-center">
          <div />{days.map((d, i) => <div key={i}>{d}</div>)}
        </div>
        {rows.map((r) => (
          <div key={r.name} className="grid grid-cols-8 gap-1 items-center py-0.5">
            <div className="text-[11px] font-medium text-surface-700 truncate">{r.name}</div>
            {r.a.map((v, i) => <div key={i} className={cn('h-5 rounded-md', v ? 'bg-emerald-400' : 'bg-surface-100')} />)}
          </div>
        ))}
        <div className="flex gap-3 mt-2 text-[10px] text-surface-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-400" /> Available</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-surface-200" /> Off</span>
        </div>
      </div>
    </Pad>
  );
}

/* ─── Worker: My Availability (interactive toggles) ─────────── */

function AvailabilityScreen({ onInteract }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const [avail, setAvail] = useState([1, 1, 0, 1, 1, 0, 0]);
  const toggle = (i) => { onInteract(); setAvail((a) => a.map((v, j) => (j === i ? (v ? 0 : 1) : v))); };
  return (
    <Pad>
      <Head title="My Availability" sub="Tap a day to toggle when you can work" />
      <div className="grid grid-cols-7 gap-2 max-w-lg">
        {days.map((d, i) => (
          <button key={i} onClick={() => toggle(i)}
            className={cn('rounded-xl p-3 flex flex-col items-center gap-1.5 border transition-all active:scale-95',
              avail[i] ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-surface-200 text-surface-400')}>
            <span className="text-[11px] font-semibold">{d}</span>
            {avail[i] ? <CheckCircle className="w-5 h-5" /> : <X className="w-5 h-5" />}
            <span className="text-[9px] font-medium">{avail[i] ? 'Available' : 'Off'}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-surface-400 mt-3">Managers see this instantly when building the schedule.</p>
    </Pad>
  );
}

/* ─── Attendance (owner, interactive approve) ───────────────── */

function AttendanceScreen({ onInteract }) {
  const [rows, setRows] = useState([
    { id: 1, name: 'Marco Bianchi', date: 'Aug 27', hours: '7.8h', in: '14:02', out: '21:50', status: 'pending' },
    { id: 2, name: 'Aisha Khan', date: 'Aug 27', hours: '8.1h', in: '06:00', out: '14:06', status: 'pending' },
    { id: 3, name: 'Nina Petrova', date: 'Aug 26', hours: '6.0h', in: '10:00', out: '16:00', status: 'approved' },
  ]);
  const set = (id, status) => { onInteract(); setRows((r) => r.map((x) => (x.id === id ? { ...x, status } : x))); };
  return (
    <Pad>
      <Head title="Attendance" sub="Review and approve clocked hours" />
      <div className="rounded-xl border border-surface-200/70 bg-white divide-y divide-surface-100 overflow-hidden">
        {rows.map((r) => (
          <div key={r.id} className="p-3.5 flex items-center gap-3">
            <Avatar name={r.name} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-surface-800 truncate">{r.name}</p>
              <p className="text-[11px] text-surface-400 tabular-nums">{r.date} · {r.in} → {r.out}</p>
            </div>
            <span className="text-sm font-semibold text-surface-700 tabular-nums flex-shrink-0">{r.hours}</span>
            {r.status === 'pending' ? (
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => set(r.id, 'approved')} className="w-7 h-7 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center active:scale-90 transition-all"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => set(r.id, 'rejected')} className="w-7 h-7 rounded-lg bg-surface-100 hover:bg-red-100 text-surface-500 hover:text-red-600 flex items-center justify-center active:scale-90 transition-all"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <span className={cn('badge !text-[10px] flex-shrink-0', r.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>{r.status === 'approved' ? 'Approved' : 'Rejected'}</span>
            )}
          </div>
        ))}
      </div>
    </Pad>
  );
}

/* ─── Checklists (owner) ────────────────────────────────────── */

function ChecklistsScreen() {
  const lists = [
    { name: 'Opening Checklist', shop: 'Downtown', done: 8, total: 8 },
    { name: 'Closing Checklist', shop: 'Downtown', done: 5, total: 9 },
    { name: 'Food Safety Daily', shop: 'All shops', done: 3, total: 6 },
  ];
  return (
    <Pad>
      <Head title="Checklists" sub="Track opening, closing & compliance tasks" right={<span className="btn-primary !py-1.5 !px-3 !text-xs pointer-events-none"><Plus className="w-3.5 h-3.5" /> New</span>} />
      <div className="space-y-2.5 max-w-xl">
        {lists.map((l) => {
          const pct = Math.round((l.done / l.total) * 100);
          const complete = l.done === l.total;
          return (
            <div key={l.name} className="rounded-xl border border-surface-200/70 bg-white p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className={cn('w-4 h-4', complete ? 'text-emerald-500' : 'text-brand-500')} />
                  <p className="text-sm font-medium text-surface-800">{l.name}</p>
                </div>
                <span className={cn('badge !text-[10px]', complete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>{l.done}/{l.total}</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-100 overflow-hidden"><div className={cn('h-full rounded-full', complete ? 'bg-emerald-500' : 'bg-brand-500')} style={{ width: `${pct}%` }} /></div>
              <p className="text-[10px] text-surface-400 mt-1.5">{l.shop}</p>
            </div>
          );
        })}
      </div>
    </Pad>
  );
}

/* ─── Worker: My Checklists (interactive) ───────────────────── */

function MyChecklistsScreen({ onInteract }) {
  const [tasks, setTasks] = useState([
    { id: 1, t: 'Switch on espresso machine', done: true },
    { id: 2, t: 'Check fridge temperatures', done: true },
    { id: 3, t: 'Refill bean hoppers', done: false },
    { id: 4, t: 'Wipe down counters', done: false },
    { id: 5, t: 'Count opening float', done: false },
  ]);
  const toggle = (id) => { onInteract(); setTasks((t) => t.map((x) => (x.id === id ? { ...x, done: !x.done } : x))); };
  const done = tasks.filter((t) => t.done).length;
  return (
    <Pad>
      <Head title="My Checklists" sub="Opening Checklist · Downtown" right={<span className={cn('badge !text-[10px]', done === tasks.length ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>{done}/{tasks.length}</span>} />
      <div className="rounded-xl border border-surface-200/70 bg-white divide-y divide-surface-100 overflow-hidden max-w-lg">
        {tasks.map((t) => (
          <button key={t.id} onClick={() => toggle(t.id)} className="w-full p-3.5 flex items-center gap-3 text-left hover:bg-surface-50 transition-colors">
            <span className={cn('w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all', t.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-surface-300 text-transparent')}><Check className="w-3.5 h-3.5" /></span>
            <span className={cn('text-sm', t.done ? 'text-surface-400 line-through' : 'text-surface-700')}>{t.t}</span>
          </button>
        ))}
      </div>
    </Pad>
  );
}

/* ─── Knowledge Base ────────────────────────────────────────── */

function KnowledgeScreen() {
  const arts = [
    { t: 'How to pull the perfect espresso', cat: 'Barista', icon: Coffee, tint: 'bg-amber-100 text-amber-700' },
    { t: 'Opening & closing procedures', cat: 'Operations', icon: ClipboardCheck, tint: 'bg-brand-100 text-brand-700' },
    { t: 'Allergen handling policy', cat: 'Food Safety', icon: AlertTriangle, tint: 'bg-red-100 text-red-700' },
    { t: 'Cash handling & tips', cat: 'Finance', icon: DollarSign, tint: 'bg-emerald-100 text-emerald-700' },
  ];
  return (
    <Pad>
      <Head title="Knowledge Base" sub="Guides & SOPs for your team" />
      <div className="grid grid-cols-1 gap-2.5">
        {arts.map((a) => (
          <div key={a.t} className="rounded-xl border border-surface-200/70 bg-white p-3.5 flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', a.tint)}><a.icon className="w-5 h-5" /></div>
            <div className="min-w-0"><p className="text-sm font-medium text-surface-800 truncate">{a.t}</p><span className="text-[10px] text-surface-400">{a.cat}</span></div>
          </div>
        ))}
      </div>
    </Pad>
  );
}

/* ─── Costs & Billing ───────────────────────────────────────── */

function CostsScreen() {
  const bars = [
    { name: 'Downtown', pct: 82, val: '€6,420' },
    { name: 'Riverside', pct: 55, val: '€4,310' },
    { name: 'Airport Kiosk', pct: 30, val: '€2,180' },
  ];
  return (
    <Pad>
      <Head title="Costs & Billing" sub="August 2026" />
      <div className="rounded-xl border border-surface-200/70 bg-white p-4 mb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="badge bg-brand-100 text-brand-700 !text-[10px] flex-shrink-0">Professional</span>
            <span className="text-sm font-semibold text-surface-900">€1,240/mo</span>
          </div>
          <span className="text-[10px] text-surface-500 flex-shrink-0">24 workers · 3 shops</span>
        </div>
        <div className="mt-3 pt-3 border-t border-surface-100 flex flex-col gap-1.5 text-[11px] text-surface-500">
          <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> First 4 workers &amp; 1 shop free</span>
          <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-brand-500" /> €2 / extra worker per month</span>
          <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-purple-500" /> Save ~17% with yearly billing</span>
        </div>
      </div>
      <div className="rounded-xl border border-surface-200/70 bg-white p-4">
        <p className="text-sm font-display font-semibold text-surface-800 mb-3">Labor cost by shop</p>
        <div className="space-y-2.5">
          {bars.map((b) => (
            <div key={b.name}>
              <div className="flex items-center justify-between text-[11px] mb-1"><span className="text-surface-600">{b.name}</span><span className="font-semibold text-surface-800 tabular-nums">{b.val}</span></div>
              <div className="h-2 rounded-full bg-surface-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600" style={{ width: `${b.pct}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </Pad>
  );
}

/* ─── Settings ──────────────────────────────────────────────── */

function SettingsScreen({ role }) {
  return (
    <Pad>
      <Head title="Settings" sub={role === 'owner' ? 'Organization & account' : 'Your account'} />
      <div className="space-y-3 max-w-xl">
        <div className="rounded-xl border border-surface-200/70 bg-white p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold">{role === 'owner' ? 'S' : 'A'}</div>
          <div><p className="text-sm font-semibold text-surface-800">{role === 'owner' ? 'Sofia Marin' : 'Alex Novak'}</p><p className="text-[11px] text-surface-400 capitalize">{role === 'owner' ? 'admin' : 'worker'} · Bean & Brew Co.</p></div>
        </div>
        {[
          { label: 'Push notifications', on: true },
          { label: 'Email summaries', on: role === 'owner' },
          { label: 'Two-factor authentication', on: false },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-surface-200/70 bg-white p-3.5 flex items-center justify-between">
            <span className="text-sm text-surface-700">{s.label}</span>
            <span className={cn('w-9 h-5 rounded-full flex items-center px-0.5 transition-colors', s.on ? 'bg-brand-500 justify-end' : 'bg-surface-200 justify-start')}><span className="w-4 h-4 rounded-full bg-white shadow" /></span>
          </div>
        ))}
      </div>
    </Pad>
  );
}

/* ─── Recipes (shares live stock) ───────────────────────────── */

function RecipesScreen({ stock, setStock, onInteract }) {
  const [expanded, setExpanded] = useState(null);
  const [made, setMade] = useState({});
  const [flash, setFlash] = useState(null);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 1800); return () => clearTimeout(t); }, [flash]);
  const byId = (id) => stock.find((s) => s.id === id);
  const make = (recipe) => {
    onInteract();
    const short = recipe.ingredients.find((ing) => { const it = byId(ing.id); return !it || it.qty < ing.amount; });
    if (short) { const it = byId(short.id); setFlash({ id: recipe.id, ok: false, msg: `Not enough ${it?.name || 'stock'}` }); return; }
    setStock((prev) => prev.map((sit) => { const ing = recipe.ingredients.find((i) => i.id === sit.id); return ing ? { ...sit, qty: Math.round((sit.qty - ing.amount) * 100) / 100 } : sit; }));
    setMade((m) => ({ ...m, [recipe.id]: (m[recipe.id] || 0) + 1 }));
    setFlash({ id: recipe.id, ok: true, msg: 'Made · stock deducted' });
  };
  return (
    <Pad>
      <Head title="Recipes" sub="Cost every product and deduct stock in one tap." right={<span className="badge bg-brand-100 text-brand-700 !text-[10px]">{RECIPES.length}</span>} />
      <div className="grid grid-cols-1 gap-2.5">
        {RECIPES.map((r) => {
          const open = expanded === r.id;
          return (
            <div key={r.id} className="rounded-xl border border-surface-200/70 bg-white overflow-hidden">
              <button onClick={() => { onInteract(); setExpanded(open ? null : r.id); }} className="w-full p-3.5 flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center flex-shrink-0"><CookingPot className="w-5 h-5 text-white" /></div>
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
              {open && (
                <div className="px-3.5 pb-3.5 animate-in">
                  <div className="rounded-lg bg-surface-50 p-2.5 space-y-1.5">
                    {r.ingredients.map((ing) => {
                      const it = byId(ing.id); const enough = it && it.qty >= ing.amount;
                      return (
                        <div key={ing.id} className="flex items-center justify-between text-[11px]">
                          <span className="text-surface-600">{it?.name}</span>
                          <span className={cn('font-medium tabular-nums', enough ? 'text-surface-700' : 'text-red-600')}>{ing.amount}{it?.unit}{enough ? '' : ' · short'}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between mt-2.5 gap-2">
                    {flash?.id === r.id ? <span className={cn('text-[11px] font-medium animate-in', flash.ok ? 'text-emerald-600' : 'text-red-600')}>{flash.msg}</span> : <span />}
                    <button onClick={() => make(r)} className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg active:scale-95 transition-all flex-shrink-0"><Check className="w-3.5 h-3.5" /> Make one</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-surface-400 mt-3 flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Making a recipe updates the Stock section live — try it, then open Stock.</p>
    </Pad>
  );
}

/* ─── Stock (shares live stock) ─────────────────────────────── */

function StockScreen({ stock, setStock, onInteract, openScanner }) {
  const meta = {
    ok: { badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500', label: 'In stock' },
    low: { badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500', label: 'Low' },
    out: { badge: 'bg-red-100 text-red-700', bar: 'bg-red-500', label: 'Out' },
  };
  const adjust = (id, delta) => { onInteract(); setStock((prev) => prev.map((s) => (s.id === id ? { ...s, qty: Math.max(0, Math.round((s.qty + delta) * 100) / 100) } : s))); };
  const refill = (id) => { onInteract(); setStock((prev) => prev.map((s) => (s.id === id ? { ...s, qty: s.min * 2 } : s))); };

  const low = stock.filter((s) => stockStatus(s) === 'low').length;
  const out = stock.filter((s) => stockStatus(s) === 'out').length;
  const attention = low + out;
  return (
    <Pad>
      <Head title="Stock" sub={`${stock.length} items · ${low} low · ${out} out`}
        right={<div className="flex items-center gap-1.5">
          <button onClick={() => { onInteract(); openScanner?.(); }} className="inline-flex items-center gap-1 bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg active:scale-95 transition-all"><ScanLine className="w-3.5 h-3.5" /> Scan</button>
          <span className={cn('inline-flex items-center gap-1 badge !text-[10px]', attention > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>{attention > 0 ? <><AlertTriangle className="w-3 h-3" /> {attention}</> : <CheckCircle className="w-3 h-3" />}</span>
        </div>} />
      <div className="space-y-2.5">
        {stock.map((it) => {
          const st = stockStatus(it); const m = meta[st];
          return (
            <div key={it.id} className="rounded-xl border border-surface-200/70 bg-white p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-medium text-surface-800 truncate">{it.name}</p>
                  <span className={cn('badge !text-[9px] !px-1.5 !py-0 flex-shrink-0', m.badge)}>{m.label}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => adjust(it.id, -it.step)} className="w-6 h-6 rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-600 flex items-center justify-center active:scale-90 transition-all"><Minus className="w-3.5 h-3.5" /></button>
                  <span className="text-sm font-display font-bold text-surface-900 tabular-nums w-14 text-center">{it.qty}<span className="text-[9px] text-surface-400 font-normal ml-0.5">{it.unit}</span></span>
                  <button onClick={() => adjust(it.id, it.step)} className="w-6 h-6 rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-600 flex items-center justify-center active:scale-90 transition-all"><Plus className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-surface-100 overflow-hidden"><div className={cn('h-full rounded-full transition-all duration-500', m.bar)} style={{ width: `${stockPct(it)}%` }} /></div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-surface-400">Par level {it.min}{it.unit}</span>
                {st !== 'ok' ? (
                  <button onClick={() => refill(it.id)} className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-700 active:scale-95 transition-all"><RotateCw className="w-3 h-3" /> Refill to par</button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500"><CheckCircle className="w-3 h-3" /> Stocked</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-surface-400 mt-3 flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Levels sync with Recipes — making a drink deducts stock automatically.</p>
    </Pad>
  );
}
