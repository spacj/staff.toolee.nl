'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { getAttendance, getActiveClockIn, clockIn, clockOut, getPermits, createPermit, getShops, getWorkers, getWorker, notifyManagers, getCorrectionRequests, createCorrectionRequest, getMessages, createMessage, markMessageRead } from '@/lib/firestore';
import { formatCurrency } from '@/lib/pricing';
import { cn } from '@/utils/helpers';
import { Clock, Play, Square, Calendar, FileCheck, Plus, BarChart3, AlertCircle, DollarSign, CheckCircle, Pause, AlertTriangle, MessageCircle, Send, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TimePage() {
  const { user, userProfile, orgId } = useAuth();
  const [active, setActive] = useState(null);
  const [records, setRecords] = useState([]);
  const [permits, setPermits] = useState([]);
  const [shops, setShops] = useState([]);
  const [workerData, setWorkerData] = useState(null);
  const [showPermitForm, setShowPermitForm] = useState(false);
  const [permitForm, setPermitForm] = useState({ type: 'holiday', startDate: '', endDate: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [resolvedWorkerId, setResolvedWorkerId] = useState(null);

  // Correction requests
  const [corrections, setCorrections] = useState([]);
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({ type: 'missed_clockin', date: '', requestedClockIn: '', requestedClockOut: '', message: '', attendanceId: '' });

  // Messages
  const [messages, setMessages] = useState([]);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [messageForm, setMessageForm] = useState({ subject: '', body: '' });
  const [expandedMsg, setExpandedMsg] = useState(null);
  const [replyText, setReplyText] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.slice(0, 7) + '-01';

  const resolveWorkerId = useCallback(async () => {
    if (!user || !orgId) return null;
    if (userProfile?.workerId) return userProfile.workerId;
    try {
      const allWorkers = await getWorkers({ orgId });
      const match = allWorkers.find(w => w.email === userProfile?.email && w.status === 'active');
      if (match) return match.id;
    } catch (e) {}
    return user.uid;
  }, [user, userProfile, orgId]);

  useEffect(() => { resolveWorkerId().then(id => { if (id) setResolvedWorkerId(id); }); }, [resolveWorkerId]);

  const load = useCallback(() => {
    if (!resolvedWorkerId || !orgId) return;
    getActiveClockIn(resolvedWorkerId, today).then(setActive).catch(() => setActive(null));
    getAttendance({ workerId: resolvedWorkerId, startDate: monthStart, endDate: today, limit: 100 }).then(setRecords).catch(() => setRecords([]));
    getPermits({ workerId: resolvedWorkerId, limit: 20 }).then(setPermits).catch(() => setPermits([]));
    getShops(orgId).then(setShops);
    getWorker(resolvedWorkerId).then(setWorkerData).catch(() => {});
    getCorrectionRequests({ orgId, workerId: resolvedWorkerId, limit: 50 }).then(setCorrections).catch(() => setCorrections([]));
    // Get all org messages, then filter to those relevant to this worker
    getMessages({ orgId, limit: 100 }).then(all => {
      const mine = all.filter(m => m.senderId === resolvedWorkerId || m.recipientId === resolvedWorkerId);
      setMessages(mine);
    }).catch(() => setMessages([]));
  }, [resolvedWorkerId, orgId, today, monthStart]);

  useEffect(() => { load(); }, [load]);

  const handleClockIn = async () => {
    if (!resolvedWorkerId) { toast.error('No worker profile linked.'); return; }
    try {
      await clockIn({ workerId: resolvedWorkerId, workerName: userProfile?.displayName || '', orgId, date: today, shopId: shops[0]?.id || '' });
      toast.success('Clocked in!');
      load();
    } catch (err) { toast.error(err.message || 'Failed to clock in'); }
  };

  const handleClockOut = async () => {
    if (!active) return;
    try {
      await clockOut(active.id);
      toast.success('Clocked out!');
      load();
    } catch (err) { toast.error(err.message || 'Failed to clock out'); }
  };

  const handlePermitSubmit = async (e) => {
    e.preventDefault();
    if (!permitForm.startDate) { toast.error('Start date required'); return; }
    setSaving(true);
    try {
      await createPermit({
        ...permitForm, endDate: permitForm.endDate || permitForm.startDate,
        workerId: resolvedWorkerId, workerName: userProfile?.displayName || '', orgId,
      });
      // Notify managers
      await notifyManagers(orgId, {
        type: 'permit_request', title: 'Leave Request',
        message: `${userProfile?.displayName} requested ${permitForm.type} (${permitForm.startDate})`,
        link: '/attendance',
      }).catch(() => {});
      toast.success('Request submitted!');
      setShowPermitForm(false);
      setPermitForm({ type: 'holiday', startDate: '', endDate: '', reason: '' });
      load();
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  // ─── Correction Request ─────────────────
  const openCorrectionFor = (record) => {
    setCorrectionForm({
      type: 'wrong_hours',
      date: record?.date || today,
      requestedClockIn: record?.entries?.[0]?.clockIn?.slice(11, 16) || '',
      requestedClockOut: record?.entries?.[record.entries.length - 1]?.clockOut?.slice(11, 16) || '',
      message: '',
      attendanceId: record?.id || '',
    });
    setShowCorrectionForm(true);
  };

  const handleCorrectionSubmit = async (e) => {
    e.preventDefault();
    if (!correctionForm.date) { toast.error('Date is required'); return; }
    if (!correctionForm.message) { toast.error('Please describe the issue'); return; }
    setSaving(true);
    try {
      await createCorrectionRequest({
        ...correctionForm, workerId: resolvedWorkerId,
        workerName: userProfile?.displayName || `${workerData?.firstName || ''} ${workerData?.lastName || ''}`.trim(),
        orgId,
      });
      await notifyManagers(orgId, {
        type: 'correction_request', title: 'Time Correction Request',
        message: `${userProfile?.displayName || 'A worker'} submitted a ${correctionForm.type.replace(/_/g, ' ')} correction for ${correctionForm.date}`,
        link: '/attendance',
      }).catch(() => {});
      toast.success('Correction request submitted!');
      setShowCorrectionForm(false);
      setCorrectionForm({ type: 'missed_clockin', date: '', requestedClockIn: '', requestedClockOut: '', message: '', attendanceId: '' });
      load();
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  // ─── Messages ─────────────────────────
  const handleMessageSubmit = async (e) => {
    e.preventDefault();
    if (!messageForm.subject || !messageForm.body) { toast.error('Subject and message are required'); return; }
    setSaving(true);
    try {
      await createMessage({
        senderId: resolvedWorkerId,
        senderName: userProfile?.displayName || `${workerData?.firstName || ''} ${workerData?.lastName || ''}`.trim(),
        senderRole: 'worker',
        recipientType: 'management',
        orgId,
        subject: messageForm.subject,
        body: messageForm.body,
      });
      await notifyManagers(orgId, {
        type: 'worker_message', title: 'New Message from Worker',
        message: `${userProfile?.displayName || 'A worker'}: ${messageForm.subject}`,
        link: '/attendance',
      }).catch(() => {});
      toast.success('Message sent!');
      setShowMessageForm(false);
      setMessageForm({ subject: '', body: '' });
      load();
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  const handleReply = async (parentId) => {
    if (!replyText.trim()) return;
    setSaving(true);
    try {
      await createMessage({
        senderId: resolvedWorkerId,
        senderName: userProfile?.displayName || `${workerData?.firstName || ''} ${workerData?.lastName || ''}`.trim(),
        senderRole: 'worker',
        recipientType: 'management',
        orgId,
        subject: 'Re: reply',
        body: replyText,
        parentId,
      });
      toast.success('Reply sent!');
      setReplyText('');
      load();
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  // Calculate totals
  const approvedRecords = records.filter(r => r.approvalStatus === 'approved');
  const completedRecords = records.filter(r => r.status === 'completed' || r.entries?.every(e => e.clockOut));
  const totalHours = useMemo(() => records.reduce((sum, r) => sum + (r.totalHours || 0), 0), [records]);
  const approvedHours = useMemo(() => approvedRecords.reduce((sum, r) => sum + (r.totalHours || 0), 0), [approvedRecords]);

  // Expected earnings
  const expectedEarnings = useMemo(() => {
    if (!workerData) return null;
    if (workerData.payType === 'salaried') {
      return { type: 'salaried', monthly: workerData.monthlySalary || 0, label: 'Monthly Salary' };
    }
    const rate = workerData.costPerHour || 0;
    return { type: 'hourly', earned: Math.round(totalHours * rate * 100) / 100, approved: Math.round(approvedHours * rate * 100) / 100, rate, label: `${totalHours.toFixed(1)}h × ${formatCurrency(rate)}` };
  }, [workerData, totalHours, approvedHours]);

  // Check if currently clocked in (has open entry)
  const isCurrentlyIn = active?.entries?.some(e => !e.clockOut);

  if (!resolvedWorkerId) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="w-10 h-10 text-amber-400 mb-3" />
          <h2 className="text-lg font-display font-semibold text-surface-800">No worker profile linked</h2>
          <p className="text-sm text-surface-500 mt-1 max-w-sm">Ask your admin to create a worker record for you or register with an invite code at <strong>/join</strong>.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">My Time</h1>
            <p className="text-surface-500 mt-1">Clock in/out, track your hours, and manage leave.</p>
          </div>
        </div>

        {/* Clock In/Out */}
        <div className={cn('card overflow-hidden', isCurrentlyIn ? 'border-emerald-200' : '')}>
          {isCurrentlyIn && <div className="h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />}
          <div className="p-8 text-center">
            <div className={cn('w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg',
              isCurrentlyIn ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/25' : 'bg-gradient-to-br from-surface-200 to-surface-300'
            )}>
              <Clock className={cn('w-12 h-12', isCurrentlyIn ? 'text-white' : 'text-surface-500')} />
            </div>
          {isCurrentlyIn ? (
            <>
              <p className="text-xl font-display font-bold text-emerald-800">You're clocked in</p>
              <p className="text-sm text-emerald-600 mt-1.5">Since {active.entries?.filter(e => !e.clockOut)?.[0]?.clockIn?.slice(11, 16) || '—'}</p>
              {active.entries?.filter(e => e.clockOut).length > 0 && (
                <p className="text-xs text-emerald-500 mt-1">{active.entries.filter(e => e.clockOut).length} previous segment(s) today</p>
              )}
              <button onClick={handleClockOut} className="btn-danger mt-6 !py-3.5 !px-10 !text-base"><Square className="w-5 h-5" /> Clock Out</button>
            </>
          ) : (
            <>
              <p className="text-lg font-display font-bold text-surface-800">
                {active?.entries?.length > 0 ? 'On break — Clock back in?' : 'Ready to start?'}
              </p>
              <p className="text-sm text-surface-500 mt-1">{today}</p>
              {active?.entries?.length > 0 && (
                <p className="text-xs text-surface-400 mt-1">{active.entries.length} segment(s) logged today · {(active.totalHours || 0).toFixed(1)}h so far</p>
              )}
              <button onClick={handleClockIn} className="btn-primary mt-6 !py-3.5 !px-10 !text-base !shadow-lg !shadow-brand-500/20"><Play className="w-5 h-5" /> Clock In</button>
            </>
          )}
          </div>
        </div>

        {/* Stats + Earnings */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card"><BarChart3 className="w-4 h-4 text-brand-400" /><p className="text-2xl font-display font-bold">{totalHours.toFixed(1)}h</p><p className="text-xs text-surface-400">Total this month</p></div>
          <div className="stat-card"><CheckCircle className="w-4 h-4 text-emerald-400" /><p className="text-2xl font-display font-bold">{approvedHours.toFixed(1)}h</p><p className="text-xs text-surface-400">Approved hours</p></div>
          <div className="stat-card"><Calendar className="w-4 h-4 text-purple-400" /><p className="text-2xl font-display font-bold">{completedRecords.length}</p><p className="text-xs text-surface-400">Days worked</p></div>
          <div className="stat-card">
            <DollarSign className="w-4 h-4 text-amber-400" />
            <p className="text-2xl font-display font-bold">
              {expectedEarnings?.type === 'salaried' ? formatCurrency(expectedEarnings.monthly) : expectedEarnings ? formatCurrency(expectedEarnings.earned) : '—'}
            </p>
            <p className="text-xs text-surface-400">{expectedEarnings?.type === 'salaried' ? 'Monthly salary' : 'Expected earnings'}</p>
          </div>
        </div>

        {/* Earnings detail */}
        {expectedEarnings && expectedEarnings.type === 'hourly' && (
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-sm font-medium text-surface-800">Expected: {formatCurrency(expectedEarnings.earned)} · Approved: {formatCurrency(expectedEarnings.approved)}</p>
                <p className="text-xs text-surface-400">{expectedEarnings.label} · Pending hours may change after manager approval</p>
              </div>
            </div>
          </div>
        )}

        {/* Leave Requests */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Leave Requests</h3>
            <button onClick={() => setShowPermitForm(true)} className="btn-secondary !py-2 !text-sm"><Plus className="w-4 h-4" /> Request Leave</button>
          </div>
          <div className="divide-y divide-surface-100">
            {permits.length === 0 && <p className="py-4 text-sm text-surface-400 text-center">No leave requests yet.</p>}
            {permits.map(p => (
              <div key={p.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={cn('badge capitalize', p.type === 'holiday' ? 'bg-blue-100 text-blue-700' : p.type === 'sick' ? 'bg-red-100 text-red-700' : 'bg-surface-100 text-surface-600')}>{p.type}</span>
                    <span className="text-sm text-surface-700">{p.startDate}{p.endDate !== p.startDate ? ` → ${p.endDate}` : ''}</span>
                  </div>
                  {p.reason && <p className="text-xs text-surface-400 mt-0.5 italic">{p.reason}</p>}
                </div>
                <span className={cn('badge capitalize', p.status === 'pending' ? 'bg-amber-100 text-amber-700' : p.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>{p.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Correction Requests */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Time Corrections</h3>
            <button onClick={() => { setCorrectionForm({ type: 'missed_clockin', date: '', requestedClockIn: '', requestedClockOut: '', message: '', attendanceId: '' }); setShowCorrectionForm(true); }} className="btn-secondary !py-2 !text-sm"><AlertTriangle className="w-4 h-4" /> Report Issue</button>
          </div>
          <p className="text-xs text-surface-400 mb-3">Forgot to clock in/out or hours are wrong? Submit a correction request for management to review.</p>
          <div className="divide-y divide-surface-100">
            {corrections.length === 0 && <p className="py-4 text-sm text-surface-400 text-center">No correction requests.</p>}
            {corrections.map(c => (
              <div key={c.id} className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn('badge text-[10px] capitalize', c.type === 'missed_clockin' ? 'bg-orange-100 text-orange-700' : c.type === 'missed_clockout' ? 'bg-red-100 text-red-700' : c.type === 'wrong_hours' ? 'bg-purple-100 text-purple-700' : 'bg-surface-100 text-surface-600')}>{c.type.replace(/_/g, ' ')}</span>
                    <span className="text-sm text-surface-700">{c.date}</span>
                  </div>
                  <span className={cn('badge text-[10px] capitalize', c.status === 'pending' ? 'bg-amber-100 text-amber-700' : c.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>{c.status}</span>
                </div>
                <p className="text-xs text-surface-500 mt-1">{c.message}</p>
                {c.requestedClockIn && <p className="text-xs text-surface-400 mt-0.5">Requested: {c.requestedClockIn} → {c.requestedClockOut || '—'}</p>}
                {c.adminNotes && <p className="text-xs text-brand-600 mt-0.5 italic">Manager: {c.adminNotes}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Messages to Management */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Messages</h3>
            <button onClick={() => setShowMessageForm(true)} className="btn-secondary !py-2 !text-sm"><MessageCircle className="w-4 h-4" /> New Message</button>
          </div>
          <p className="text-xs text-surface-400 mb-3">Send a message to management about schedule changes, shift swaps, or any work-related questions.</p>
          <div className="divide-y divide-surface-100">
            {messages.length === 0 && <p className="py-4 text-sm text-surface-400 text-center">No messages yet.</p>}
            {messages.filter(m => !m.parentId).map(m => (
              <div key={m.id} className="py-3">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => { setExpandedMsg(expandedMsg === m.id ? null : m.id); if (!m.read && m.recipientId === resolvedWorkerId) markMessageRead(m.id); }}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {!m.read && m.recipientId === resolvedWorkerId && <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />}
                    <span className={cn('text-sm truncate', !m.read && m.recipientId === resolvedWorkerId ? 'font-semibold text-surface-900' : 'text-surface-700')}>{m.subject}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-[10px] text-surface-400">{m.senderRole === 'worker' ? 'You' : m.senderName}</span>
                    {expandedMsg === m.id ? <ChevronUp className="w-3.5 h-3.5 text-surface-400" /> : <ChevronDown className="w-3.5 h-3.5 text-surface-400" />}
                  </div>
                </div>
                {expandedMsg === m.id && (
                  <div className="mt-2 space-y-2">
                    <div className={cn('p-3 rounded-xl text-sm', m.senderRole === 'worker' ? 'bg-brand-50 text-surface-700' : 'bg-surface-50 text-surface-700')}>
                      <p className="text-[10px] text-surface-400 mb-1">{m.senderRole === 'worker' ? 'You' : m.senderName} · {m.createdAt?.slice(0, 16).replace('T', ' ')}</p>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </div>
                    {/* Show replies */}
                    {messages.filter(r => r.parentId === m.id).map(r => (
                      <div key={r.id} className={cn('p-3 rounded-xl text-sm', r.senderRole === 'worker' ? 'bg-brand-50 text-surface-700 ml-4' : 'bg-emerald-50 text-surface-700 ml-4')}>
                        <p className="text-[10px] text-surface-400 mb-1">{r.senderRole === 'worker' ? 'You' : r.senderName} · {r.createdAt?.slice(0, 16).replace('T', ' ')}</p>
                        <p className="whitespace-pre-wrap">{r.body}</p>
                      </div>
                    ))}
                    {/* Reply input */}
                    <div className="flex gap-2 ml-4">
                      <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Type a reply..." className="input-field flex-1 !py-2 text-sm" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(m.id); } }} />
                      <button onClick={() => handleReply(m.id)} disabled={saving || !replyText.trim()} className="btn-primary !py-2 !px-3"><Send className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Attendance Records */}
        <div className="card">
          <div className="px-5 py-4 border-b border-surface-100"><h3 className="section-title">Clock Records This Month</h3></div>
          <div className="divide-y divide-surface-100">
            {records.length === 0 && <p className="p-5 text-sm text-surface-400 text-center">No records this month.</p>}
            {records.slice(0, 20).map(r => {
              const entries = r.entries || [];
              return (
                <div key={r.id} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-surface-700">{r.date}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-surface-600">{(r.totalHours || 0).toFixed(1)}h</span>
                      <span className={cn('badge text-[10px]',
                        r.approvalStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        r.approvalStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      )}>
                        {r.approvalStatus === 'approved' ? 'Approved' : r.approvalStatus === 'rejected' ? 'Rejected' : 'Pending'}
                      </span>
                      <button onClick={() => openCorrectionFor(r)} className="text-[10px] text-brand-600 hover:text-brand-700 font-medium hover:underline">Report issue</button>
                    </div>
                  </div>
                  {/* Show all segments */}
                  <div className="flex flex-wrap gap-2 mt-1">
                    {entries.map((e, i) => (
                      <span key={i} className="text-xs bg-surface-100 text-surface-600 rounded px-2 py-0.5">
                        {e.clockIn?.slice(11, 16) || '—'} → {e.clockOut?.slice(11, 16) || '...'}
                      </span>
                    ))}
                  </div>
                  {r.adminNotes && <p className="text-xs text-surface-400 mt-1 italic">Note: {r.adminNotes}</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Permit form modal */}
        <Modal open={showPermitForm} onClose={() => setShowPermitForm(false)} title="Request Leave">
          <form onSubmit={handlePermitSubmit} className="space-y-4">
            <div><label className="label">Leave Type *</label>
              <select value={permitForm.type} onChange={e => setPermitForm(f => ({ ...f, type: e.target.value }))} className="select-field">
                <option value="holiday">Holiday / Vacation</option><option value="sick">Sick Leave</option><option value="personal">Personal Day</option><option value="other">Other</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Start Date *</label><input type="date" value={permitForm.startDate} onChange={e => setPermitForm(f => ({ ...f, startDate: e.target.value }))} className="input-field" required /></div>
              <div><label className="label">End Date</label><input type="date" value={permitForm.endDate} onChange={e => setPermitForm(f => ({ ...f, endDate: e.target.value }))} className="input-field" /></div>
            </div>
            <div><label className="label">Reason</label><textarea value={permitForm.reason} onChange={e => setPermitForm(f => ({ ...f, reason: e.target.value }))} rows={2} className="input-field resize-none" placeholder="Optional" /></div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowPermitForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Submitting...' : 'Submit Request'}</button>
            </div>
          </form>
        </Modal>

        {/* Correction Request Modal */}
        <Modal open={showCorrectionForm} onClose={() => setShowCorrectionForm(false)} title="Report Time Issue">
          <form onSubmit={handleCorrectionSubmit} className="space-y-4">
            <div><label className="label">Issue Type *</label>
              <select value={correctionForm.type} onChange={e => setCorrectionForm(f => ({ ...f, type: e.target.value }))} className="select-field">
                <option value="missed_clockin">Forgot to clock in</option>
                <option value="missed_clockout">Forgot to clock out</option>
                <option value="wrong_hours">Hours are incorrect</option>
                <option value="other">Other issue</option>
              </select>
            </div>
            <div><label className="label">Date *</label>
              <input type="date" value={correctionForm.date} onChange={e => setCorrectionForm(f => ({ ...f, date: e.target.value }))} className="input-field" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Correct Clock In</label><input type="time" value={correctionForm.requestedClockIn} onChange={e => setCorrectionForm(f => ({ ...f, requestedClockIn: e.target.value }))} className="input-field" /></div>
              <div><label className="label">Correct Clock Out</label><input type="time" value={correctionForm.requestedClockOut} onChange={e => setCorrectionForm(f => ({ ...f, requestedClockOut: e.target.value }))} className="input-field" /></div>
            </div>
            <div><label className="label">Describe the issue *</label>
              <textarea value={correctionForm.message} onChange={e => setCorrectionForm(f => ({ ...f, message: e.target.value }))} rows={3} className="input-field resize-none" placeholder="E.g. I forgot to clock in at 9:00 because the app wasn't loading..." required />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowCorrectionForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Submitting...' : 'Submit Request'}</button>
            </div>
          </form>
        </Modal>

        {/* Message Modal */}
        <Modal open={showMessageForm} onClose={() => setShowMessageForm(false)} title="Message Management">
          <form onSubmit={handleMessageSubmit} className="space-y-4">
            <div><label className="label">Subject *</label>
              <input value={messageForm.subject} onChange={e => setMessageForm(f => ({ ...f, subject: e.target.value }))} className="input-field" placeholder="E.g. Shift swap request, Schedule question..." required />
            </div>
            <div><label className="label">Message *</label>
              <textarea value={messageForm.body} onChange={e => setMessageForm(f => ({ ...f, body: e.target.value }))} rows={4} className="input-field resize-none" placeholder="Write your message to management..." required />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowMessageForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary"><Send className="w-4 h-4" /> {saving ? 'Sending...' : 'Send Message'}</button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}
