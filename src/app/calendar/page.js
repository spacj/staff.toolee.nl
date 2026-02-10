'use client';
import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { getShifts, getWorkers, getShops, getShiftTemplates, getPermits, bulkCreateShifts, deleteShift, createShift } from '@/lib/firestore';
import { generateWeeklySchedule } from '@/lib/scheduling';
import { cn } from '@/utils/helpers';
import { ChevronLeft, ChevronRight, Plus, Wand2, Trash2, Calendar as CalIcon, Users, Clock, Grid3X3, List, LayoutGrid } from 'lucide-react';
import toast from 'react-hot-toast';

const VIEWS = { MONTH: 'month', WEEK: 'week', LIST: 'list' };

export default function CalendarPage() {
  const { orgId, isManager, userProfile } = useAuth();
  const [view, setView] = useState(VIEWS.MONTH);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [shops, setShops] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [permits, setPermits] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showAutoSchedule, setShowAutoSchedule] = useState(false);
  const [showAddShift, setShowAddShift] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shiftForm, setShiftForm] = useState({ workerId: '', shopId: '', date: '', startTime: '09:00', endTime: '17:00', templateName: '', notes: '' });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  // Date range for data loading
  const loadRange = useMemo(() => {
    if (view === VIEWS.WEEK) {
      const d = new Date(currentDate);
      const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(d.setDate(diff));
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
      return { start: weekStart.toISOString().split('T')[0], end: weekEnd.toISOString().split('T')[0] };
    }
    return { start: `${monthStr}-01`, end: `${monthStr}-31` };
  }, [view, currentDate, monthStr]);

  useEffect(() => {
    if (!orgId) return;
    getShifts({ orgId, startDate: loadRange.start, endDate: loadRange.end }).then(setShifts);
    getWorkers({ orgId }).then(setWorkers);
    getShops(orgId).then(setShops);
    getShiftTemplates(orgId).then(setTemplates);
    getPermits({ orgId, status: 'approved' }).then(setPermits);
  }, [orgId, loadRange.start, loadRange.end]);

  const reload = async () => {
    const s = await getShifts({ orgId, startDate: loadRange.start, endDate: loadRange.end });
    setShifts(s);
  };

  const activeWorkers = workers.filter(w => w.status === 'active');
  const workerName = (id) => { const w = workers.find(x => x.id === id); return w ? `${w.firstName} ${w.lastName}` : 'Unknown'; };
  const shopName = (id) => shops.find(s => s.id === id)?.name || '';
  const todayStr = new Date().toISOString().split('T')[0];

  // Helpers
  const getDateStr = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const shiftsForDate = (ds) => shifts.filter(s => s.date === ds);
  const permitsForDate = (ds) => permits.filter(p => ds >= p.startDate && ds <= (p.endDate || p.startDate));

  // ─── Navigation ─────────────────────
  const nav = (dir) => {
    const d = new Date(currentDate);
    if (view === VIEWS.WEEK) d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const navTitle = useMemo(() => {
    if (view === VIEWS.WEEK) {
      const d = new Date(currentDate);
      const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const ws = new Date(d); ws.setDate(diff);
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      return `${ws.toLocaleDateString('default', { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  }, [currentDate, view]);

  // ─── Month Grid ─────────────────────
  const monthDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [year, month]);

  // ─── Week Grid ──────────────────────
  const weekDays = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const ws = new Date(d); ws.setDate(diff);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const dd = new Date(ws); dd.setDate(dd.getDate() + i);
      days.push(dd.toISOString().split('T')[0]);
    }
    return days;
  }, [currentDate]);

  // ─── List Data ──────────────────────
  const listDates = useMemo(() => {
    const dates = [...new Set(shifts.map(s => s.date))].sort();
    return dates;
  }, [shifts]);

  // ─── Auto-Schedule ──────────────────
  const handleAutoSchedule = async () => {
    if (templates.length === 0) { toast.error('Create shift templates first!'); return; }
    setScheduling(true);
    try {
      const weekStart = selectedDate || todayStr;
      const result = generateWeeklySchedule(activeWorkers, [], templates, weekStart);
      await bulkCreateShifts(result.map(s => ({ ...s, orgId })));
      await reload();
      setShowAutoSchedule(false);
      toast.success(`Created ${result.length} shifts!`);
    } catch (err) { toast.error(err.message); }
    setScheduling(false);
  };

  // ─── Manual Shift ───────────────────
  const openAddShift = (date) => {
    setShiftForm(f => ({ ...f, date: date || todayStr, workerId: '', shopId: shops[0]?.id || '' }));
    setShowAddShift(true);
  };

  const handleAddShift = async (e) => {
    e.preventDefault();
    if (!shiftForm.workerId || !shiftForm.date) { toast.error('Select a worker and date'); return; }
    setSaving(true);
    try {
      const worker = workers.find(w => w.id === shiftForm.workerId);
      const hours = calcHours(shiftForm.startTime, shiftForm.endTime);
      await createShift({
        ...shiftForm,
        workerName: worker ? `${worker.firstName} ${worker.lastName}` : '',
        hours,
        orgId,
        type: 'manual',
      });
      await reload();
      setShowAddShift(false);
      toast.success('Shift added!');
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  const handleDeleteShift = async (id) => {
    await deleteShift(id);
    setShifts(prev => prev.filter(x => x.id !== id));
    toast.success('Shift deleted');
  };

  function calcHours(start, end) {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let h = (eh + em / 60) - (sh + sm / 60);
    if (h <= 0) h += 24;
    return Math.round(h * 10) / 10;
  }

  // ─── Shift card ─────────────────────
  const ShiftCard = ({ s, compact }) => (
    <div className={cn('flex items-center justify-between rounded-xl', compact ? 'p-2 bg-brand-50' : 'p-3 bg-surface-50')}>
      <div className="min-w-0">
        <p className={cn('font-medium text-surface-800 truncate', compact ? 'text-xs' : 'text-sm')}>{s.workerName || 'Unassigned'}</p>
        <p className={cn('text-surface-500 truncate', compact ? 'text-[10px]' : 'text-xs')}>
          {s.templateName ? `${s.templateName} · ` : ''}{s.startTime}–{s.endTime} ({s.hours || '—'}h)
          {shopName(s.shopId) && ` · ${shopName(s.shopId)}`}
        </p>
      </div>
      {isManager && !compact && (
        <button onClick={() => handleDeleteShift(s.id)} className="btn-icon !w-7 !h-7 hover:!text-red-600 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
      )}
    </div>
  );

  // ─── Day cell (month view) ──────────
  const DayCell = ({ d }) => {
    const ds = getDateStr(year, month, d);
    const dayShifts = shiftsForDate(ds);
    const dayPermits = permitsForDate(ds);
    const isToday = ds === todayStr;
    const isSel = ds === selectedDate;
    return (
      <div onClick={() => setSelectedDate(ds)} className={cn(
        'h-20 sm:h-24 p-1.5 border-b border-r border-surface-100 cursor-pointer transition-colors',
        isToday ? 'bg-brand-50/50' : '', isSel ? 'bg-brand-100/40 ring-2 ring-brand-500 ring-inset' : 'hover:bg-surface-50'
      )}>
        <div className="flex items-center justify-between">
          <span className={cn('text-xs font-medium', isToday ? 'text-brand-600 font-bold' : 'text-surface-600')}>{d}</span>
          {dayShifts.length > 0 && <span className="text-[9px] bg-brand-100 text-brand-700 rounded-full px-1.5">{dayShifts.length}</span>}
        </div>
        <div className="mt-0.5 space-y-0.5 overflow-hidden">
          {dayShifts.slice(0, 2).map(s => (
            <div key={s.id} className="text-[9px] bg-brand-100 text-brand-700 rounded px-1 py-0.5 truncate">{s.workerName?.split(' ')[0] || s.startTime}</div>
          ))}
          {dayShifts.length > 2 && <div className="text-[9px] text-surface-400">+{dayShifts.length - 2}</div>}
          {dayPermits.slice(0, 1).map(p => (
            <div key={p.id} className={cn('text-[9px] rounded px-1 py-0.5 truncate', p.type === 'holiday' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700')}>
              {p.workerName?.split(' ')[0]} - {p.type}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Calendar</h1>
            <p className="text-surface-500 mt-1">{shifts.length} shifts in view</p>
          </div>
          {isManager && (
            <div className="flex gap-2">
              <button onClick={() => openAddShift(selectedDate)} className="btn-secondary"><Plus className="w-4 h-4" /> Add Shift</button>
              <button onClick={() => setShowAutoSchedule(true)} className="btn-primary"><Wand2 className="w-4 h-4" /> Auto-Schedule</button>
            </div>
          )}
        </div>

        {/* View toggle + nav */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
            {[{ key: VIEWS.MONTH, icon: Grid3X3, label: 'Month' }, { key: VIEWS.WEEK, icon: LayoutGrid, label: 'Week' }, { key: VIEWS.LIST, icon: List, label: 'List' }].map(v => (
              <button key={v.key} onClick={() => setView(v.key)} className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all', view === v.key ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700')}>
                <v.icon className="w-3.5 h-3.5" /> {v.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => nav(-1)} className="btn-icon"><ChevronLeft className="w-5 h-5" /></button>
            <h2 className="text-base font-display font-semibold text-surface-900 min-w-[180px] text-center">{navTitle}</h2>
            <button onClick={() => nav(1)} className="btn-icon"><ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>

        {/* ═══ MONTH VIEW ═══ */}
        {view === VIEWS.MONTH && (
          <>
            <div className="card overflow-hidden">
              <div className="grid grid-cols-7 text-center text-xs font-medium text-surface-500 border-b border-surface-100">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="py-2">{d}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.map((d, i) => d ? <DayCell key={d} d={d} /> : <div key={`e${i}`} className="h-20 sm:h-24 bg-surface-50/50 border-b border-r border-surface-100" />)}
              </div>
            </div>
            {selectedDate && (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="section-title">{selectedDate}</h3>
                  {isManager && <button onClick={() => openAddShift(selectedDate)} className="btn-secondary !py-1.5 !text-xs"><Plus className="w-3.5 h-3.5" /> Add</button>}
                </div>
                {shiftsForDate(selectedDate).length === 0 && permitsForDate(selectedDate).length === 0 && <p className="text-sm text-surface-400">No shifts or leaves scheduled.</p>}
                <div className="space-y-2">
                  {shiftsForDate(selectedDate).map(s => <ShiftCard key={s.id} s={s} />)}
                  {permitsForDate(selectedDate).map(p => (
                    <div key={p.id} className={cn('p-3 rounded-xl text-sm', p.type === 'holiday' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700')}>
                      <strong>{p.workerName}</strong> — {p.type} {p.reason && <span className="italic">"{p.reason}"</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ WEEK VIEW ═══ */}
        {view === VIEWS.WEEK && (
          <div className="card overflow-x-auto">
            <div className="grid grid-cols-7 min-w-[700px]">
              {weekDays.map(ds => {
                const dayShifts = shiftsForDate(ds);
                const dayPermits = permitsForDate(ds);
                const isToday = ds === todayStr;
                const dayLabel = new Date(ds + 'T12:00').toLocaleDateString('default', { weekday: 'short', day: 'numeric' });
                return (
                  <div key={ds} className={cn('border-r border-surface-100 min-h-[200px]', isToday ? 'bg-brand-50/30' : '')}>
                    <div className={cn('px-2 py-2 text-center border-b border-surface-100', isToday ? 'bg-brand-100/50' : 'bg-surface-50')}>
                      <p className={cn('text-xs font-semibold', isToday ? 'text-brand-700' : 'text-surface-600')}>{dayLabel}</p>
                    </div>
                    <div className="p-1.5 space-y-1">
                      {dayShifts.map(s => <ShiftCard key={s.id} s={s} compact />)}
                      {dayPermits.map(p => (
                        <div key={p.id} className={cn('text-[10px] rounded px-1.5 py-1 truncate', p.type === 'holiday' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700')}>
                          {p.workerName?.split(' ')[0]} — {p.type}
                        </div>
                      ))}
                      {isManager && (
                        <button onClick={() => openAddShift(ds)} className="w-full text-[10px] text-surface-400 hover:text-brand-600 py-1 rounded hover:bg-brand-50 transition-colors">+ Add</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ LIST VIEW ═══ */}
        {view === VIEWS.LIST && (
          <div className="space-y-4">
            {listDates.length === 0 && <div className="card p-8 text-center"><CalIcon className="w-8 h-8 text-surface-300 mx-auto mb-2" /><p className="text-surface-400 text-sm">No shifts in this period.</p></div>}
            {listDates.map(ds => {
              const dayShifts = shiftsForDate(ds);
              const dayPermits = permitsForDate(ds);
              const isToday = ds === todayStr;
              return (
                <div key={ds} className="card">
                  <div className={cn('px-5 py-3 border-b border-surface-100 flex items-center justify-between', isToday ? 'bg-brand-50/50' : '')}>
                    <h3 className={cn('text-sm font-semibold', isToday ? 'text-brand-700' : 'text-surface-800')}>
                      {new Date(ds + 'T12:00').toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
                      {isToday && <span className="badge bg-brand-100 text-brand-700 ml-2">Today</span>}
                    </h3>
                    <span className="text-xs text-surface-400">{dayShifts.length} shifts</span>
                  </div>
                  <div className="divide-y divide-surface-100">
                    {dayShifts.map(s => (
                      <div key={s.id} className="px-5 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-surface-800">{s.workerName || 'Unassigned'}</p>
                          <p className="text-xs text-surface-500">{s.startTime}–{s.endTime} ({s.hours}h) · {shopName(s.shopId) || 'No shop'} {s.templateName && `· ${s.templateName}`}</p>
                        </div>
                        {isManager && <button onClick={() => handleDeleteShift(s.id)} className="btn-icon !w-7 !h-7 hover:!text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}
                      </div>
                    ))}
                    {dayPermits.map(p => (
                      <div key={p.id} className="px-5 py-3 text-sm">
                        <span className={cn('badge mr-2', p.type === 'holiday' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700')}>{p.type}</span>
                        <strong>{p.workerName}</strong> {p.reason && <span className="text-surface-400 italic">— {p.reason}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Auto-Schedule Modal ─── */}
        <Modal open={showAutoSchedule} onClose={() => setShowAutoSchedule(false)} title="Auto-Schedule Week">
          <div className="space-y-4">
            <p className="text-sm text-surface-600">Generates a 7-day schedule starting from <strong>{selectedDate || todayStr}</strong>. Salaried workers with matching shift preferences are assigned first.</p>
            <div className="p-3 bg-surface-50 rounded-xl text-sm text-surface-600 space-y-1">
              <p><strong>{templates.length}</strong> shift templates · <strong>{shops.length}</strong> shops</p>
              <p><strong>{activeWorkers.length}</strong> active workers ({activeWorkers.filter(w => w.payType === 'salaried').length} salaried)</p>
              <p className="text-xs text-surface-400 mt-2">Preference breakdown: {activeWorkers.filter(w => w.shiftPreference === 'morning').length} morning, {activeWorkers.filter(w => w.shiftPreference === 'afternoon').length} afternoon, {activeWorkers.filter(w => w.shiftPreference === 'evening').length} evening, {activeWorkers.filter(w => !w.shiftPreference || w.shiftPreference === 'any').length} flexible</p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowAutoSchedule(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleAutoSchedule} disabled={scheduling} className="btn-primary">{scheduling ? 'Generating...' : 'Generate Schedule'}</button>
            </div>
          </div>
        </Modal>

        {/* ─── Add Shift Modal ─── */}
        <Modal open={showAddShift} onClose={() => setShowAddShift(false)} title="Add Shift">
          <form onSubmit={handleAddShift} className="space-y-4">
            <div><label className="label">Worker *</label>
              <select value={shiftForm.workerId} onChange={e => setShiftForm(f => ({ ...f, workerId: e.target.value }))} className="select-field" required>
                <option value="">Select worker...</option>
                {activeWorkers.map(w => <option key={w.id} value={w.id}>{w.firstName} {w.lastName} {w.shiftPreference && w.shiftPreference !== 'any' ? `(${w.shiftPreference})` : ''}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Date *</label><input type="date" value={shiftForm.date} onChange={e => setShiftForm(f => ({ ...f, date: e.target.value }))} className="input-field" required /></div>
              <div><label className="label">Shop</label>
                <select value={shiftForm.shopId} onChange={e => setShiftForm(f => ({ ...f, shopId: e.target.value }))} className="select-field">
                  <option value="">No shop</option>
                  {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Start Time *</label><input type="time" value={shiftForm.startTime} onChange={e => setShiftForm(f => ({ ...f, startTime: e.target.value }))} className="input-field" required /></div>
              <div><label className="label">End Time *</label><input type="time" value={shiftForm.endTime} onChange={e => setShiftForm(f => ({ ...f, endTime: e.target.value }))} className="input-field" required /></div>
            </div>
            <div><label className="label">Shift Name / Notes</label><input value={shiftForm.templateName} onChange={e => setShiftForm(f => ({ ...f, templateName: e.target.value }))} className="input-field" placeholder="e.g. Morning cover" /></div>
            {shiftForm.startTime && shiftForm.endTime && (
              <p className="text-xs text-surface-400">Duration: {calcHours(shiftForm.startTime, shiftForm.endTime)}h</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAddShift(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Adding...' : 'Add Shift'}</button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}
