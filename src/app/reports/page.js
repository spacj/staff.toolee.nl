'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { getAttendance, getWorkers, getShops, getShifts, getPermits, getStockItems, getStockLogs, getOvertimeRules, getPublicHolidays } from '@/lib/firestore';
import { calculateWorkerCostWithOvertime } from '@/lib/scheduling';
import { hasProPlan, formatCurrency } from '@/lib/pricing';
import { cn } from '@/utils/helpers';
import { BarChart3, Clock, Users, Calendar, Package, TrendingDown, Store, FileSpreadsheet, DollarSign, AlertTriangle, Sparkles, ArrowRight, Euro, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';

const roleOf = (w) => (w?.jobRole || w?.customRole || w?.position || 'Staff');
const parseHM = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) + (m || 0) / 60; };
const shiftHours = (s) => {
  if (typeof s.hours === 'number' && s.hours > 0) return s.hours;
  if (s.startTime && s.endTime) { let d = parseHM(s.endTime) - parseHM(s.startTime); if (d < 0) d += 24; return d; }
  return 0;
};

function PremiumUpsell() {
  return (
    <div className="max-w-2xl mx-auto py-6">
      <div className="card overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-purple-500 via-indigo-500 to-brand-500" />
        <div className="p-6 sm:p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
            <BarChart3 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-surface-900">Detailed reports are a Pro feature</h1>
          <p className="text-sm text-surface-500 mt-1.5 max-w-md mx-auto">
            Upgrade to Pro to unlock in-depth <strong>schedule, shift and cost</strong> reports — per worker, per shop and per role, with CSV export.
          </p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left">
            {[
              { icon: CalendarDays, t: 'Schedule', d: 'Coverage by day, shop and role' },
              { icon: Clock, t: 'Shifts', d: 'Hours & shifts per worker' },
              { icon: Euro, t: 'Costs', d: 'Labour cost with overtime' },
            ].map(f => (
              <div key={f.t} className="rounded-xl border border-surface-200/70 bg-surface-50/60 p-3">
                <f.icon className="w-4 h-4 text-brand-600 mb-1.5" />
                <p className="text-sm font-semibold text-surface-800">{f.t}</p>
                <p className="text-xs text-surface-500">{f.d}</p>
              </div>
            ))}
          </div>
          <Link href="/costs" className="btn-primary mt-6 w-full sm:w-auto">Upgrade to Pro <ArrowRight className="w-4 h-4" /></Link>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { orgId, isManager, organization, isSuperAdmin } = useAuth();
  const premium = isSuperAdmin || hasProPlan(organization);

  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [attendance, setAttendance] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [shops, setShops] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [permits, setPermits] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [stockLogs, setStockLogs] = useState([]);
  const [overtimeRules, setOvertimeRules] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('schedule');

  const startDate = `${period}-01`;
  const endDate = `${period}-31`;

  useEffect(() => {
    if (!orgId || !premium) return;
    setLoading(true);
    Promise.all([
      getAttendance({ orgId, startDate, endDate, limit: 5000 }),
      getWorkers({ orgId }),
      getShops(orgId),
      getShifts({ orgId, startDate, endDate }),
      getPermits({ orgId }),
      getStockItems({ orgId }),
      getStockLogs(orgId, { limit: 500 }),
      getOvertimeRules(orgId),
      getPublicHolidays(orgId),
    ]).then(([att, w, s, sh, p, si, sl, ot, h]) => {
      setAttendance(att); setWorkers(w); setShops(s); setShifts(sh);
      setPermits(p); setStockItems(si); setStockLogs(sl); setOvertimeRules(ot); setHolidays(h);
    }).finally(() => setLoading(false));
  }, [orgId, period, premium]);

  const activeWorkers = workers.filter(w => w.status === 'active');
  const workerName = (id) => { const w = workers.find(x => x.id === id); return w ? `${w.firstName} ${w.lastName}` : 'Unknown'; };
  const shopName = (id) => shops.find(s => s.id === id)?.name || 'No shop';

  // ─── Schedule report ───────────────────
  const scheduleReport = useMemo(() => {
    const byDate = {};
    shifts.forEach(s => {
      if (!byDate[s.date]) byDate[s.date] = { scheduled: 0, workers: new Set(), hours: 0 };
      byDate[s.date].scheduled++;
      byDate[s.date].workers.add(s.workerId);
      byDate[s.date].hours += shiftHours(s);
    });
    const days = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({
      date, dayName: new Date(date + 'T00:00').toLocaleDateString('en', { weekday: 'short' }),
      shifts: d.scheduled, workers: d.workers.size, hours: d.hours,
    }));
    const totalHours = days.reduce((s, d) => s + d.hours, 0);
    const busiest = days.reduce((m, d) => (d.shifts > (m?.shifts || 0) ? d : m), null);
    const avgWorkers = days.length ? days.reduce((s, d) => s + d.workers, 0) / days.length : 0;

    const byShop = {}; const byRole = {};
    shifts.forEach(s => {
      const sn = shopName(s.shopId);
      byShop[sn] = byShop[sn] || { shifts: 0, hours: 0 };
      byShop[sn].shifts++; byShop[sn].hours += shiftHours(s);
      const r = roleOf(workers.find(w => w.id === s.workerId));
      byRole[r] = byRole[r] || { shifts: 0, hours: 0 };
      byRole[r].shifts++; byRole[r].hours += shiftHours(s);
    });
    return { days, totalHours, busiest, avgWorkers,
      byShop: Object.entries(byShop).sort((a, b) => b[1].hours - a[1].hours),
      byRole: Object.entries(byRole).sort((a, b) => b[1].hours - a[1].hours) };
  }, [shifts, workers, shops]);

  // ─── Shifts report (per worker) ────────
  const shiftsReport = useMemo(() => {
    const byWorker = {};
    shifts.forEach(s => {
      const id = s.workerId;
      byWorker[id] = byWorker[id] || { shifts: 0, hours: 0, shops: new Set() };
      byWorker[id].shifts++; byWorker[id].hours += shiftHours(s); byWorker[id].shops.add(s.shopId);
    });
    return Object.entries(byWorker).map(([id, d]) => ({
      id, name: workerName(id), role: roleOf(workers.find(w => w.id === id)),
      shifts: d.shifts, hours: d.hours, avg: d.shifts ? d.hours / d.shifts : 0, shops: d.shops.size,
    })).sort((a, b) => b.hours - a.hours);
  }, [shifts, workers]);

  const totalShiftHours = shiftsReport.reduce((s, w) => s + w.hours, 0);
  const avgShiftLen = shifts.length ? totalShiftHours / shifts.length : 0;

  // ─── Costs report ──────────────────────
  const costReport = useMemo(() => {
    return activeWorkers.map(w => {
      const ws = shifts.filter(s => s.workerId === w.id);
      const r = calculateWorkerCostWithOvertime(w, ws, overtimeRules, holidays);
      const total = r.type === 'salaried' ? (w.monthlySalary || 0) : (r.totalCost || 0);
      return {
        id: w.id, name: `${w.firstName} ${w.lastName}`, role: roleOf(w), type: r.type,
        shifts: ws.length, hours: r.hours || 0,
        base: r.baseCost || 0, overtime: r.overtimeCost || 0, total,
      };
    }).filter(x => x.shifts > 0 || x.total > 0).sort((a, b) => b.total - a.total);
  }, [activeWorkers, shifts, overtimeRules, holidays]);

  const totalLabor = costReport.reduce((s, w) => s + w.total, 0);
  const totalCostHours = costReport.reduce((s, w) => s + w.hours, 0);
  const totalOT = costReport.reduce((s, w) => s + w.overtime, 0);
  const blendedRate = totalCostHours ? totalLabor / totalCostHours : 0;

  // ─── Attendance report ─────────────────
  const attendanceReport = useMemo(() => {
    const byWorker = {};
    attendance.forEach(a => {
      const name = workerName(a.workerId);
      if (!byWorker[name]) byWorker[name] = { hours: 0, days: 0, pending: 0, approved: 0, rejected: 0, rate: 0 };
      byWorker[name].hours += a.totalHours || 0;
      byWorker[name].days++;
      byWorker[name][a.approvalStatus || 'pending']++;
      const w = workers.find(x => x.id === a.workerId);
      if (w?.payType === 'hourly') byWorker[name].rate = w.costPerHour || 0;
    });
    return Object.entries(byWorker).sort((a, b) => b[1].hours - a[1].hours);
  }, [attendance, workers]);
  const totalAttHours = attendance.reduce((s, a) => s + (a.totalHours || 0), 0);

  // ─── Stock report ──────────────────────
  const stockReport = useMemo(() => {
    const low = stockItems.filter(i => i.minimumQuantity > 0 && i.quantity > 0 && i.quantity < i.minimumQuantity);
    const out = stockItems.filter(i => i.minimumQuantity > 0 && i.quantity === 0);
    const usage = stockLogs.filter(l => l.type === 'recipe_used' || l.type === 'remove');
    const byItem = {};
    usage.forEach(l => { byItem[l.itemName] = (byItem[l.itemName] || 0) + Math.abs(l.change || 0); });
    return { low, out, topConsumed: Object.entries(byItem).sort((a, b) => b[1] - a[1]).slice(0, 10), total: stockItems.length };
  }, [stockItems, stockLogs]);

  // ─── Export ────────────────────────────
  const download = (rows, name) => {
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${name}-${period}.csv`; a.click();
    toast.success('Report exported');
  };
  const exportReportCSV = () => {
    if (tab === 'schedule') {
      const rows = [['Date', 'Day', 'Shifts', 'Workers', 'Hours']];
      scheduleReport.days.forEach(d => rows.push([d.date, d.dayName, d.shifts, d.workers, d.hours.toFixed(1)]));
      download(rows, 'schedule-report');
    } else if (tab === 'shifts') {
      const rows = [['Worker', 'Role', 'Shifts', 'Hours', 'Avg length', 'Shops']];
      shiftsReport.forEach(w => rows.push([w.name, w.role, w.shifts, w.hours.toFixed(1), w.avg.toFixed(1), w.shops]));
      download(rows, 'shifts-report');
    } else if (tab === 'costs') {
      const rows = [['Worker', 'Role', 'Type', 'Hours', 'Base', 'Overtime', 'Total']];
      costReport.forEach(w => rows.push([w.name, w.role, w.type, w.hours.toFixed(1), w.base.toFixed(2), w.overtime.toFixed(2), w.total.toFixed(2)]));
      rows.push(['TOTAL', '', '', totalCostHours.toFixed(1), '', totalOT.toFixed(2), totalLabor.toFixed(2)]);
      download(rows, 'costs-report');
    } else if (tab === 'attendance') {
      const rows = [['Worker', 'Days', 'Hours', 'Approved', 'Pending', 'Rejected', 'Rate', 'Est. cost']];
      attendanceReport.forEach(([name, d]) => rows.push([name, d.days, d.hours.toFixed(1), d.approved, d.pending, d.rejected, d.rate || '—', d.rate ? (d.hours * d.rate).toFixed(2) : '—']));
      download(rows, 'attendance-report');
    } else if (tab === 'stock') {
      const rows = [['Item', 'Quantity', 'Unit', 'Minimum', 'Status']];
      stockItems.forEach(i => {
        const status = i.minimumQuantity > 0 && i.quantity === 0 ? 'OUT' : i.minimumQuantity > 0 && i.quantity < i.minimumQuantity ? 'LOW' : 'OK';
        rows.push([i.name, i.quantity, i.unit, i.minimumQuantity || '', status]);
      });
      download(rows, 'stock-report');
    }
  };

  if (!isManager) return <Layout><div className="p-6 text-surface-500">Reports are only available to managers.</div></Layout>;
  if (!premium) return <Layout><PremiumUpsell /></Layout>;

  const Stat = ({ icon: Icon, label, value, accent }) => (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs text-surface-500 font-medium"><Icon className="w-3.5 h-3.5" /> {label}</div>
      <p className={cn('text-2xl font-bold mt-1', accent || 'text-surface-900')}>{value}</p>
    </div>
  );

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-brand-500" /> Reports
              <span className="badge bg-purple-100 text-purple-700 !text-[10px] inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> Pro</span>
            </h1>
            <p className="text-surface-500 mt-1">Detailed schedule, shift and cost analytics for your team.</p>
          </div>
          <div className="flex items-center gap-3">
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="input-field max-w-[180px]" />
            <button onClick={exportReportCSV} className="btn-secondary !py-2 !px-3">
              <FileSpreadsheet className="w-4 h-4" /> <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-surface-200 overflow-x-auto scrollbar-none">
          {[
            { id: 'schedule', label: 'Schedule', icon: CalendarDays },
            { id: 'shifts', label: 'Shifts', icon: Clock },
            { id: 'costs', label: 'Costs', icon: Euro },
            { id: 'attendance', label: 'Attendance', icon: Users },
            { id: 'stock', label: 'Stock', icon: Package },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap',
              tab === t.id ? 'border-brand-500 text-brand-600' : 'border-transparent text-surface-500 hover:text-surface-700'
            )}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="card p-12 text-center text-surface-400">Loading reports…</div>
        ) : (
          <>
            {/* ─── SCHEDULE ─── */}
            {tab === 'schedule' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Stat icon={Clock} label="Scheduled hours" value={`${scheduleReport.totalHours.toFixed(0)}h`} />
                  <Stat icon={Calendar} label="Shifts" value={shifts.length} />
                  <Stat icon={Users} label="Avg workers/day" value={scheduleReport.avgWorkers.toFixed(1)} />
                  <Stat icon={TrendingDown} label="Busiest day" value={scheduleReport.busiest ? `${scheduleReport.busiest.dayName} · ${scheduleReport.busiest.shifts}` : '—'} />
                </div>

                <div className="card overflow-hidden">
                  <div className="px-5 py-3 border-b border-surface-100"><h3 className="section-title text-sm">Daily coverage</h3></div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-surface-50 text-left">
                        <th className="px-4 py-3 font-semibold text-surface-600">Date</th>
                        <th className="px-4 py-3 font-semibold text-surface-600">Day</th>
                        <th className="px-4 py-3 font-semibold text-surface-600 text-center">Shifts</th>
                        <th className="px-4 py-3 font-semibold text-surface-600 text-center">Workers</th>
                        <th className="px-4 py-3 font-semibold text-surface-600 text-center">Hours</th>
                        <th className="px-4 py-3 font-semibold text-surface-600 text-center">Coverage</th>
                      </tr></thead>
                      <tbody className="divide-y divide-surface-100">
                        {scheduleReport.days.map(d => (
                          <tr key={d.date} className="hover:bg-surface-50/50">
                            <td className="px-4 py-3 font-medium text-surface-800">{d.date}</td>
                            <td className="px-4 py-3 text-surface-600">{d.dayName}</td>
                            <td className="px-4 py-3 text-center">{d.shifts}</td>
                            <td className="px-4 py-3 text-center">{d.workers}</td>
                            <td className="px-4 py-3 text-center text-surface-600">{d.hours.toFixed(1)}</td>
                            <td className="px-4 py-3">
                              <div className="w-full max-w-[100px] mx-auto h-2 bg-surface-200 rounded-full">
                                <div className={cn('h-full rounded-full', d.workers >= activeWorkers.length ? 'bg-emerald-500' : d.workers >= activeWorkers.length * 0.5 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${Math.min(100, (d.workers / Math.max(activeWorkers.length, 1)) * 100)}%` }} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {scheduleReport.days.length === 0 && <p className="p-8 text-center text-surface-400">No shifts scheduled for this period.</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <BreakdownCard title="By shop" icon={Store} rows={scheduleReport.byShop} />
                  <BreakdownCard title="By role" icon={Users} rows={scheduleReport.byRole} />
                </div>
              </div>
            )}

            {/* ─── SHIFTS ─── */}
            {tab === 'shifts' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Stat icon={Calendar} label="Total shifts" value={shifts.length} />
                  <Stat icon={Clock} label="Scheduled hours" value={`${totalShiftHours.toFixed(0)}h`} />
                  <Stat icon={TrendingDown} label="Avg shift length" value={`${avgShiftLen.toFixed(1)}h`} />
                  <Stat icon={Users} label="Workers scheduled" value={shiftsReport.length} />
                </div>
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-surface-50 text-left">
                        <th className="px-4 py-3 font-semibold text-surface-600">Worker</th>
                        <th className="px-4 py-3 font-semibold text-surface-600 hidden sm:table-cell">Role</th>
                        <th className="px-4 py-3 font-semibold text-surface-600 text-center">Shifts</th>
                        <th className="px-4 py-3 font-semibold text-surface-600 text-center">Hours</th>
                        <th className="px-4 py-3 font-semibold text-surface-600 text-center">Avg</th>
                        <th className="px-4 py-3 font-semibold text-surface-600 text-center hidden sm:table-cell">Shops</th>
                      </tr></thead>
                      <tbody className="divide-y divide-surface-100">
                        {shiftsReport.map(w => (
                          <tr key={w.id} className="hover:bg-surface-50/50">
                            <td className="px-4 py-3 font-medium text-surface-800">{w.name}</td>
                            <td className="px-4 py-3 text-surface-500 hidden sm:table-cell">{w.role}</td>
                            <td className="px-4 py-3 text-center">{w.shifts}</td>
                            <td className="px-4 py-3 text-center font-semibold text-surface-800">{w.hours.toFixed(1)}</td>
                            <td className="px-4 py-3 text-center text-surface-600">{w.avg.toFixed(1)}h</td>
                            <td className="px-4 py-3 text-center text-surface-600 hidden sm:table-cell">{w.shops}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {shiftsReport.length === 0 && <p className="p-8 text-center text-surface-400">No shifts for this period.</p>}
                </div>
              </div>
            )}

            {/* ─── COSTS ─── */}
            {tab === 'costs' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Stat icon={Euro} label="Labour cost" value={formatCurrency(totalLabor)} />
                  <Stat icon={Clock} label="Total hours" value={`${totalCostHours.toFixed(0)}h`} />
                  <Stat icon={DollarSign} label="Blended rate" value={`${formatCurrency(blendedRate)}/h`} />
                  <Stat icon={AlertTriangle} label="Overtime" value={formatCurrency(totalOT)} accent={totalOT > 0 ? 'text-amber-600' : 'text-surface-900'} />
                </div>
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-surface-50 text-left">
                        <th className="px-4 py-3 font-semibold text-surface-600">Worker</th>
                        <th className="px-4 py-3 font-semibold text-surface-600 hidden sm:table-cell">Role</th>
                        <th className="px-4 py-3 font-semibold text-surface-600 text-center">Hours</th>
                        <th className="px-4 py-3 font-semibold text-surface-600 text-right hidden sm:table-cell">Base</th>
                        <th className="px-4 py-3 font-semibold text-surface-600 text-right">Overtime</th>
                        <th className="px-4 py-3 font-semibold text-surface-600 text-right">Total</th>
                      </tr></thead>
                      <tbody className="divide-y divide-surface-100">
                        {costReport.map(w => (
                          <tr key={w.id} className="hover:bg-surface-50/50">
                            <td className="px-4 py-3 font-medium text-surface-800">{w.name}{w.type === 'salaried' && <span className="ml-2 badge bg-surface-100 text-surface-500 !text-[10px]">Salaried</span>}</td>
                            <td className="px-4 py-3 text-surface-500 hidden sm:table-cell">{w.role}</td>
                            <td className="px-4 py-3 text-center text-surface-600">{w.hours.toFixed(1)}</td>
                            <td className="px-4 py-3 text-right text-surface-600 hidden sm:table-cell">{formatCurrency(w.base)}</td>
                            <td className="px-4 py-3 text-right">{w.overtime > 0 ? <span className="text-amber-600">{formatCurrency(w.overtime)}</span> : '—'}</td>
                            <td className="px-4 py-3 text-right font-semibold text-surface-900">{formatCurrency(w.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr className="bg-surface-50 font-semibold">
                        <td className="px-4 py-3" colSpan={2}>Total</td>
                        <td className="px-4 py-3 text-center">{totalCostHours.toFixed(1)}</td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell"></td>
                        <td className="px-4 py-3 text-right text-amber-600">{formatCurrency(totalOT)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(totalLabor)}</td>
                      </tr></tfoot>
                    </table>
                  </div>
                  {costReport.length === 0 && <p className="p-8 text-center text-surface-400">No labour cost for this period.</p>}
                </div>
                <p className="text-xs text-surface-400">Costs are estimated from scheduled shifts, pay rates and your overtime rules. Salaried staff show their fixed monthly cost.</p>
              </div>
            )}

            {/* ─── ATTENDANCE ─── */}
            {tab === 'attendance' && (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-surface-50 text-left">
                      <th className="px-4 py-3 font-semibold text-surface-600">Worker</th>
                      <th className="px-4 py-3 font-semibold text-surface-600 text-center">Days</th>
                      <th className="px-4 py-3 font-semibold text-surface-600 text-center">Hours</th>
                      <th className="px-4 py-3 font-semibold text-surface-600 text-center hidden sm:table-cell">Approved</th>
                      <th className="px-4 py-3 font-semibold text-surface-600 text-center hidden sm:table-cell">Pending</th>
                      <th className="px-4 py-3 font-semibold text-surface-600 text-right">Cost</th>
                    </tr></thead>
                    <tbody className="divide-y divide-surface-100">
                      {attendanceReport.map(([name, d]) => (
                        <tr key={name} className="hover:bg-surface-50/50">
                          <td className="px-4 py-3 font-medium text-surface-800">{name}</td>
                          <td className="px-4 py-3 text-center text-surface-600">{d.days}</td>
                          <td className="px-4 py-3 text-center font-semibold text-surface-800">{d.hours.toFixed(1)}</td>
                          <td className="px-4 py-3 text-center hidden sm:table-cell"><span className="text-emerald-600">{d.approved}</span></td>
                          <td className="px-4 py-3 text-center hidden sm:table-cell">{d.pending > 0 ? <span className="text-amber-600">{d.pending}</span> : '—'}</td>
                          <td className="px-4 py-3 text-right text-surface-600">{d.rate ? formatCurrency(d.hours * d.rate) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="bg-surface-50 font-semibold">
                      <td className="px-4 py-3">Total</td>
                      <td className="px-4 py-3 text-center">{attendance.length}</td>
                      <td className="px-4 py-3 text-center">{totalAttHours.toFixed(1)}</td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">{attendance.filter(a => a.approvalStatus === 'approved').length}</td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">{attendance.filter(a => a.approvalStatus === 'pending').length}</td>
                      <td className="px-4 py-3 text-right"></td>
                    </tr></tfoot>
                  </table>
                </div>
                {attendanceReport.length === 0 && <p className="p-8 text-center text-surface-400">No attendance data for this period.</p>}
              </div>
            )}

            {/* ─── STOCK ─── */}
            {tab === 'stock' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Stat icon={Package} label="Total items" value={stockReport.total} />
                  <Stat icon={AlertTriangle} label="Low stock" value={stockReport.low.length} accent="text-amber-600" />
                  <Stat icon={AlertTriangle} label="Out of stock" value={stockReport.out.length} accent="text-red-600" />
                  <Stat icon={TrendingDown} label="Usage events" value={stockLogs.filter(l => l.type === 'recipe_used' || l.type === 'remove').length} />
                </div>
                {stockReport.topConsumed.length > 0 && (
                  <div className="card">
                    <div className="px-5 py-3 border-b border-surface-100"><h3 className="section-title text-sm flex items-center gap-2"><TrendingDown className="w-4 h-4 text-red-500" /> Top consumed items</h3></div>
                    <div className="divide-y divide-surface-100">
                      {stockReport.topConsumed.map(([name, qty], idx) => (
                        <div key={name} className="px-5 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3"><span className="text-xs font-bold text-surface-400 w-5">{idx + 1}</span><span className="text-sm font-medium text-surface-800">{name}</span></div>
                          <span className="text-sm font-semibold text-red-600">−{qty}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(stockReport.out.length > 0 || stockReport.low.length > 0) && (
                  <div className="card">
                    <div className="px-5 py-3 border-b border-surface-100"><h3 className="section-title text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Items needing attention</h3></div>
                    <div className="divide-y divide-surface-100">
                      {[...stockReport.out, ...stockReport.low].map(i => (
                        <div key={i.id} className="px-5 py-3 flex items-center justify-between">
                          <div><p className="text-sm font-medium text-surface-800">{i.name}</p><p className="text-xs text-surface-500">{i.quantity} / min {i.minimumQuantity} {i.unit}</p></div>
                          <span className={cn('badge text-[10px]', i.quantity === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>{i.quantity === 0 ? 'OUT' : 'LOW'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

function BreakdownCard({ title, icon: Icon, rows }) {
  const max = Math.max(1, ...rows.map(([, d]) => d.hours));
  return (
    <div className="card">
      <div className="px-5 py-3 border-b border-surface-100"><h3 className="section-title text-sm flex items-center gap-2"><Icon className="w-4 h-4 text-brand-500" /> {title}</h3></div>
      <div className="divide-y divide-surface-100">
        {rows.length === 0 && <p className="px-5 py-4 text-sm text-surface-400">No data.</p>}
        {rows.map(([name, d]) => (
          <div key={name} className="px-5 py-2.5">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-surface-800 truncate">{name}</span>
              <span className="text-surface-500 flex-shrink-0">{d.shifts} · {d.hours.toFixed(0)}h</span>
            </div>
            <div className="h-1.5 bg-surface-100 rounded-full"><div className="h-full rounded-full bg-brand-400" style={{ width: `${(d.hours / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
