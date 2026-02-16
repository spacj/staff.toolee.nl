'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { getAttendance, getPermits, updatePermit, getWorkers, getShops, approveAttendance, notifyWorker } from '@/lib/firestore';
import { formatCurrency } from '@/lib/pricing';
import { cn } from '@/utils/helpers';
import { Clock, CheckCircle, XCircle, Calendar, Users, FileCheck, MessageSquare, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AttendancePage() {
  const { orgId, user, isManager } = useAuth();
  const [tab, setTab] = useState('hours'); // hours | permits
  const [attendance, setAttendance] = useState([]);
  const [permits, setPermits] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [shops, setShops] = useState([]);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('all'); // all | pending | approved | rejected
  const [reviewModal, setReviewModal] = useState(null); // attendance record being reviewed
  const [reviewNotes, setReviewNotes] = useState('');

  const load = () => {
    if (!orgId) return;
    const filters = { orgId, startDate: dateFilter, endDate: dateFilter, limit: 100 };
    if (statusFilter !== 'all') filters.approvalStatus = statusFilter;
    getAttendance(filters).then(setAttendance).catch(() => setAttendance([]));
    getPermits({ orgId }).then(setPermits);
    getWorkers({ orgId }).then(setWorkers);
    getShops(orgId).then(setShops);
  };
  useEffect(() => { load(); }, [orgId, dateFilter, statusFilter]);

  const handlePermitAction = async (id, status) => {
    const permit = permits.find(p => p.id === id);
    await updatePermit(id, { status, reviewedBy: user?.uid, reviewedAt: new Date().toISOString() });
    // Notify the worker
    if (permit?.workerId) {
      await notifyWorker(permit.workerId, orgId, {
        type: 'permit_response', title: `Leave ${status}`,
        message: `Your ${permit.type} request for ${permit.startDate} has been ${status}.`,
        link: '/time',
      }).catch(() => {});
    }
    toast.success(status === 'approved' ? 'Approved' : 'Denied');
    load();
  };

  const handleApproveHours = async (approved) => {
    if (!reviewModal) return;
    await approveAttendance(reviewModal.id, user?.uid, approved, reviewNotes);
    // Notify worker
    if (reviewModal.workerId) {
      await notifyWorker(reviewModal.workerId, orgId, {
        type: 'hours_review', title: `Hours ${approved ? 'approved' : 'rejected'}`,
        message: `Your hours for ${reviewModal.date} (${(reviewModal.totalHours || 0).toFixed(1)}h) have been ${approved ? 'approved' : 'rejected'}. ${reviewNotes ? `Note: ${reviewNotes}` : ''}`,
        link: '/time',
      }).catch(() => {});
    }
    toast.success(approved ? 'Hours approved' : 'Hours rejected');
    setReviewModal(null);
    setReviewNotes('');
    load();
  };

  const workerName = (id) => { const w = workers.find(x => x.id === id); return w ? `${w.firstName} ${w.lastName}` : id; };
  const shopName = (id) => shops.find(s => s.id === id)?.name || '';
  const workerRate = (id) => { const w = workers.find(x => x.id === id); return w?.payType === 'hourly' ? (w.costPerHour || 0) : 0; };

  const clockedIn = attendance.filter(a => a.status === 'clocked-in');
  const completed = attendance.filter(a => a.status === 'completed');
  const pendingApproval = attendance.filter(a => a.approvalStatus === 'pending');
  const pendingPermits = permits.filter(p => p.status === 'pending');

  return (
    <Layout>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Attendance & Leave</h1>
            <p className="text-surface-500 mt-1">Review hours, approve time, manage leave requests.</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card"><Clock className="w-4 h-4 text-emerald-400" /><p className="text-2xl font-display font-bold">{clockedIn.length}</p><p className="text-xs text-surface-400">Clocked in now</p></div>
          <div className="stat-card"><CheckCircle className="w-4 h-4 text-brand-400" /><p className="text-2xl font-display font-bold">{completed.length}</p><p className="text-xs text-surface-400">Completed today</p></div>
          <div className="stat-card"><AlertTriangle className="w-4 h-4 text-amber-400" /><p className="text-2xl font-display font-bold">{pendingApproval.length}</p><p className="text-xs text-surface-400">Hours pending approval</p></div>
          <div className="stat-card"><FileCheck className="w-4 h-4 text-purple-400" /><p className="text-2xl font-display font-bold">{pendingPermits.length}</p><p className="text-xs text-surface-400">Pending leave requests</p></div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-surface-100 rounded-xl p-1 max-w-md">
          {[
            { key: 'hours', label: `Hours${pendingApproval.length > 0 ? ` (${pendingApproval.length})` : ''}` },
            { key: 'permits', label: `Leave${pendingPermits.length > 0 ? ` (${pendingPermits.length})` : ''}` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={cn('flex-1 py-2 text-sm font-medium rounded-lg transition-all', tab === t.key ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700')}>{t.label}</button>
          ))}
        </div>

        {/* ═══ HOURS TAB ═══ */}
        {tab === 'hours' && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="input-field max-w-[180px]" />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select-field max-w-[160px]">
                <option value="all">All statuses</option>
                <option value="pending">⏳ Pending</option>
                <option value="approved">✓ Approved</option>
                <option value="rejected">✗ Rejected</option>
              </select>
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
                    <div key={a.id} className="px-5 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-surface-800">{workerName(a.workerId)}</p>
                          <p className="text-xs text-surface-400">{shopName(a.shopId)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-surface-700">{(a.totalHours || 0).toFixed(1)}h</span>
                          {cost !== null && <span className="text-xs text-surface-400">{formatCurrency(cost)}</span>}
                          <span className={cn('badge text-[10px]',
                            a.approvalStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            a.approvalStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          )}>
                            {a.approvalStatus === 'approved' ? '✓ Approved' : a.approvalStatus === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                          </span>
                        </div>
                      </div>
                      {/* Time entries (segments) */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {entries.map((e, i) => (
                          <span key={i} className="text-xs bg-surface-100 text-surface-600 rounded px-2 py-1">
                            {e.clockIn?.slice(11, 16) || '—'} → {e.clockOut?.slice(11, 16) || '⏳'}
                          </span>
                        ))}
                      </div>
                      {/* Review button for pending — managers and admins only */}
                      {isManager && a.approvalStatus !== 'approved' && (
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => { setReviewModal(a); setReviewNotes(''); }} className="btn-secondary !py-1.5 !px-3 !text-xs"><MessageSquare className="w-3.5 h-3.5" /> Review</button>
                          <button onClick={async () => {
                            await approveAttendance(a.id, user?.uid, true, '');
                            if (a.workerId) { await notifyWorker(a.workerId, orgId, { type: 'hours_review', title: 'Hours approved', message: `Your hours for ${a.date} (${(a.totalHours || 0).toFixed(1)}h) have been approved.`, link: '/time' }).catch(() => {}); }
                            toast.success('Hours approved'); load();
                          }} className="btn-primary !py-1.5 !px-3 !text-xs"><CheckCircle className="w-3.5 h-3.5" /> Quick Approve</button>
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

        {/* ─── Review Modal ─── */}
        <Modal open={!!reviewModal} onClose={() => setReviewModal(null)} title="Review Hours">
          {reviewModal && (
            <div className="space-y-4">
              <div className="p-4 bg-surface-50 rounded-xl">
                <p className="text-sm font-medium text-surface-800">{workerName(reviewModal.workerId)}</p>
                <p className="text-xs text-surface-500">{reviewModal.date} · {shopName(reviewModal.shopId)}</p>
                <p className="text-lg font-display font-bold mt-2">{(reviewModal.totalHours || 0).toFixed(1)} hours</p>
                {/* Entries */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {(reviewModal.entries || []).map((e, i) => (
                    <span key={i} className="text-xs bg-white text-surface-600 rounded px-2 py-1 border border-surface-200">
                      {e.clockIn?.slice(11, 16)} → {e.clockOut?.slice(11, 16) || '...'}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Notes (optional)</label>
                <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={2} className="input-field resize-none" placeholder="Add a note for the worker..." />
              </div>
              <div className="flex gap-3">
                <button onClick={() => handleApproveHours(true)} className="btn-primary flex-1"><CheckCircle className="w-4 h-4" /> Approve</button>
                <button onClick={() => handleApproveHours(false)} className="btn-danger flex-1"><XCircle className="w-4 h-4" /> Reject</button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </Layout>
  );
}
