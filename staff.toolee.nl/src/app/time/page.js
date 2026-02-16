'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { getAttendance, getActiveClockIn, clockIn, clockOut, getPermits, createPermit, getShops, getWorkers, getWorker, notifyManagers } from '@/lib/firestore';
import { formatCurrency } from '@/lib/pricing';
import { cn } from '@/utils/helpers';
import { Clock, Play, Square, Calendar, FileCheck, Plus, BarChart3, AlertCircle, DollarSign, CheckCircle, Pause } from 'lucide-react';
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
                        {r.approvalStatus === 'approved' ? '✓ Approved' : r.approvalStatus === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                      </span>
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
      </div>
    </Layout>
  );
}
