'use client';
import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { getStaffAvailability, getWorkers, getAvailabilitySettings, saveAvailabilitySettings } from '@/lib/firestore';
import { cn } from '@/utils/helpers';
import {
  ChevronLeft, ChevronRight, Calendar, Users, Sun, Sunset, Moon, Clock,
  User, AlertCircle, Settings2, Save, Loader2, Eye, Check, X
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
    ]).then(([avail, workersList, s]) => {
      setAvailability(avail || []);
      setWorkers(workersList || []);
      const sett = s || { deadlineDays: 7, enabled: true };
      setSettings(sett);
      setLocalSettings(sett);
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
            {/* Shift legend */}
            <div className="flex flex-wrap gap-3">
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

                  return (
                    <div
                      key={d}
                      onClick={() => { if (count > 0) setSelectedDate(dateStr); }}
                      className={cn(
                        'h-20 sm:h-28 p-1 sm:p-1.5 border-b border-r border-surface-100 transition-colors overflow-hidden',
                        isToday && 'bg-brand-50/60',
                        isPast && 'bg-surface-50/30',
                        inDeadline && !isToday && 'bg-red-50/40',
                        count > 0 && 'cursor-pointer hover:bg-brand-50',
                      )}
                    >
                      {/* Day number + badge */}
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          'text-[10px] sm:text-xs font-medium leading-none',
                          isToday ? 'text-brand-600 font-bold' : isPast ? 'text-surface-400' : 'text-surface-700',
                        )}>{d}</span>
                        {count > 0 && (
                          <span className="text-[9px] sm:text-[10px] font-semibold bg-brand-100 text-brand-700 rounded-full px-1.5 leading-4">
                            {count}
                          </span>
                        )}
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

            {/* Staff table */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-50 border-b border-surface-100">
                      <th className="text-left px-4 py-3 font-medium text-surface-600">Staff Member</th>
                      <th className="text-center px-3 py-3 font-medium text-surface-600">Total</th>
                      <th className="text-center px-3 py-3 font-medium text-amber-600">
                        <Sun className="w-3.5 h-3.5 mx-auto" />
                      </th>
                      <th className="text-center px-3 py-3 font-medium text-orange-600">
                        <Sunset className="w-3.5 h-3.5 mx-auto" />
                      </th>
                      <th className="text-center px-3 py-3 font-medium text-indigo-600">
                        <Moon className="w-3.5 h-3.5 mx-auto" />
                      </th>
                      <th className="text-center px-3 py-3 font-medium text-emerald-600">
                        <Clock className="w-3.5 h-3.5 mx-auto" />
                      </th>
                      <th className="text-center px-3 py-3 font-medium text-surface-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workerStats.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-surface-400">No active staff found</td></tr>
                    )}
                    {workerStats.map(stat => (
                      <tr key={stat.id} className="border-b border-surface-50 hover:bg-surface-50">
                        <td className="px-4 py-3 font-medium text-surface-800">{stat.name}</td>
                        <td className="px-3 py-3 text-center font-semibold text-brand-600">{stat.total}</td>
                        <td className="px-3 py-3 text-center text-amber-700">{stat.morning || '-'}</td>
                        <td className="px-3 py-3 text-center text-orange-700">{stat.afternoon || '-'}</td>
                        <td className="px-3 py-3 text-center text-indigo-700">{stat.evening || '-'}</td>
                        <td className="px-3 py-3 text-center text-emerald-700">{stat.full || '-'}</td>
                        <td className="px-3 py-3 text-center">
                          {stat.total > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">
                              <Check className="w-3 h-3" /> Done
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-red-100 text-red-600 rounded-full px-2 py-0.5">
                              <X className="w-3 h-3" /> Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
        open={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        title={`Availability — ${selectedDate}`}
      >
        {selectedDate && (() => {
          const entries = availForDate(selectedDate);
          const inDeadline = selectedDate >= todayStr && selectedDate < deadlineDate;

          return (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl">
                <Users className="w-5 h-5 text-brand-600" />
                <div>
                  <p className="text-sm font-semibold text-surface-800">
                    {entries.length} staff {entries.length === 1 ? 'member' : 'members'} available
                  </p>
                  {inDeadline && (
                    <p className="text-xs text-red-600 mt-0.5">
                      This date is within the {settings.deadlineDays}-day deadline window
                    </p>
                  )}
                </div>
              </div>

              {/* Staff list */}
              <div className="divide-y divide-surface-100">
                {entries.map(entry => {
                  const info = getShiftInfo(entry.shiftType);
                  return (
                    <div key={entry.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">
                          {(entry.workerName || 'S')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-surface-800">
                            {entry.workerName || 'Staff'}
                          </p>
                          <p className="text-xs text-surface-400">
                            Submitted {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '—'}
                          </p>
                        </div>
                      </div>
                      <div className={cn('flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg', info.color)}>
                        <info.icon className="w-3.5 h-3.5" />
                        {info.label}
                      </div>
                    </div>
                  );
                })}
              </div>

              {entries.length === 0 && (
                <p className="text-center text-surface-400 py-4">No availability submitted for this date.</p>
              )}

              <div className="flex justify-end pt-2">
                <button onClick={() => setSelectedDate(null)} className="btn-secondary">Close</button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </Layout>
  );
}
