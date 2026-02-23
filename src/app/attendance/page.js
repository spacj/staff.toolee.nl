'use client';
import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { getAttendance, getPermits, updatePermit, getWorkers, getShops, approveAttendance, notifyWorker, getCorrectionRequests, reviewCorrectionRequest, getMessages, createMessage, markMessageRead, updateAttendance, createAttendance, deleteAttendance } from '@/lib/firestore';
import { formatCurrency } from '@/lib/pricing';
import { cn } from '@/utils/helpers';
import { Clock, CheckCircle, XCircle, Calendar, Users, FileCheck, MessageSquare, AlertTriangle, Send, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Grid3X3 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AttendancePage() {
  const { orgId, user, isManager } = useAuth();
  const [tab, setTab] = useState('calendar'); // calendar | hours | permits | corrections | messages
  const [attendance, setAttendance] = useState([]);
  const [allAttendance, setAllAttendance] = useState([]); // for calendar view (full month)
  const [permits, setPermits] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [shops, setShops] = useState([]);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');

  // Calendar state
  const [calDate, setCalDate] = useState(new Date());
  const [selectedCalDate, setSelectedCalDate] = useState(new Date().toISOString().split('T')[0]);
  const [workerFilter, setWorkerFilter] = useState('all');

  // Add/Edit attendance modal
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null); // null = new, object = editing
  const [entryForm, setEntryForm] = useState({ workerId: '', shopId: '', date: '', entries: [{ clockIn: '', clockOut: '' }], adminNotes: '' });
  const [savingEntry, setSavingEntry] = useState(false);

  // Corrections
  const [corrections, setCorrections] = useState([]);
  const [correctionReviewModal, setCorrectionReviewModal] = useState(null);
  const [correctionNotes, setCorrectionNotes] = useState('');

  // Messages
  const [messages, setMessages] = useState([]);
  const [expandedMsg, setExpandedMsg] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [saving, setSaving] = useState(false);

  const calYear = calDate.getFullYear();
  const calMonth = calDate.getMonth();
  const monthStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
  const todayStr = new Date().toISOString().split('T')[0];

  const load = () => {
    if (!orgId) return;
    // Hours tab: single-day query
    const filters = { orgId, startDate: dateFilter, endDate: dateFilter, limit: 100 };
    if (statusFilter !== 'all') filters.approvalStatus = statusFilter;
    getAttendance(filters).then(setAttendance).catch(() => setAttendance([]));
    getPermits({ orgId }).then(setPermits);
    getWorkers({ orgId }).then(setWorkers);
    getShops(orgId).then(setShops);
    getCorrectionRequests({ orgId, limit: 50 }).then(setCorrections).catch(() => setCorrections([]));
    getMessages({ orgId, limit: 100 }).then(setMessages).catch(() => setMessages([]));
  };

  // Load calendar month data
  const loadCalendar = () => {
    if (!orgId) return;
    getAttendance({ orgId, startDate: `${monthStr}-01`, endDate: `${monthStr}-31`, limit: 2000 })
      .then(setAllAttendance).catch(() => setAllAttendance([]));
  };

  useEffect(() => { load(); }, [orgId, dateFilter, statusFilter]);
  useEffect(() => { loadCalendar(); }, [orgId, monthStr]);

  const reload = () => { load(); loadCalendar(); };

  // ─── Helpers ────────────────────────
  const activeWorkers = workers.filter(w => w.status === 'active');
  const workerName = (id) => { const w = workers.find(x => x.id === id); return w ? `${w.firstName} ${w.lastName}` : id; };
  const shopName = (id) => shops.find(s => s.id === id)?.name || '';
  const workerRate = (id) => { const w = workers.find(x => x.id === id); return w?.payType === 'hourly' ? (w.costPerHour || 0) : 0; };
  const getDateStr = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  // ─── Calendar grid ──────────────────
  const monthDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [calYear, calMonth]);

  const navTitle = calDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Group attendance by date for calendar
  const attendanceByDate = useMemo(() => {
    const map = {};
    allAttendance.forEach(a => {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    });
    return map;
  }, [allAttendance]);

  // Records for selected calendar date
  const selectedDayRecords = useMemo(() => {
    let records = allAttendance.filter(a => a.date === selectedCalDate);
    if (workerFilter !== 'all') records = records.filter(a => a.workerId === workerFilter);
    return records;
  }, [allAttendance, selectedCalDate, workerFilter]);

  // ─── Calendar Day Cell ──────────────
  const CalDayCell = ({ d }) => {
    const ds = getDateStr(calYear, calMonth, d);
    const dayRecords = attendanceByDate[ds] || [];
    const isToday = ds === todayStr;
    const isSel = ds === selectedCalDate;
    const totalH = dayRecords.reduce((s, a) => s + (a.totalHours || 0), 0);
    const pending = dayRecords.filter(a => a.approvalStatus === 'pending').length;
    return (
      <div onClick={() => setSelectedCalDate(ds)} className={cn(
        'h-14 sm:h-[72px] p-1 sm:p-1.5 border-b border-r border-surface-100 cursor-pointer transition-colors overflow-hidden',
        isToday ? 'bg-brand-50/50' : '', isSel ? 'bg-brand-100/40 ring-2 ring-brand-500 ring-inset' : 'hover:bg-surface-50'
      )}>
        <div className="flex items-center justify-between">
          <span className={cn('text-[10px] sm:text-xs font-medium', isToday ? 'text-brand-600 font-bold' : 'text-surface-600')}>{d}</span>
          {dayRecords.length > 0 && <span className="text-[8px] sm:text-[9px] bg-brand-100 text-brand-700 rounded-full px-1 sm:px-1.5">{dayRecords.length}</span>}
        </div>
        {/* Desktop: show summary */}
        <div className="hidden sm:block mt-0.5 overflow-hidden">
          {totalH > 0 && <div className="text-[9px] text-surface-500 font-medium">{totalH.toFixed(1)}h total</div>}
          {pending > 0 && <div className="text-[9px] text-amber-600 font-medium">{pending} pending</div>}
        </div>
        {/* Mobile: dots */}
        <div className="flex gap-0.5 mt-0.5 sm:hidden flex-wrap">
          {dayRecords.slice(0, 4).map(a => (
            <div key={a.id} className={cn('w-1.5 h-1.5 rounded-full',
              a.approvalStatus === 'approved' ? 'bg-emerald-400' :
              a.approvalStatus === 'rejected' ? 'bg-red-400' : 'bg-amber-400'
            )} />
          ))}
        </div>
      </div>
    );
  };

  // ─── Entry Modal Handlers ──────────
  const openAddEntry = (date) => {
    setEditRecord(null);
    setEntryForm({ workerId: activeWorkers[0]?.id || '', shopId: shops[0]?.id || '', date: date || selectedCalDate || todayStr, entries: [{ clockIn: '09:00', clockOut: '17:00' }], adminNotes: '' });
    setShowEntryModal(true);
  };

  const openEditEntry = (record) => {
    setEditRecord(record);
    setEntryForm({
      workerId: record.workerId,
      shopId: record.shopId || '',
      date: record.date,
      entries: (record.entries || []).map(e => ({
        clockIn: e.clockIn?.slice(11, 16) || '',
        clockOut: e.clockOut?.slice(11, 16) || '',
      })),
      adminNotes: record.adminNotes || '',
    });
    setShowEntryModal(true);
  };

  const addEntryRow = () => {
    setEntryForm(f => ({ ...f, entries: [...f.entries, { clockIn: '', clockOut: '' }] }));
  };
  const removeEntryRow = (idx) => {
    setEntryForm(f => ({ ...f, entries: f.entries.filter((_, i) => i !== idx) }));
  };
  const updateEntryRow = (idx, field, val) => {
    setEntryForm(f => ({ ...f, entries: f.entries.map((e, i) => i === idx ? { ...e, [field]: val } : e) }));
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!entryForm.workerId || !entryForm.date) { toast.error('Worker and date are required'); return; }
    const validEntries = entryForm.entries.filter(e => e.clockIn);
    if (validEntries.length === 0) { toast.error('Add at least one clock-in time'); return; }

    setSavingEntry(true);
    try {
      const isoEntries = validEntries.map(entry => ({
        clockIn: `${entryForm.date}T${entry.clockIn}:00.000Z`,
        clockOut: entry.clockOut ? `${entryForm.date}T${entry.clockOut}:00.000Z` : null,
      }));

      const totalHours = isoEntries.reduce((sum, ent) => {
        if (!ent.clockIn || !ent.clockOut) return sum;
        return sum + Math.max(0, (new Date(ent.clockOut) - new Date(ent.clockIn)) / 3600000);
      }, 0);
      const allClosed = isoEntries.every(ent => ent.clockOut);

      if (editRecord) {
        // Update existing record
        await updateAttendance(editRecord.id, {
          workerId: entryForm.workerId,
          shopId: entryForm.shopId,
          date: entryForm.date,
          entries: isoEntries,
          totalHours: Math.round(totalHours * 100) / 100,
          status: allClosed ? 'completed' : 'clocked-in',
          adminNotes: entryForm.adminNotes || '',
        });
        toast.success('Attendance updated');
      } else {
        // Create new record
        const worker = workers.find(w => w.id === entryForm.workerId);
        await createAttendance({
          workerId: entryForm.workerId,
          workerName: worker ? `${worker.firstName} ${worker.lastName}` : '',
          orgId,
          shopId: entryForm.shopId,
          date: entryForm.date,
          entries: isoEntries,
          approvalStatus: 'approved',
          approvedBy: user?.uid,
          adminNotes: entryForm.adminNotes || 'Manually created by management',
        });
        toast.success('Attendance record created');
      }
      setShowEntryModal(false);
      reload();
    } catch (err) { toast.error(err.message); }
    setSavingEntry(false);
  };

  const handleDeleteRecord = async (id) => {
    if (!confirm('Delete this attendance record? This cannot be undone.')) return;
    await deleteAttendance(id);
    toast.success('Record deleted');
    reload();
  };

  const handleQuickApprove = async (record) => {
    await approveAttendance(record.id, user?.uid, true, '');
    if (record.workerId) {
      await notifyWorker(record.workerId, orgId, { type: 'hours_review', title: 'Hours approved', message: `Your hours for ${record.date} (${(record.totalHours || 0).toFixed(1)}h) have been approved.`, link: '/time' }).catch(() => {});
    }
    toast.success('Hours approved');
    reload();
  };

  const handleQuickReject = async (record) => {
    await approveAttendance(record.id, user?.uid, false, '');
    if (record.workerId) {
      await notifyWorker(record.workerId, orgId, { type: 'hours_review', title: 'Hours rejected', message: `Your hours for ${record.date} have been rejected.`, link: '/time' }).catch(() => {});
    }
    toast.success('Hours rejected');
    reload();
  };

  // ─── Existing handlers (permits, corrections, messages) ────
  const handlePermitAction = async (id, status) => {
    const permit = permits.find(p => p.id === id);
    await updatePermit(id, { status, reviewedBy: user?.uid, reviewedAt: new Date().toISOString() });
    if (permit?.workerId) { await notifyWorker(permit.workerId, orgId, { type: 'permit_response', title: `Leave ${status}`, message: `Your ${permit.type} request for ${permit.startDate} has been ${status}.`, link: '/time' }).catch(() => {}); }
    toast.success(status === 'approved' ? 'Approved' : 'Denied');
    load();
  };

  const handleApproveHours = async (approved) => {
    if (!reviewModal) return;
    await approveAttendance(reviewModal.id, user?.uid, approved, reviewNotes);
    if (reviewModal.workerId) { await notifyWorker(reviewModal.workerId, orgId, { type: 'hours_review', title: `Hours ${approved ? 'approved' : 'rejected'}`, message: `Your hours for ${reviewModal.date} (${(reviewModal.totalHours || 0).toFixed(1)}h) have been ${approved ? 'approved' : 'rejected'}. ${reviewNotes ? `Note: ${reviewNotes}` : ''}`, link: '/time' }).catch(() => {}); }
    toast.success(approved ? 'Hours approved' : 'Hours rejected');
    setReviewModal(null); setReviewNotes(''); reload();
  };

  const handleCorrectionReview = async (approved) => {
    if (!correctionReviewModal) return;
    await reviewCorrectionRequest(correctionReviewModal.id, approved, user?.uid, correctionNotes);
    if (approved && correctionReviewModal.attendanceId && (correctionReviewModal.requestedClockIn || correctionReviewModal.requestedClockOut)) {
      try {
        const cIn = correctionReviewModal.requestedClockIn ? `${correctionReviewModal.date}T${correctionReviewModal.requestedClockIn}:00.000Z` : null;
        const cOut = correctionReviewModal.requestedClockOut ? `${correctionReviewModal.date}T${correctionReviewModal.requestedClockOut}:00.000Z` : null;
        const entries = []; if (cIn) entries.push({ clockIn: cIn, clockOut: cOut || null });
        if (entries.length > 0) {
          const totalHours = entries.reduce((sum, e) => { if (!e.clockIn || !e.clockOut) return sum; return sum + Math.max(0, (new Date(e.clockOut) - new Date(e.clockIn)) / 3600000); }, 0);
          await updateAttendance(correctionReviewModal.attendanceId, { entries, totalHours: Math.round(totalHours * 100) / 100, status: entries.every(e => e.clockOut) ? 'completed' : 'clocked-in', adminNotes: `Corrected via request. ${correctionNotes}`.trim() });
        }
      } catch (e) { /* best-effort */ }
    }
    if (correctionReviewModal.workerId) { await notifyWorker(correctionReviewModal.workerId, orgId, { type: 'correction_response', title: `Correction ${approved ? 'approved' : 'rejected'}`, message: `Your time correction for ${correctionReviewModal.date} has been ${approved ? 'approved' : 'rejected'}. ${correctionNotes ? `Note: ${correctionNotes}` : ''}`, link: '/time' }).catch(() => {}); }
    toast.success(approved ? 'Correction approved' : 'Correction rejected');
    setCorrectionReviewModal(null); setCorrectionNotes(''); reload();
  };

  const handleManagerReply = async (parentMsg) => {
    if (!replyText.trim()) return;
    setSaving(true);
    try {
      await createMessage({ senderId: user?.uid, senderName: user?.displayName || 'Management', senderRole: 'manager', recipientType: 'worker', recipientId: parentMsg.senderId, orgId, subject: `Re: ${parentMsg.subject}`, body: replyText, parentId: parentMsg.id });
      if (parentMsg.senderId) { await notifyWorker(parentMsg.senderId, orgId, { type: 'manager_reply', title: 'Reply from Management', message: replyText.slice(0, 100), link: '/time' }).catch(() => {}); }
      toast.success('Reply sent!'); setReplyText(''); load();
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  // ─── Stats ──────────────────────────
  const clockedIn = attendance.filter(a => a.status === 'clocked-in');
  const completed = attendance.filter(a => a.status === 'completed');
  const pendingApproval = attendance.filter(a => a.approvalStatus === 'pending');
  const pendingPermits = permits.filter(p => p.status === 'pending');
  const pendingCorrections = corrections.filter(c => c.status === 'pending');
  const unreadMessages = messages.filter(m => !m.read && !m.parentId);

  // Calendar month totals
  const monthTotalHours = allAttendance.reduce((s, a) => s + (a.totalHours || 0), 0);
  const monthPending = allAttendance.filter(a => a.approvalStatus === 'pending').length;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Attendance & Leave</h1>
            <p className="text-surface-500 mt-1">Review hours, approve time, manage leave requests.</p>
          </div>
          {isManager && tab === 'calendar' && (
            <button onClick={() => openAddEntry(selectedCalDate)} className="btn-primary !px-3 sm:!px-5">
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Record</span><span className="sm:hidden">Add</span>
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card"><Clock className="w-4 h-4 text-emerald-400" /><p className="text-2xl font-display font-bold">{clockedIn.length}</p><p className="text-xs text-surface-400">Clocked in now</p></div>
          <div className="stat-card"><CheckCircle className="w-4 h-4 text-brand-400" /><p className="text-2xl font-display font-bold">{completed.length}</p><p className="text-xs text-surface-400">Completed today</p></div>
          <div className="stat-card"><AlertTriangle className="w-4 h-4 text-amber-400" /><p className="text-2xl font-display font-bold">{pendingApproval.length}</p><p className="text-xs text-surface-400">Pending approval</p></div>
          <div className="stat-card"><FileCheck className="w-4 h-4 text-purple-400" /><p className="text-2xl font-display font-bold">{pendingPermits.length}</p><p className="text-xs text-surface-400">Pending leave</p></div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-surface-100 rounded-xl p-1 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-1 scrollbar-none">
          {[
            { key: 'calendar', label: 'Calendar', count: monthPending },
            { key: 'hours', label: 'Hours', count: pendingApproval.length },
            { key: 'permits', label: 'Leave', count: pendingPermits.length },
            { key: 'corrections', label: 'Fixes', count: pendingCorrections.length },
            { key: 'messages', label: 'Messages', count: unreadMessages.length },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={cn('flex-1 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap px-2 sm:px-3 min-w-0', tab === t.key ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700')}>
              {t.label}{t.count > 0 ? ` (${t.count})` : ''}
            </button>
          ))}
        </div>

        {/* ═══ CALENDAR TAB ═══ */}
        {tab === 'calendar' && (
          <>
            {/* Calendar nav */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <button onClick={() => setCalDate(new Date(calYear, calMonth - 1, 1))} className="btn-icon !w-8 !h-8 sm:!w-10 sm:!h-10"><ChevronLeft className="w-5 h-5" /></button>
                <h2 className="text-sm sm:text-base font-display font-semibold text-surface-900 min-w-[140px] sm:min-w-[180px] text-center">{navTitle}</h2>
                <button onClick={() => setCalDate(new Date(calYear, calMonth + 1, 1))} className="btn-icon !w-8 !h-8 sm:!w-10 sm:!h-10"><ChevronRight className="w-5 h-5" /></button>
              </div>
              <div className="text-xs sm:text-sm text-surface-500">
                <span className="font-semibold text-surface-700">{monthTotalHours.toFixed(1)}h</span> total
              </div>
            </div>

            {/* Month grid */}
            <div className="card overflow-hidden">
              <div className="grid grid-cols-7 text-center text-[10px] sm:text-xs font-medium text-surface-500 border-b border-surface-100">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="py-1.5 sm:py-2"><span className="hidden sm:inline">{d}</span><span className="sm:hidden">{d[0]}</span></div>)}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.map((d, i) => d ? <CalDayCell key={d} d={d} /> : <div key={`e${i}`} className="h-14 sm:h-[72px] bg-surface-50/50 border-b border-r border-surface-100" />)}
              </div>
            </div>

            {/* Selected day detail */}
            <div className="card">
              <div className="px-4 sm:px-5 py-3 border-b border-surface-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="section-title text-sm">
                    {new Date(selectedCalDate + 'T12:00').toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </h3>
                  <p className="text-xs text-surface-400">{selectedDayRecords.length} record{selectedDayRecords.length !== 1 ? 's' : ''} · {selectedDayRecords.reduce((s, a) => s + (a.totalHours || 0), 0).toFixed(1)}h total</p>
                </div>
                <div className="flex items-center gap-2">
                  <select value={workerFilter} onChange={e => setWorkerFilter(e.target.value)} className="select-field !py-1.5 !text-xs !w-auto">
                    <option value="all">All workers</option>
                    {activeWorkers.map(w => <option key={w.id} value={w.id}>{w.firstName} {w.lastName}</option>)}
                  </select>
                  {isManager && <button onClick={() => openAddEntry(selectedCalDate)} className="btn-primary !py-1.5 !text-xs !px-3"><Plus className="w-3.5 h-3.5" /> Add</button>}
                </div>
              </div>

              <div className="divide-y divide-surface-100">
                {selectedDayRecords.length === 0 && (
                  <div className="p-8 text-center">
                    <Clock className="w-8 h-8 text-surface-200 mx-auto mb-2" />
                    <p className="text-sm text-surface-400">No attendance records for this day.</p>
                    {isManager && <button onClick={() => openAddEntry(selectedCalDate)} className="btn-secondary !py-1.5 !text-xs mt-3"><Plus className="w-3.5 h-3.5" /> Add Record</button>}
                  </div>
                )}
                {selectedDayRecords.map(a => {
                  const entries = a.entries || [];
                  const rate = workerRate(a.workerId);
                  const cost = rate > 0 ? (a.totalHours || 0) * rate : null;
                  return (
                    <div key={a.id} className="px-4 sm:px-5 py-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-surface-800">{workerName(a.workerId)}</p>
                            <span className={cn('badge text-[10px]',
                              a.approvalStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                              a.approvalStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-700'
                            )}>
                              {a.approvalStatus === 'approved' ? 'Approved' : a.approvalStatus === 'rejected' ? 'Rejected' : 'Pending'}
                            </span>
                            {a.status === 'clocked-in' && <span className="badge text-[10px] bg-emerald-100 text-emerald-700">Active</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
                            {shopName(a.shopId) && <span>{shopName(a.shopId)}</span>}
                            <span className="font-semibold text-surface-700">{(a.totalHours || 0).toFixed(1)}h</span>
                            {cost !== null && <span>{formatCurrency(cost)}</span>}
                          </div>
                        </div>
                        {isManager && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {a.approvalStatus === 'pending' && (
                              <>
                                <button onClick={() => handleQuickApprove(a)} className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors" title="Approve"><CheckCircle className="w-4 h-4" /></button>
                                <button onClick={() => handleQuickReject(a)} className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors" title="Reject"><XCircle className="w-4 h-4" /></button>
                              </>
                            )}
                            <button onClick={() => openEditEntry(a)} className="p-1.5 rounded-lg bg-surface-100 text-surface-600 hover:bg-surface-200 transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteRecord(a.id)} className="p-1.5 rounded-lg bg-surface-100 text-surface-600 hover:bg-red-100 hover:text-red-600 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        )}
                      </div>
                      {/* Time entries */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {entries.map((e, i) => (
                          <span key={i} className={cn('text-xs rounded px-2 py-1', e.clockOut ? 'bg-surface-100 text-surface-600' : 'bg-emerald-50 text-emerald-700 border border-emerald-200')}>
                            {e.clockIn?.slice(11, 16) || '—'} → {e.clockOut?.slice(11, 16) || 'active'}
                          </span>
                        ))}
                      </div>
                      {a.adminNotes && <p className="text-xs text-surface-400 mt-1.5 italic">{a.adminNotes}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ═══ HOURS TAB ═══ */}
        {tab === 'hours' && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="input-field max-w-[180px]" />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select-field max-w-[160px]">
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              {isManager && <button onClick={() => openAddEntry(dateFilter)} className="btn-primary !py-2 !text-sm"><Plus className="w-4 h-4" /> Add Record</button>}
            </div>
            <div className="card">
              <div className="px-5 py-3 border-b border-surface-100 flex items-center justify-between">
                <h3 className="section-title text-sm">Clock Records — {dateFilter}</h3>
                <span className="text-xs text-surface-400">{attendance.length} records</span>
              </div>
              <div className="divide-y divide-surface-100">
                {attendance.length === 0 && <p className="p-6 text-sm text-surface-400 text-center">No records for this date and filter.</p>}
                {attendance.map(a => {
                  const entries = a.entries || [];
                  const rate = workerRate(a.workerId);
                  const cost = rate > 0 ? (a.totalHours || 0) * rate : null;
                  return (
                    <div key={a.id} className="px-4 sm:px-5 py-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-surface-800 truncate">{workerName(a.workerId)}</p>
                          <p className="text-xs text-surface-400 truncate">{shopName(a.shopId)}</p>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                          <span className="text-sm font-semibold text-surface-700">{(a.totalHours || 0).toFixed(1)}h</span>
                          {cost !== null && <span className="text-xs text-surface-400 hidden sm:inline">{formatCurrency(cost)}</span>}
                          <span className={cn('badge text-[10px]', a.approvalStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' : a.approvalStatus === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                            {a.approvalStatus === 'approved' ? 'Approved' : a.approvalStatus === 'rejected' ? 'Rejected' : 'Pending'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {entries.map((e, i) => (
                          <span key={i} className="text-xs bg-surface-100 text-surface-600 rounded px-2 py-1">{e.clockIn?.slice(11, 16) || '—'} → {e.clockOut?.slice(11, 16) || 'active'}</span>
                        ))}
                      </div>
                      {isManager && (
                        <div className="flex gap-2 mt-3">
                          {a.approvalStatus !== 'approved' && (
                            <>
                              <button onClick={() => { setReviewModal(a); setReviewNotes(''); }} className="btn-secondary !py-1.5 !px-3 !text-xs"><MessageSquare className="w-3.5 h-3.5" /> Review</button>
                              <button onClick={() => handleQuickApprove(a)} className="btn-primary !py-1.5 !px-3 !text-xs"><CheckCircle className="w-3.5 h-3.5" /> Approve</button>
                            </>
                          )}
                          <button onClick={() => openEditEntry(a)} className="btn-secondary !py-1.5 !px-3 !text-xs"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                          <button onClick={() => handleDeleteRecord(a.id)} className="btn-secondary !py-1.5 !px-3 !text-xs hover:!text-red-600"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ═══ PERMITS TAB ═══ */}
        {tab === 'permits' && (
          <div className="space-y-4">
            {permits.length === 0 && <div className="card p-8 text-center"><FileCheck className="w-8 h-8 text-surface-300 mx-auto mb-2" /><p className="text-surface-400 text-sm">No leave requests.</p></div>}
            {permits.map(p => (
              <div key={p.id} className={cn('card p-5', p.status === 'pending' ? 'border-amber-200' : '')}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-surface-800">{p.workerName || workerName(p.workerId)}</p>
                      <span className={cn('badge capitalize', p.type === 'holiday' ? 'bg-blue-100 text-blue-700' : p.type === 'sick' ? 'bg-red-100 text-red-700' : 'bg-surface-100 text-surface-600')}>{p.type}</span>
                      <span className={cn('badge capitalize', p.status === 'pending' ? 'bg-amber-100 text-amber-700' : p.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>{p.status}</span>
                    </div>
                    <p className="text-sm text-surface-500 mt-1"><Calendar className="w-3.5 h-3.5 inline mr-1" />{p.startDate}{p.endDate && p.endDate !== p.startDate ? ` → ${p.endDate}` : ''}</p>
                    {p.reason && <p className="text-sm text-surface-500 mt-1 italic">"{p.reason}"</p>}
                  </div>
                  {isManager && p.status === 'pending' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => handlePermitAction(p.id, 'approved')} className="btn-primary !py-2 !px-4 !text-sm"><CheckCircle className="w-4 h-4" /> Approve</button>
                      <button onClick={() => handlePermitAction(p.id, 'denied')} className="btn-danger !py-2 !px-4 !text-sm"><XCircle className="w-4 h-4" /> Deny</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ CORRECTIONS TAB ═══ */}
        {tab === 'corrections' && (
          <div className="space-y-3">
            {corrections.length === 0 && <div className="card p-8 text-center"><AlertTriangle className="w-8 h-8 text-surface-300 mx-auto mb-2" /><p className="text-surface-400 text-sm">No correction requests.</p></div>}
            {corrections.map(c => (
              <div key={c.id} className={cn('card p-5', c.status === 'pending' ? 'border-amber-200' : '')}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-surface-800">{c.workerName || workerName(c.workerId)}</p>
                      <span className={cn('badge text-[10px] capitalize', c.type === 'missed_clockin' ? 'bg-orange-100 text-orange-700' : c.type === 'missed_clockout' ? 'bg-red-100 text-red-700' : c.type === 'wrong_hours' ? 'bg-purple-100 text-purple-700' : 'bg-surface-100 text-surface-600')}>{c.type.replace(/_/g, ' ')}</span>
                      <span className={cn('badge text-[10px] capitalize', c.status === 'pending' ? 'bg-amber-100 text-amber-700' : c.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>{c.status}</span>
                    </div>
                    <p className="text-sm text-surface-500 mt-1"><Calendar className="w-3.5 h-3.5 inline mr-1" />{c.date}</p>
                    {c.requestedClockIn && <p className="text-sm text-surface-500 mt-0.5">Requested: {c.requestedClockIn} → {c.requestedClockOut || '—'}</p>}
                    <p className="text-sm text-surface-600 mt-1 italic">"{c.message}"</p>
                    {c.adminNotes && <p className="text-xs text-brand-600 mt-1">Response: {c.adminNotes}</p>}
                  </div>
                  {isManager && c.status === 'pending' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => { setCorrectionReviewModal(c); setCorrectionNotes(''); }} className="btn-secondary !py-2 !px-3 !text-sm"><MessageSquare className="w-4 h-4" /> Review</button>
                      <button onClick={async () => { await reviewCorrectionRequest(c.id, true, user?.uid, ''); if (c.workerId) { await notifyWorker(c.workerId, orgId, { type: 'correction_response', title: 'Correction approved', message: `Your time correction for ${c.date} has been approved.`, link: '/time' }).catch(() => {}); } toast.success('Approved'); reload(); }} className="btn-primary !py-2 !px-3 !text-sm"><CheckCircle className="w-4 h-4" /> Approve</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ MESSAGES TAB ═══ */}
        {tab === 'messages' && (
          <div className="space-y-3">
            {messages.filter(m => !m.parentId).length === 0 && <div className="card p-8 text-center"><MessageSquare className="w-8 h-8 text-surface-300 mx-auto mb-2" /><p className="text-surface-400 text-sm">No messages from workers.</p></div>}
            {messages.filter(m => !m.parentId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map(m => (
              <div key={m.id} className={cn('card overflow-hidden', !m.read ? 'border-brand-200' : '')}>
                {!m.read && <div className="h-0.5 bg-brand-500" />}
                <div className="p-5">
                  <div className="flex items-start justify-between cursor-pointer" onClick={() => { setExpandedMsg(expandedMsg === m.id ? null : m.id); if (!m.read) markMessageRead(m.id).then(load); }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {!m.read && <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />}
                        <p className={cn('text-sm', !m.read ? 'font-semibold text-surface-900' : 'font-medium text-surface-700')}>{m.subject}</p>
                      </div>
                      <p className="text-xs text-surface-400 mt-0.5">From: {m.senderName || workerName(m.senderId)} · {m.createdAt?.slice(0, 16).replace('T', ' ')}</p>
                    </div>
                    {expandedMsg === m.id ? <ChevronUp className="w-4 h-4 text-surface-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-surface-400 flex-shrink-0" />}
                  </div>
                  {expandedMsg === m.id && (
                    <div className="mt-3 space-y-2">
                      <div className="p-3 bg-surface-50 rounded-xl text-sm"><p className="whitespace-pre-wrap text-surface-700">{m.body}</p></div>
                      {messages.filter(r => r.parentId === m.id).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map(r => (
                        <div key={r.id} className={cn('p-3 rounded-xl text-sm ml-4', r.senderRole === 'worker' ? 'bg-surface-50' : 'bg-brand-50')}>
                          <p className="text-[10px] text-surface-400 mb-1">{r.senderRole === 'worker' ? r.senderName : 'You (Management)'} · {r.createdAt?.slice(0, 16).replace('T', ' ')}</p>
                          <p className="whitespace-pre-wrap text-surface-700">{r.body}</p>
                        </div>
                      ))}
                      <div className="flex gap-2 ml-4">
                        <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Reply to this worker..." className="input-field flex-1 !py-2 text-sm" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleManagerReply(m); } }} />
                        <button onClick={() => handleManagerReply(m)} disabled={saving || !replyText.trim()} className="btn-primary !py-2 !px-3"><Send className="w-4 h-4" /></button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── Review Modal ─── */}
        <Modal open={!!reviewModal} onClose={() => setReviewModal(null)} title="Review Hours">
          {reviewModal && (
            <div className="space-y-4">
              <div className="p-4 bg-surface-50 rounded-xl">
                <p className="text-sm font-medium text-surface-800">{workerName(reviewModal.workerId)}</p>
                <p className="text-xs text-surface-500">{reviewModal.date} · {shopName(reviewModal.shopId)}</p>
                <p className="text-lg font-display font-bold mt-2">{(reviewModal.totalHours || 0).toFixed(1)} hours</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(reviewModal.entries || []).map((e, i) => (
                    <span key={i} className="text-xs bg-white text-surface-600 rounded px-2 py-1 border border-surface-200">{e.clockIn?.slice(11, 16)} → {e.clockOut?.slice(11, 16) || '...'}</span>
                  ))}
                </div>
              </div>
              <div><label className="label">Notes (optional)</label><textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={2} className="input-field resize-none" placeholder="Add a note for the worker..." /></div>
              <div className="flex gap-3">
                <button onClick={() => handleApproveHours(true)} className="btn-primary flex-1"><CheckCircle className="w-4 h-4" /> Approve</button>
                <button onClick={() => handleApproveHours(false)} className="btn-danger flex-1"><XCircle className="w-4 h-4" /> Reject</button>
              </div>
            </div>
          )}
        </Modal>

        {/* ─── Correction Review Modal ─── */}
        <Modal open={!!correctionReviewModal} onClose={() => setCorrectionReviewModal(null)} title="Review Correction Request">
          {correctionReviewModal && (
            <div className="space-y-4">
              <div className="p-4 bg-surface-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm font-medium text-surface-800">{correctionReviewModal.workerName || workerName(correctionReviewModal.workerId)}</p>
                  <span className={cn('badge text-[10px] capitalize', correctionReviewModal.type === 'missed_clockin' ? 'bg-orange-100 text-orange-700' : correctionReviewModal.type === 'missed_clockout' ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700')}>{correctionReviewModal.type.replace(/_/g, ' ')}</span>
                </div>
                <p className="text-xs text-surface-500">Date: {correctionReviewModal.date}</p>
                {correctionReviewModal.requestedClockIn && <p className="text-xs text-surface-500">Requested: {correctionReviewModal.requestedClockIn} → {correctionReviewModal.requestedClockOut || '—'}</p>}
                <p className="text-sm text-surface-700 mt-2 italic">"{correctionReviewModal.message}"</p>
              </div>
              <div><label className="label">Response Notes (optional)</label><textarea value={correctionNotes} onChange={e => setCorrectionNotes(e.target.value)} rows={2} className="input-field resize-none" placeholder="Add a note for the worker..." /></div>
              <div className="flex gap-3">
                <button onClick={() => handleCorrectionReview(true)} className="btn-primary flex-1"><CheckCircle className="w-4 h-4" /> Approve & Fix</button>
                <button onClick={() => handleCorrectionReview(false)} className="btn-danger flex-1"><XCircle className="w-4 h-4" /> Reject</button>
              </div>
            </div>
          )}
        </Modal>

        {/* ─── Add/Edit Attendance Modal ─── */}
        <Modal open={showEntryModal} onClose={() => setShowEntryModal(false)} title={editRecord ? 'Edit Attendance Record' : 'Add Attendance Record'} size="lg">
          <form onSubmit={handleSaveEntry} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Worker *</label>
                <select value={entryForm.workerId} onChange={e => setEntryForm(f => ({ ...f, workerId: e.target.value }))} className="select-field" required>
                  <option value="">Select worker...</option>
                  {activeWorkers.map(w => <option key={w.id} value={w.id}>{w.firstName} {w.lastName}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Date *</label>
                <input type="date" value={entryForm.date} onChange={e => setEntryForm(f => ({ ...f, date: e.target.value }))} className="input-field" required />
              </div>
            </div>
            <div>
              <label className="label">Shop</label>
              <select value={entryForm.shopId} onChange={e => setEntryForm(f => ({ ...f, shopId: e.target.value }))} className="select-field">
                <option value="">No shop</option>
                {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Time entries */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label !mb-0">Clock In/Out Entries *</label>
                <button type="button" onClick={addEntryRow} className="text-xs text-brand-600 hover:text-brand-700 font-medium">+ Add segment</button>
              </div>
              <div className="space-y-2">
                {entryForm.entries.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-3 bg-surface-50 rounded-xl">
                    <div className="flex-1">
                      <label className="text-[10px] text-surface-400 font-medium">Clock In</label>
                      <input type="time" value={entry.clockIn} onChange={e => updateEntryRow(idx, 'clockIn', e.target.value)} className="input-field !py-1.5 text-sm" required />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-surface-400 font-medium">Clock Out</label>
                      <input type="time" value={entry.clockOut} onChange={e => updateEntryRow(idx, 'clockOut', e.target.value)} className="input-field !py-1.5 text-sm" />
                    </div>
                    {entryForm.entries.length > 1 && (
                      <button type="button" onClick={() => removeEntryRow(idx)} className="p-1.5 text-surface-400 hover:text-red-500 transition-colors mt-4"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                ))}
              </div>
              {/* Calculated hours preview */}
              {entryForm.entries.some(e => e.clockIn && e.clockOut) && (
                <p className="text-xs text-surface-500 mt-2">
                  Total: <strong>{entryForm.entries.reduce((sum, e) => {
                    if (!e.clockIn || !e.clockOut) return sum;
                    const [sh, sm] = e.clockIn.split(':').map(Number);
                    const [eh, em] = e.clockOut.split(':').map(Number);
                    let h = (eh + em / 60) - (sh + sm / 60); if (h < 0) h += 24;
                    return sum + h;
                  }, 0).toFixed(1)}h</strong>
                </p>
              )}
            </div>

            <div>
              <label className="label">Admin Notes</label>
              <textarea value={entryForm.adminNotes} onChange={e => setEntryForm(f => ({ ...f, adminNotes: e.target.value }))} rows={2} className="input-field resize-none" placeholder="Optional notes..." />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowEntryModal(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={savingEntry} className="btn-primary">{savingEntry ? 'Saving...' : editRecord ? 'Update Record' : 'Create Record'}</button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}
