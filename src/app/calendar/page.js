'use client';
import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { getShifts, getWorkers, getShops, getShiftTemplates, getPermits, bulkCreateShifts, deleteShift, createShift, getPublicHolidays, savePublicHolidays } from '@/lib/firestore';
import { generateWeeklySchedule, DAY_LABELS } from '@/lib/scheduling';
import { cn } from '@/utils/helpers';
import { ChevronLeft, ChevronRight, Plus, Wand2, Trash2, Calendar as CalIcon, Users, Clock, Grid3X3, List, LayoutGrid, AlertTriangle, CheckCircle } from 'lucide-react';
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
  const [preview, setPreview] = useState(null); // { assignments, stats, warnings }
  const [selectedTemplates, setSelectedTemplates] = useState([]);
  const [shiftForm, setShiftForm] = useState({ workerId: '', shopId: '', date: '', startTime: '09:00', endTime: '17:00', templateName: '', notes: '' });
  const [publicHolidays, setPublicHolidays] = useState([]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

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
    getPublicHolidays(orgId).then(setPublicHolidays);
  }, [orgId, loadRange.start, loadRange.end]);

  const reload = async () => {
    const s = await getShifts({ orgId, startDate: loadRange.start, endDate: loadRange.end });
    setShifts(s);
  };

  const activeWorkers = workers.filter(w => w.status === 'active');
  const workerName = (id) => { const w = workers.find(x => x.id === id); return w ? `${w.firstName} ${w.lastName}` : 'Unknown'; };
  const shopName = (id) => shops.find(s => s.id === id)?.name || '';
  const todayStr = new Date().toISOString().split('T')[0];
  const getDateStr = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const shiftsForDate = (ds) => shifts.filter(s => s.date === ds);
  const permitsForDate = (ds) => permits.filter(p => ds >= p.startDate && ds <= (p.endDate || p.startDate));

  // Get Monday of current week
  const getWeekMonday = (dateStr) => {
    const d = new Date(dateStr || todayStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().split('T')[0];
  };

  // ─── Nav ────────────────────────────
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

  // ─── Grids ──────────────────────────
  const monthDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [year, month]);

  const weekDays = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const ws = new Date(d); ws.setDate(diff);
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(ws); dd.setDate(dd.getDate() + i);
      return dd.toISOString().split('T')[0];
    });
  }, [currentDate]);

  const listDates = useMemo(() => [...new Set(shifts.map(s => s.date))].sort(), [shifts]);

  // ─── Auto-Schedule ──────────────────
  const openAutoSchedule = () => {
    setSelectedTemplates(templates.map(t => t.id));
    setShowAutoSchedule(true);
    setPreview(null);
  };

  const toggleAllTemplates = (checked) => {
    if (checked) setSelectedTemplates(templates.map(t => t.id));
    else setSelectedTemplates([]);
  };

  const toggleTemplate = (templateId) => {
    setSelectedTemplates(prev => 
      prev.includes(templateId) 
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  const handlePreview = () => {
    const selected = templates.filter(t => selectedTemplates.includes(t.id));
    if (selected.length === 0) { toast.error('Select at least one template'); return; }
    const weekStart = getWeekMonday(selectedDate);
    const result = generateWeeklySchedule({
      workers: activeWorkers,
      templates: selected,
      weekStart,
      leaves: permits,
      existingShifts: shifts.filter(s => s.date >= weekStart),
    });
    setPreview(result);
  };

  const handleConfirmSchedule = async () => {
    if (!preview?.assignments.length) return;
    setScheduling(true);
    try {
      await bulkCreateShifts(preview.assignments.map(s => ({ ...s, orgId })));
      await reload();
      setShowAutoSchedule(false);
      setPreview(null);
      toast.success(`Created ${preview.assignments.length} shifts!`);
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
      const [sh, sm] = shiftForm.startTime.split(':').map(Number);
      const [eh, em] = shiftForm.endTime.split(':').map(Number);
      let hours = (eh + em / 60) - (sh + sm / 60); if (hours <= 0) hours += 24;
      await createShift({
        ...shiftForm,
        workerName: worker ? `${worker.firstName} ${worker.lastName}` : '',
        hours: Math.round(hours * 10) / 10,
        orgId, type: 'manual',
      });
      await reload(); setShowAddShift(false); toast.success('Shift added!');
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  const handleDeleteShift = async (id) => {
    await deleteShift(id);
    setShifts(prev => prev.filter(x => x.id !== id));
    toast.success('Shift deleted');
  };

  const addPublicHoliday = async (date) => {
    if (publicHolidays.some(h => h.date === date)) {
      toast.error('This date is already marked as a public holiday');
      return;
    }
    const name = prompt('Enter holiday name:', 'Public Holiday');
    if (!name || !name.trim()) return;
    const newHoliday = { date, name: name.trim() };
    const updated = [...publicHolidays, newHoliday];
    await savePublicHolidays(orgId, updated);
    setPublicHolidays(updated);
    toast.success('Public holiday added');
  };

  const removePublicHoliday = async (date) => {
    const updated = publicHolidays.filter(h => h.date !== date);
    await savePublicHolidays(orgId, updated);
    setPublicHolidays(updated);
    toast.success('Public holiday removed');
  };

  // ─── Shift Card ─────────────────────
  const ShiftCard = ({ s, compact }) => (
    <div className={cn('flex items-center justify-between rounded-xl', compact ? 'p-1.5 sm:p-2 bg-brand-50' : 'p-3 bg-surface-50')}>
      <div className="min-w-0">
        <p className={cn('font-medium text-surface-800 truncate', compact ? 'text-[10px] sm:text-xs' : 'text-sm')}>{s.workerName || 'Unassigned'}</p>
        <p className={cn('text-surface-500 truncate', compact ? 'text-[9px] sm:text-[10px]' : 'text-xs')}>
          {s.startTime}–{s.endTime}
          {!compact && ` (${s.hours || '—'}h)`}
          {!compact && shopName(s.shopId) && ` · ${shopName(s.shopId)}`}
        </p>
      </div>
      {isManager && !compact && (
        <button onClick={() => handleDeleteShift(s.id)} className="btn-icon !w-7 !h-7 hover:!text-red-600 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
      )}
    </div>
  );

  // ─── Day Cell ───────────────────────
  const DayCell = ({ d }) => {
    const ds = getDateStr(year, month, d);
    const dayShifts = shiftsForDate(ds);
    const dayPermits = permitsForDate(ds);
    const isToday = ds === todayStr;
    const isSel = ds === selectedDate;
    const isPublicHoliday = publicHolidays.some(h => h.date === ds);
    return (
      <div onClick={() => setSelectedDate(ds)} className={cn(
        'h-14 sm:h-24 p-1 sm:p-1.5 border-b border-r border-surface-100 cursor-pointer transition-colors overflow-hidden',
        isToday ? 'bg-brand-50/50' : '', isSel ? 'bg-brand-100/40 ring-2 ring-brand-500 ring-inset' : 'hover:bg-surface-50', isPublicHoliday ? 'bg-red-50' : ''
      )}>
        <div className="flex items-center justify-between">
          <span className={cn('text-[10px] sm:text-xs font-medium', isToday ? 'text-brand-600 font-bold' : 'text-surface-600')}>{d}</span>
          {dayShifts.length > 0 && <span className="text-[8px] sm:text-[9px] bg-brand-100 text-brand-700 rounded-full px-1 sm:px-1.5">{dayShifts.length}</span>}
        </div>
        <div className="mt-0.5 space-y-0.5 overflow-hidden hidden sm:block">
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
        {/* Mobile: just show dots for shifts */}
        <div className="flex gap-0.5 mt-1 sm:hidden flex-wrap">
          {dayShifts.slice(0, 3).map(s => (
            <div key={s.id} className="w-1.5 h-1.5 rounded-full bg-brand-400" />
          ))}
          {dayPermits.slice(0, 1).map(p => (
            <div key={p.id} className={cn('w-1.5 h-1.5 rounded-full', p.type === 'holiday' ? 'bg-blue-400' : 'bg-red-400')} />
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
              <button onClick={() => openAddShift(selectedDate)} className="btn-secondary !px-3 sm:!px-5"><Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Shift</span><span className="sm:hidden">Add</span></button>
              <button onClick={() => { setPreview(null); setShowAutoSchedule(true); }} className="btn-primary !px-3 sm:!px-5"><Wand2 className="w-4 h-4" /> <span className="hidden sm:inline">Auto-Schedule</span><span className="sm:hidden">Auto</span></button>
            </div>
          )}
        </div>

        {/* View toggle + nav */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
            {[{ key: VIEWS.MONTH, icon: Grid3X3, label: 'Month' }, { key: VIEWS.WEEK, icon: LayoutGrid, label: 'Week' }, { key: VIEWS.LIST, icon: List, label: 'List' }].map(v => (
              <button key={v.key} onClick={() => setView(v.key)} className={cn('flex items-center justify-center gap-1.5 flex-1 sm:flex-none px-3 py-1.5 text-sm font-medium rounded-lg transition-all', view === v.key ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700')}>
                <v.icon className="w-3.5 h-3.5" /> {v.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
            <button onClick={() => { setSelectedDate(getWeekMonday(new Date().toISOString().split('T')[0])); openAutoSchedule(); }} className="btn-secondary !py-1.5 !text-xs hidden sm:inline-flex"><Wand2 className="w-3.5 h-3.5" /> Auto Schedule</button>
            <button onClick={() => nav(-1)} className="btn-icon !w-8 !h-8 sm:!w-10 sm:!h-10"><ChevronLeft className="w-5 h-5" /></button>
            <h2 className="text-sm sm:text-base font-display font-semibold text-surface-900 min-w-0 sm:min-w-[180px] text-center truncate">{navTitle}</h2>
            <button onClick={() => nav(1)} className="btn-icon !w-8 !h-8 sm:!w-10 sm:!h-10"><ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>

        {/* MONTH VIEW */}
        {view === VIEWS.MONTH && (
          <>
            <div className="card overflow-hidden">
              <div className="grid grid-cols-7 text-center text-[10px] sm:text-xs font-medium text-surface-500 border-b border-surface-100">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="py-1.5 sm:py-2"><span className="hidden sm:inline">{d}</span><span className="sm:hidden">{d[0]}</span></div>)}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.map((d, i) => d ? <DayCell key={d} d={d} /> : <div key={`e${i}`} className="h-14 sm:h-24 bg-surface-50/50 border-b border-r border-surface-100" />)}
              </div>
            </div>
            {selectedDate && (() => {
              const isPublicHoliday = publicHolidays.some(h => h.date === selectedDate);
              return (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="section-title">{selectedDate}</h3>
                  {isManager && <button onClick={() => openAddShift(selectedDate)} className="btn-secondary !py-1.5 !text-xs"><Plus className="w-3.5 h-3.5" /> Add</button>}
                </div>
                {shiftsForDate(selectedDate).length === 0 && permitsForDate(selectedDate).length === 0 && !isPublicHoliday && <p className="text-sm text-surface-400">No shifts or leaves scheduled.</p>}
                <div className="space-y-2">
                  {shiftsForDate(selectedDate).map(s => <ShiftCard key={s.id} s={s} />)}
                  {permitsForDate(selectedDate).map(p => (
                    <div key={p.id} className={cn('p-3 rounded-xl text-sm', p.type === 'holiday' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700')}>
                      <strong>{p.workerName}</strong> — {p.type} {p.reason && <span className="italic">"{p.reason}"</span>}
                    </div>
                  ))}
                  {isPublicHoliday && (
                    <div className="p-3 rounded-xl text-sm bg-red-50 text-red-700 flex items-center justify-between">
                      <span><strong>Public Holiday:</strong> {publicHolidays.find(h => h.date === selectedDate)?.name}</span>
                      {isManager && <button onClick={() => removePublicHoliday(selectedDate)} className="btn-icon !w-6 !h-6 hover:!text-red-800"><X className="w-4 h-4" /></button>}
                    </div>
                  )}
                  {!isPublicHoliday && isManager && (
                    <button onClick={() => addPublicHoliday(selectedDate)} className="btn-secondary !py-1.5 !text-xs w-full"><Plus className="w-3.5 h-3.5" /> Mark as Public Holiday</button>
                  )}
                </div>
              </div>
              );
            })()}
          </>
        )}

        {/* WEEK VIEW */}
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

        {/* LIST VIEW */}
        {view === VIEWS.LIST && (
          <div className="space-y-4">
            {listDates.length === 0 && <div className="card p-8 text-center"><CalIcon className="w-8 h-8 text-surface-300 mx-auto mb-2" /><p className="text-surface-400 text-sm">No shifts in this period.</p></div>}
            {listDates.map(ds => {
              const dayShifts = shiftsForDate(ds);
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
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Auto-Schedule Modal ─── */}
        <Modal open={showAutoSchedule} onClose={() => { setShowAutoSchedule(false); setPreview(null); }} title="Auto-Schedule Week" size="lg">
          <div className="space-y-4">
            <p className="text-sm text-surface-600">
              Generate a weekly schedule starting <strong>Monday {getWeekMonday(selectedDate)}</strong>. The algorithm assigns workers based on shift preferences, availability days, contracted hours, and fairness.
            </p>

            <div className="p-3 bg-surface-50 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><span className="text-surface-400 text-xs block">Templates</span><strong className="text-surface-800">{templates.length}</strong></div>
              <div><span className="text-surface-400 text-xs block">Workers</span><strong className="text-surface-800">{activeWorkers.length}</strong></div>
              <div><span className="text-surface-400 text-xs block">On Leave</span><strong className="text-surface-800">{permits.length}</strong></div>
              <div><span className="text-surface-400 text-xs block">Shops</span><strong className="text-surface-800">{shops.length}</strong></div>
            </div>

            {/* Template breakdown — shows which days each template runs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Select templates to use</p>
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={selectedTemplates.length === templates.length && templates.length > 0}
                    onChange={e => toggleAllTemplates(e.target.checked)}
                    className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" 
                  />
                  <span className="text-surface-600 font-medium">Select all</span>
                </label>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-surface-100 rounded-lg p-2 bg-surface-50">
                {templates.map(t => {
                  const days = t.daysOfWeek && t.daysOfWeek.length > 0 ? t.daysOfWeek : [0,1,2,3,4,5,6];
                  const dayStr = days.length === 7 ? 'Every day' : JSON.stringify([...days].sort()) === JSON.stringify([1,2,3,4,5]) ? 'Mon–Fri' : JSON.stringify([...days].sort()) === JSON.stringify([0,6]) ? 'Weekends' : days.sort((a,b)=>a-b).map(d => DAY_LABELS[d]).join(', ');
                  const isSelected = selectedTemplates.includes(t.id);
                  return (
                    <div 
                      key={t.id} 
                      onClick={() => toggleTemplate(t.id)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all",
                        isSelected 
                          ? 'border-brand-400 bg-white shadow-sm' 
                          : 'border-surface-200 bg-white hover:border-surface-300'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-5 h-5 rounded-md flex items-center justify-center transition-colors",
                          isSelected ? 'bg-brand-500' : 'bg-surface-100 border border-surface-300'
                        )}>
                          {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <div>
                          <p className="font-semibold text-surface-800">{t.name}</p>
                          <p className="text-xs text-surface-400">{t.startTime}–{t.endTime} · {t.requiredWorkers} workers</p>
                        </div>
                      </div>
                      <span className={cn('text-xs font-medium', days.length > 5 ? 'text-amber-600' : 'text-surface-500')}>{dayStr}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-surface-400 text-right">{selectedTemplates.length} of {templates.length} templates selected</p>
            </div>

            {!preview && (
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowAutoSchedule(false)} className="btn-secondary">Cancel</button>
                <button onClick={handlePreview} className="btn-primary"><Wand2 className="w-4 h-4" /> Preview Schedule</button>
              </div>
            )}

            {/* Preview results */}
            {preview && (
              <div className="space-y-4 border-t border-surface-200 pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  <h4 className="font-semibold text-surface-800">Preview: {preview.stats.totalShifts} shifts · {preview.stats.totalHours.toFixed(1)}h total</h4>
                </div>

                {/* Per-day breakdown */}
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {Object.entries(preview.stats.perDay).map(([ds, info]) => (
                    <div key={ds} className="text-center p-1.5 sm:p-2 bg-surface-50 rounded-lg">
                      <p className="text-[10px] sm:text-[11px] font-semibold text-surface-600">{info.day}</p>
                      <p className="text-base sm:text-lg font-bold text-surface-800">{info.shifts}</p>
                      <p className="text-[9px] sm:text-[10px] text-surface-400">{info.hours.toFixed(1)}h</p>
                    </div>
                  ))}
                </div>

                {/* Worker hours */}
                <div className="max-h-40 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-surface-400 border-b"><th className="pb-1">Worker</th><th className="pb-1 text-right">Assigned</th><th className="pb-1 text-right">Target</th></tr></thead>
                    <tbody>
                      {activeWorkers.filter(w => (preview.stats.workerHours[w.id] || 0) > 0).sort((a, b) => (preview.stats.workerHours[b.id] || 0) - (preview.stats.workerHours[a.id] || 0)).map(w => {
                        const assigned = preview.stats.workerHours[w.id] || 0;
                        const target = w.payType === 'salaried' ? (w.fixedHoursWeek || 40) : (w.contractedHours || 20);
                        const pct = Math.min(100, (assigned / target) * 100);
                        return (
                          <tr key={w.id} className="border-b border-surface-50">
                            <td className="py-1.5 text-surface-700">{w.firstName} {w.lastName}</td>
                            <td className="py-1.5 text-right font-medium">{assigned.toFixed(1)}h</td>
                            <td className="py-1.5 text-right text-surface-400">{target}h <span className={cn('text-[10px] ml-1', pct >= 90 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500')}>{pct.toFixed(0)}%</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Warnings */}
                {preview.warnings.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                    <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {preview.warnings.length} warning{preview.warnings.length > 1 ? 's' : ''}</p>
                    {preview.warnings.slice(0, 5).map((w, i) => (
                      <p key={i} className="text-xs text-amber-700">
                        {w.shortBy ? `${w.day} — ${w.template}: need ${w.needed}, only filled ${w.filled} (short ${w.shortBy})` :
                         w.type === 'under_hours' ? `${w.worker}: only ${w.assigned.toFixed(1)}h assigned (min ${w.minimum}h)` : JSON.stringify(w)}
                      </p>
                    ))}
                    {preview.warnings.length > 5 && <p className="text-xs text-amber-500">+ {preview.warnings.length - 5} more</p>}
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button onClick={() => setPreview(null)} className="btn-secondary">Re-generate</button>
                  <button onClick={handleConfirmSchedule} disabled={scheduling} className="btn-primary">
                    {scheduling ? 'Creating...' : `Confirm ${preview.stats.totalShifts} Shifts`}
                  </button>
                </div>
              </div>
            )}
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
              <div><label className="label">Start *</label><input type="time" value={shiftForm.startTime} onChange={e => setShiftForm(f => ({ ...f, startTime: e.target.value }))} className="input-field" required /></div>
              <div><label className="label">End *</label><input type="time" value={shiftForm.endTime} onChange={e => setShiftForm(f => ({ ...f, endTime: e.target.value }))} className="input-field" required /></div>
            </div>
            <div><label className="label">Name / Notes</label><input value={shiftForm.templateName} onChange={e => setShiftForm(f => ({ ...f, templateName: e.target.value }))} className="input-field" placeholder="e.g. Morning cover" /></div>
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
