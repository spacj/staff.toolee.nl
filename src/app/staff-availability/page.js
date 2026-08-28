'use client';
import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import ScheduleTabs from '@/components/ScheduleTabs';
import { useAuth } from '@/contexts/AuthContext';
import { getStaffAvailability, getWorkers, getAvailabilitySettings, saveAvailabilitySettings, getShops, createShift, getShifts, getOpenShifts } from '@/lib/firestore';
import { cn } from '@/utils/helpers';
import {
  ChevronLeft, ChevronRight, Calendar, Users, Sun, Sunset, Moon, Clock,
  User, AlertCircle, Settings2, Save, Loader2, Eye, Check, X, Plus, Briefcase
} from 'lucide-react';
import toast from 'react-hot-toast';

const SHIFT_TYPES = [
  { id: 'morning', label: 'Morning', icon: Sun, color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  { id: 'afternoon', label: 'Afternoon', icon: Sunset, color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  { id: 'evening', label: 'Evening', icon: Moon, color: 'bg-indigo-100 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  { id: 'full', label: 'Full Day', icon: Clock, color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
];

const getShiftInfo = (id) => SHIFT_TYPES.find(s => s.id === id) || SHIFT_TYPES[3];

export default function StaffAvailabilityPage() {
  const { orgId, isManager, isAdmin } = useAuth();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [availability, setAvailability] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [settings, setSettings] = useState({ deadlineDays: 7, enabled: true });
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState('calendar');       // calendar | staff | settings
  const [selectedWorker, setSelectedWorker] = useState('all');
  const [selectedDate, setSelectedDate] = useState(null);      // for day-detail modal
  const [savingSettings, setSavingSettings] = useState(false);
  const [localSettings, setLocalSettings] = useState({ deadlineDays: 7, enabled: true });

  // Shift creation
  const [shops, setShops] = useState([]);
  const [existingShifts, setExistingShifts] = useState([]);   // assigned shifts (to compare/check duplicates)
  const [openShifts, setOpenShifts] = useState([]);           // unassigned open shifts to fill
  const [creatingShiftFor, setCreatingShiftFor] = useState(null); // availability entry being scheduled
  const [shiftForm, setShiftForm] = useState({ startTime: '09:00', endTime: '17:00', shopId: '', notes: '' });
  const [savingShift, setSavingShift] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const loadRange = { start: `${monthStr}-01`, end: `${monthStr}-31` };
  const todayStr = new Date().toISOString().split('T')[0];

  // ─── Load data ──────────────────────────────────────
  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    Promise.all([
      getStaffAvailability({ orgId, startDate: loadRange.start, endDate: loadRange.end }).catch(() => []),
      getWorkers({ orgId, status: 'active' }).catch(() => []),
      getAvailabilitySettings(orgId).catch(() => ({ deadlineDays: 7, enabled: true })),
      getShops(orgId).catch(() => []),
      getShifts({ orgId, startDate: loadRange.start, endDate: loadRange.end }).catch(() => []),
      getOpenShifts({ orgId, status: 'open' }).catch(() => []),
    ]).then(([avail, workersList, s, shopsList, shifts, openList]) => {
      setAvailability(avail || []);
      setWorkers(workersList || []);
      const sett = s || { deadlineDays: 7, enabled: true };
      setSettings(sett);
      setLocalSettings(sett);
      setShops(shopsList || []);
      setExistingShifts(shifts || []);
      setOpenShifts((openList || []).filter(o => o.date >= loadRange.start && o.date <= loadRange.end));
    }).finally(() => setLoading(false));
  }, [orgId, loadRange.start, loadRange.end]);

  // ─── Helpers ────────────────────────────────────────
  const getDateStr = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const monthDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [year, month]);

  const filteredAvailability = selectedWorker === 'all'
    ? availability
    : availability.filter(a => a.workerId === selectedWorker);

  const assignedForDate = (ds) => existingShifts.filter(s =>
    s.date === ds && (selectedWorker === 'all' || s.workerId === selectedWorker));
  const openForDate = (ds) => openShifts.filter(o => o.date === ds);

  const availForDate = (ds) => filteredAvailability.filter(a => a.date === ds);

  const nav = (dir) => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const deadlineDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + (settings.deadlineDays || 7));
    return d.toISOString().split('T')[0];
  }, [settings.deadlineDays]);

  // ─── Worker stats for staff view ────────────────────
  const workerStats = useMemo(() => {
    return workers.map(w => {
      const entries = availability.filter(a => a.workerId === w.id);
      return {
        id: w.id,
        name: `${w.firstName} ${w.lastName}`,
        total: entries.length,
        morning: entries.filter(e => e.shiftType === 'morning').length,
        afternoon: entries.filter(e => e.shiftType === 'afternoon').length,
        evening: entries.filter(e => e.shiftType === 'evening').length,
        full: entries.filter(e => e.shiftType === 'full').length,
      };
    });
  }, [workers, availability]);

  // Availability heatmap lookup: `${workerId}|${date}` → shiftType
  const availMap = useMemo(() => {
    const m = {};
    availability.forEach(a => { m[`${a.workerId}|${a.date}`] = a.shiftType; });
    return m;
  }, [availability]);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // ─── Save deadline settings ─────────────────────────
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await saveAvailabilitySettings(orgId, localSettings);
      setSettings(localSettings);
      toast.success('Availability settings saved');
    } catch (err) {
      toast.error('Failed to save settings');
    }
    setSavingSettings(false);
  };

  // ─── Create shift from availability ──────────────────
  const openShiftForm = (entry) => {
    const defaults = {
      morning:   { startTime: '06:00', endTime: '14:00' },
      afternoon: { startTime: '14:00', endTime: '22:00' },
      evening:   { startTime: '22:00', endTime: '06:00' },
      full:      { startTime: '09:00', endTime: '17:00' },
    };
    const times = defaults[entry.shiftType] || defaults.full;
    setShiftForm({ startTime: times.startTime, endTime: times.endTime, shopId: '', notes: '' });
    setCreatingShiftFor(entry);
  };

  const handleCreateShift = async () => {
    if (!creatingShiftFor) return;
    
    // Check if worker already has a shift on this date
    const alreadyScheduled = existingShifts.some(s => 
      s.workerId === creatingShiftFor.workerId && s.date === creatingShiftFor.date
    );
    if (alreadyScheduled) {
      toast.error('This worker already has a shift scheduled on this date');
      return;
    }
    
    setSavingShift(true);
    try {
      const [sh, sm] = shiftForm.startTime.split(':').map(Number);
      const [eh, em] = shiftForm.endTime.split(':').map(Number);
      let hours = (eh + em / 60) - (sh + sm / 60);
      if (hours <= 0) hours += 24;

      await createShift({
        orgId,
        workerId: creatingShiftFor.workerId,
        workerName: creatingShiftFor.workerName || 'Staff',
        date: creatingShiftFor.date,
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        hours: Math.round(hours * 10) / 10,
        shopId: shiftForm.shopId || '',
        shopName: shops.find(s => s.id === shiftForm.shopId)?.name || '',
        templateName: shiftForm.notes || '',
        notes: shiftForm.notes || '',
        type: 'from-availability',
      });
      toast.success(`Shift created for ${creatingShiftFor.workerName || 'Staff'}`);
      // Reflect the new assignment immediately in the comparison view
      setExistingShifts(prev => [...prev, {
        id: `tmp-${Date.now()}`,
        workerId: creatingShiftFor.workerId,
        workerName: creatingShiftFor.workerName || 'Staff',
        date: creatingShiftFor.date,
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        shopId: shiftForm.shopId || '',
        shopName: shops.find(s => s.id === shiftForm.shopId)?.name || '',
      }]);
      setCreatingShiftFor(null);
    } catch (err) {
      toast.error('Failed to create shift: ' + err.message);
    }
    setSavingShift(false);
  };

  // ─── Auth guard ─────────────────────────────────────
  if (!isManager) {
    return (
      <Layout>
        <div className="card p-8 text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-surface-800">Staff Availability</h2>
          <p className="text-surface-500 mt-2">This page is for managers and admins only.</p>
        </div>
      </Layout>
    );
  }

  // ─── Render ─────────────────────────────────────────
  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">

        {/* ── Header ────────────────────────────────── */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Staff Availability</h1>
            <p className="text-surface-500 text-sm mt-1">
              {loading ? 'Loading...'
                : `${workers.length} staff · ${filteredAvailability.length} entries this month`}
              {settings.enabled ? ` · ${settings.deadlineDays}-day advance notice` : ' · Tracking disabled'}
            </p>
          </div>
        </div>

        <ScheduleTabs />

        {/* ── Disabled warning ──────────────────────── */}
        {!settings.enabled && (
          <div className="card p-4 bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">Availability tracking is disabled. Enable it in the Settings tab below.</p>
            </div>
          </div>
        )}

        {/* ── View switcher + controls ──────────────── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
            {[
              { id: 'calendar', icon: Calendar, label: 'Calendar' },
              { id: 'staff', icon: Users, label: 'Staff' },
              { id: 'settings', icon: Settings2, label: 'Settings' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id)}
                className={cn(
                  'flex items-center justify-center gap-1.5 flex-1 sm:flex-none px-3 py-1.5 text-sm font-medium rounded-lg transition-all',
                  viewMode === tab.id ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700'
                )}
              >
                <tab.icon className="w-3.5 h-3.5" /> {tab.label}
              </button>
            ))}
          </div>

          {/* Month nav + filter (calendar & staff views) */}
          {viewMode !== 'settings' && (
            <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
              {viewMode === 'calendar' && (
                <select
                  value={selectedWorker}
                  onChange={(e) => setSelectedWorker(e.target.value)}
                  className="select-field !py-1.5 !text-xs !w-auto"
                >
                  <option value="all">All Staff</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.firstName} {w.lastName}</option>
                  ))}
                </select>
              )}
              <button onClick={() => nav(-1)} className="btn-icon !w-8 !h-8"><ChevronLeft className="w-5 h-5" /></button>
              <h2 className="text-sm sm:text-base font-display font-semibold text-surface-900 min-w-[140px] text-center">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
              <button onClick={() => nav(1)} className="btn-icon !w-8 !h-8"><ChevronRight className="w-5 h-5" /></button>
            </div>
          )}
        </div>

        {/* ── Loading ───────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-brand-600 mr-2" />
            <span className="text-surface-500">Loading availability data...</span>
          </div>
        )}

        {/* ════════════════════════════════════════════
            CALENDAR VIEW
        ════════════════════════════════════════════ */}
        {!loading && viewMode === 'calendar' && (
          <>
            {/* Compare legend — available vs assigned vs open, then shift types */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-surface-400">Compare</span>
              <div className="flex items-center gap-1.5 text-xs text-surface-600"><span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded px-1">3</span> Available</div>
              <div className="flex items-center gap-1.5 text-xs text-surface-600"><span className="text-[10px] font-bold bg-blue-100 text-blue-700 rounded px-1">2</span> Assigned</div>
              <div className="flex items-center gap-1.5 text-xs text-surface-600"><span className="text-[10px] font-bold bg-amber-100 text-amber-700 rounded px-1">1</span> Open shifts</div>
              <span className="text-surface-200">·</span>
              {SHIFT_TYPES.map(t => (
                <div key={t.id} className="flex items-center gap-1.5 text-xs text-surface-600">
                  <span className={cn('w-2.5 h-2.5 rounded-full', t.dot)} />
                  {t.label}
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-xs text-surface-400 ml-auto">
                <span className="w-2.5 h-2.5 rounded-full bg-red-300" /> Deadline zone
              </div>
            </div>

            {/* Calendar grid */}
            <div className="card overflow-hidden">
              <div className="grid grid-cols-7 text-center text-[10px] sm:text-xs font-medium text-surface-500 border-b border-surface-100">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                  <div key={d} className="py-1.5 sm:py-2">
                    <span className="hidden sm:inline">{d}</span>
                    <span className="sm:hidden">{d[0]}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {monthDays.map((d, i) => {
                  if (!d) return <div key={`e${i}`} className="h-20 sm:h-28 bg-surface-50/50 border-b border-r border-surface-100" />;

                  const dateStr = getDateStr(year, month, d);
                  const dayEntries = availForDate(dateStr);
                  const isToday = dateStr === todayStr;
                  const isPast = dateStr < todayStr;
                  const inDeadline = dateStr >= todayStr && dateStr < deadlineDate;
                  const count = dayEntries.length;
                  const assignedCount = assignedForDate(dateStr).length;
                  const openCount = openForDate(dateStr).length;
                  const hasAny = count > 0 || assignedCount > 0 || openCount > 0;

                  return (
                    <div
                      key={d}
                      onClick={() => { if (hasAny) setSelectedDate(dateStr); }}
                      className={cn(
                        'h-20 sm:h-28 p-1 sm:p-1.5 border-b border-r border-surface-100 transition-colors overflow-hidden',
                        isToday && 'bg-brand-50/60',
                        isPast && 'bg-surface-50/30',
                        inDeadline && !isToday && 'bg-red-50/40',
                        hasAny && 'cursor-pointer hover:bg-brand-50',
                      )}
                    >
                      {/* Day number + compare indicators (available / assigned / open) */}
                      <div className="flex items-center justify-between gap-1">
                        <span className={cn(
                          'text-[10px] sm:text-xs font-medium leading-none',
                          isToday ? 'text-brand-600 font-bold' : isPast ? 'text-surface-400' : 'text-surface-700',
                        )}>{d}</span>
                        <div className="flex items-center gap-0.5">
                          {count > 0 && <span title={`${count} available`} className="text-[8px] sm:text-[9px] font-bold bg-emerald-100 text-emerald-700 rounded px-1 leading-4">{count}</span>}
                          {assignedCount > 0 && <span title={`${assignedCount} assigned`} className="text-[8px] sm:text-[9px] font-bold bg-blue-100 text-blue-700 rounded px-1 leading-4">{assignedCount}</span>}
                          {openCount > 0 && <span title={`${openCount} open shift(s)`} className="text-[8px] sm:text-[9px] font-bold bg-amber-100 text-amber-700 rounded px-1 leading-4">{openCount}</span>}
                        </div>
                      </div>

                      {/* Shift dots / names */}
                      <div className="mt-1 space-y-0.5">
                        {dayEntries.slice(0, 3).map(a => {
                          const info = getShiftInfo(a.shiftType);
                          return (
                            <div key={a.id} className={cn(
                              'text-[7px] sm:text-[9px] leading-tight px-1 py-0.5 rounded truncate flex items-center gap-1',
                              info.color
                            )}>
                              <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', info.dot)} />
                              <span className="truncate">{a.workerName?.split(' ')[0] || 'Staff'}</span>
                            </div>
                          );
                        })}
                        {count > 3 && (
                          <div className="text-[8px] text-surface-400 text-center">+{count - 3} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════
            STAFF VIEW
        ════════════════════════════════════════════ */}
        {!loading && viewMode === 'staff' && (
          <div className="space-y-4">
            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="card p-4 text-center">
                <p className="text-2xl font-bold text-brand-600">{workers.length}</p>
                <p className="text-xs text-surface-500 mt-1">Total Staff</p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">
                  {workerStats.filter(s => s.total > 0).length}
                </p>
                <p className="text-xs text-surface-500 mt-1">Submitted</p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-2xl font-bold text-red-500">
                  {workerStats.filter(s => s.total === 0).length}
                </p>
                <p className="text-xs text-surface-500 mt-1">Not Submitted</p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{availability.length}</p>
                <p className="text-xs text-surface-500 mt-1">Total Entries</p>
              </div>
            </div>

            {/* Availability heatmap — workers × days, coloured by shift */}
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
                <h3 className="text-sm font-display font-semibold text-surface-800">Availability heatmap</h3>
                <span className="text-[11px] text-surface-400">{currentDate.toLocaleString('default', { month: 'long' })} · tap a day in Calendar to assign</span>
              </div>
              {workers.length === 0 ? (
                <p className="px-4 py-8 text-center text-surface-400 text-sm">No active staff found</p>
              ) : (
                <div className="overflow-x-auto scrollbar-none">
                  <div className="min-w-max">
                    {/* Day header */}
                    <div className="flex border-b border-surface-100">
                      <div className="w-28 sm:w-36 flex-shrink-0 px-3 py-2 text-[10px] font-semibold text-surface-400 sticky left-0 bg-white z-10">Staff</div>
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                        const ds = getDateStr(year, month, d);
                        const isToday = ds === todayStr;
                        return <div key={d} className={cn('w-6 py-2 text-center text-[9px] font-medium', isToday ? 'text-brand-600 font-bold' : 'text-surface-400')}>{d}</div>;
                      })}
                    </div>
                    {/* Worker rows */}
                    {workers.map(w => (
                      <div key={w.id} className="flex items-center border-b border-surface-50 last:border-0 hover:bg-surface-50/50">
                        <div className="w-28 sm:w-36 flex-shrink-0 px-3 py-1.5 text-xs font-medium text-surface-700 truncate sticky left-0 bg-white z-10">{w.firstName} {w.lastName}</div>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                          const ds = getDateStr(year, month, d);
                          const st = availMap[`${w.id}|${ds}`];
                          const info = st ? getShiftInfo(st) : null;
                          return (
                            <div key={d} className="w-6 flex items-center justify-center py-1.5">
                              <span
                                className={cn('w-4 h-4 rounded transition-colors', info ? info.dot : 'bg-surface-100')}
                                title={info ? `${ds} · ${info.label}` : ds}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Shift legend */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-surface-700 mb-3">Shift Type Legend</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SHIFT_TYPES.map(type => (
                  <div key={type.id} className={cn('flex items-center gap-2 p-2 rounded-lg', type.color)}>
                    <type.icon className="w-4 h-4" />
                    <span className="text-xs font-medium">{type.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════
            SETTINGS VIEW
        ════════════════════════════════════════════ */}
        {!loading && viewMode === 'settings' && (
          <div className="max-w-xl mx-auto space-y-4">
            <div className="card">
              <div className="px-6 py-5 border-b border-surface-100">
                <h2 className="text-lg font-display font-semibold text-surface-900">Availability Deadline Settings</h2>
                <p className="text-sm text-surface-500 mt-0.5">
                  Control how far in advance staff must submit their availability
                </p>
              </div>
              <div className="p-6 space-y-6">

                {/* Enable / disable toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-surface-700">Enable Availability Tracking</p>
                    <p className="text-xs text-surface-400 mt-0.5">
                      When disabled, staff cannot submit availability
                    </p>
                  </div>
                  <button
                    onClick={() => setLocalSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                    className={cn(
                      'relative w-11 h-6 rounded-full transition-colors',
                      localSettings.enabled ? 'bg-brand-600' : 'bg-surface-300'
                    )}
                  >
                    <span className={cn(
                      'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                      localSettings.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                    )} />
                  </button>
                </div>

                {/* Deadline days */}
                <div>
                  <label className="label">Minimum Days in Advance</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={localSettings.deadlineDays}
                      onChange={(e) => setLocalSettings(prev => ({
                        ...prev,
                        deadlineDays: Math.max(1, Math.min(60, parseInt(e.target.value) || 7))
                      }))}
                      disabled={!localSettings.enabled}
                      className="input-field !w-24"
                    />
                    <span className="text-sm text-surface-500">days before the shift date</span>
                  </div>
                  <p className="text-xs text-surface-400 mt-2">
                    Example: Setting {localSettings.deadlineDays} days means staff must submit availability
                    at least {localSettings.deadlineDays} days before the shift.
                    Dates within the {localSettings.deadlineDays}-day window will be locked.
                  </p>
                </div>

                {/* Preview */}
                <div className="p-4 bg-surface-50 rounded-xl space-y-2">
                  <p className="text-xs font-medium text-surface-600">Current Effect</p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div>
                      <span className="text-surface-400">Today:</span>{' '}
                      <span className="font-medium text-surface-800">{todayStr}</span>
                    </div>
                    <div>
                      <span className="text-surface-400">First available date:</span>{' '}
                      <span className="font-medium text-brand-600">{deadlineDate}</span>
                    </div>
                  </div>
                  <p className="text-xs text-surface-400">
                    Staff will only be able to select dates from{' '}
                    <span className="font-medium">{deadlineDate}</span> onwards.
                  </p>
                </div>

                {/* Save button */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {savingSettings ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════
          DAY DETAIL MODAL
      ═══════════════════════════════════════════════ */}
      <Modal
        open={!!selectedDate && !creatingShiftFor}
        onClose={() => setSelectedDate(null)}
        title={`Day overview — ${selectedDate}`}
        size="lg"
      >
        {selectedDate && !creatingShiftFor && (() => {
          const entries = availForDate(selectedDate);
          const assigned = assignedForDate(selectedDate);
          const open = openForDate(selectedDate);
          const inDeadline = selectedDate >= todayStr && selectedDate < deadlineDate;
          const shopNameById = (id) => shops.find(s => s.id === id)?.name || '';

          return (
            <div className="space-y-4">
              {/* Compare summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-2.5 text-center">
                  <p className="text-xl font-display font-bold text-emerald-700 leading-none">{entries.length}</p>
                  <p className="text-[10px] text-emerald-600 mt-1">Available</p>
                </div>
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-2.5 text-center">
                  <p className="text-xl font-display font-bold text-blue-700 leading-none">{assigned.length}</p>
                  <p className="text-[10px] text-blue-600 mt-1">Assigned</p>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-2.5 text-center">
                  <p className="text-xl font-display font-bold text-amber-700 leading-none">{open.length}</p>
                  <p className="text-[10px] text-amber-600 mt-1">Open shifts</p>
                </div>
              </div>
              {inDeadline && (
                <p className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Within the {settings.deadlineDays}-day deadline window</p>
              )}

              {/* Assigned shifts */}
              {assigned.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Assigned</p>
                  <div className="space-y-1.5">
                    {assigned.map(s => (
                      <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2">
                        <span className="text-sm text-surface-800 truncate">{s.workerName || 'Staff'}</span>
                        <span className="text-xs text-surface-500 tabular-nums flex-shrink-0">{s.startTime}–{s.endTime}{s.shopName ? ` · ${s.shopName}` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Open shifts to fill */}
              {open.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Open shifts to fill</p>
                  <div className="space-y-1.5">
                    {open.map(o => (
                      <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2">
                        <span className="text-sm text-surface-800 truncate">{o.templateName || 'Open shift'}{shopNameById(o.shopId) ? ` · ${shopNameById(o.shopId)}` : ''}</span>
                        <span className="text-xs text-amber-700 tabular-nums flex-shrink-0">{o.startTime}–{o.endTime} · {entries.length} avail.</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available staff — assign from here */}
              <div>
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Available staff</p>
                <div className="divide-y divide-surface-100">
                  {entries.map(entry => {
                    const info = getShiftInfo(entry.shiftType);
                    const hasExistingShift = assigned.some(s => s.workerId === entry.workerId);
                    return (
                      <div key={entry.id} className="flex items-center justify-between py-2.5 gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {(entry.workerName || 'S')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-surface-800 truncate">{entry.workerName || 'Staff'}</p>
                            <div className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded', info.color)}>
                              <info.icon className="w-3 h-3" />
                              {info.label}
                            </div>
                          </div>
                        </div>
                        {hasExistingShift ? (
                          <span className="text-xs text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded flex-shrink-0">Scheduled ✓</span>
                        ) : (
                          <button onClick={() => openShiftForm(entry)} className="btn-primary !py-1.5 !px-3 !text-xs flex items-center gap-1.5 flex-shrink-0">
                            <Plus className="w-3.5 h-3.5" /> Assign
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {entries.length === 0 && (
                    <p className="text-center text-surface-400 py-4 text-sm">No availability submitted for this date.</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-surface-100">
                <button onClick={() => setSelectedDate(null)} className="btn-secondary">Close</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ═══════════════════════════════════════════════
          CREATE SHIFT MODAL
      ═══════════════════════════════════════════════ */}
      <Modal
        open={!!creatingShiftFor}
        onClose={() => setCreatingShiftFor(null)}
        title="Create Shift from Availability"
      >
        {creatingShiftFor && (() => {
          const info = getShiftInfo(creatingShiftFor.shiftType);
          return (
            <div className="space-y-5">
              {/* Worker + date info */}
              <div className="p-4 bg-surface-50 rounded-xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold">
                    {(creatingShiftFor.workerName || 'S')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-surface-800">{creatingShiftFor.workerName || 'Staff'}</p>
                    <p className="text-xs text-surface-500">Date: {creatingShiftFor.date}</p>
                  </div>
                </div>
                <div className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg', info.color)}>
                  <info.icon className="w-3.5 h-3.5" />
                  Preferred: {info.label}
                </div>
              </div>

              {/* Time inputs */}
              <div>
                <label className="label">Shift Time</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-surface-400 mb-1 block">Start</label>
                    <input
                      type="time"
                      value={shiftForm.startTime}
                      onChange={(e) => setShiftForm(f => ({ ...f, startTime: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-surface-400 mb-1 block">End</label>
                    <input
                      type="time"
                      value={shiftForm.endTime}
                      onChange={(e) => setShiftForm(f => ({ ...f, endTime: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                </div>
                <p className="text-xs text-surface-400 mt-1.5">
                  {(() => {
                    const [sh, sm] = shiftForm.startTime.split(':').map(Number);
                    const [eh, em] = shiftForm.endTime.split(':').map(Number);
                    let h = (eh + em / 60) - (sh + sm / 60);
                    if (h <= 0) h += 24;
                    return `Duration: ${Math.round(h * 10) / 10} hours`;
                  })()}
                </p>
              </div>

              {/* Shop selector */}
              {shops.length > 0 && (
                <div>
                  <label className="label">Location / Shop</label>
                  <select
                    value={shiftForm.shopId}
                    onChange={(e) => setShiftForm(f => ({ ...f, shopId: e.target.value }))}
                    className="select-field"
                  >
                    <option value="">No specific location</option>
                    {shops.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="label">Notes (optional)</label>
                <input
                  type="text"
                  value={shiftForm.notes}
                  onChange={(e) => setShiftForm(f => ({ ...f, notes: e.target.value }))}
                  className="input-field"
                  placeholder="e.g. Opening shift, Cover for John..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-2">
                <button onClick={() => setCreatingShiftFor(null)} className="btn-secondary">
                  Back
                </button>
                <button
                  onClick={handleCreateShift}
                  disabled={savingShift}
                  className="btn-primary flex items-center gap-2"
                >
                  <Briefcase className="w-4 h-4" />
                  {savingShift ? 'Creating...' : 'Create Shift'}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </Layout>
  );
}
