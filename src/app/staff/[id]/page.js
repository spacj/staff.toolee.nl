'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import WorkerForm from '@/components/WorkerForm';
import { useAuth } from '@/contexts/AuthContext';
import { getWorker, getShifts, getAttendance, getPermits, deleteWorker, syncOrgPlan } from '@/lib/firestore';
import { cn, getInitials, generateAvatarColor, ROLE_LABELS } from '@/utils/helpers';
import { formatCurrency } from '@/lib/pricing';
import { ArrowLeft, Pencil, Trash2, Clock, Calendar, FileCheck, Briefcase, Mail, Phone, MapPin, Shield, Hash } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function StaffDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { isAdmin, isManager, orgId } = useAuth();
  const [worker, setWorker] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [permits, setPermits] = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getWorker(id).then(w => {
      setWorker(w);
      if (!w) setError('Worker not found');
      setLoading(false);
    }).catch(err => { setError(err.message); setLoading(false); });
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    getShifts({ workerId: id, startDate: `${month}-01`, endDate: `${month}-31` }).then(setShifts).catch(() => {});
    getAttendance({ workerId: id, limit: 20 }).then(setAttendance).catch(() => {});
    getPermits({ workerId: id, limit: 10 }).then(setPermits).catch(() => {});
  }, [id]);

  if (loading) return <Layout><div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" /></div></Layout>;
  if (error || !worker) return <Layout><div className="flex flex-col items-center justify-center py-20 gap-4"><p className="text-surface-500">{error || 'Worker not found'}</p><Link href="/staff" className="btn-secondary"><ArrowLeft className="w-4 h-4" /> Back to Staff</Link></div></Layout>;

  const color = generateAvatarColor(worker.firstName + worker.lastName);
  const totalHours = shifts.reduce((s, sh) => s + (sh.hours || 0), 0);
  const monthlyCost = worker.payType === 'salaried' ? worker.monthlySalary || 0 : totalHours * (worker.costPerHour || 0);

  const handleDelete = async () => {
    if (!confirm('Permanently delete this worker?')) return;
    await deleteWorker(id);
    await syncOrgPlan(orgId).catch(() => {});
    toast.success('Worker deleted');
    router.push('/staff');
  };

  const stats = [
    { icon: Calendar, value: shifts.length, label: 'Shifts this month', color: 'text-brand-400' },
    { icon: Clock, value: `${totalHours.toFixed(1)}h`, label: 'Hours this month', color: 'text-emerald-400' },
    { icon: Briefcase, value: formatCurrency(monthlyCost), label: 'Cost this month', color: 'text-amber-400' },
    { icon: FileCheck, value: permits.filter(p => p.status === 'approved').length, label: 'Approved leaves', color: 'text-purple-400' },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <Link href="/staff" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Staff
        </Link>

        {/* Header with gradient banner */}
        <div className="card overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-brand-600 via-brand-500 to-purple-500 relative">
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-0 right-20 w-40 h-40 bg-white rounded-full blur-3xl" />
            </div>
          </div>
          <div className="px-6 pb-6 -mt-10 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className={cn('w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white border-4 border-white shadow-lg', color)}>
                {getInitials(worker.firstName, worker.lastName)}
              </div>
              <div className="flex-1 pt-2">
                <h1 className="text-2xl font-display font-bold text-surface-900">{worker.firstName} {worker.lastName}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className="text-surface-500">{worker.customRole || worker.position || 'No position'}</p>
                  <span className="text-surface-300">·</span>
                  <span className={cn('badge capitalize', worker.role === 'admin' ? 'badge-admin' : worker.role === 'manager' ? 'badge-manager' : 'badge-worker')}>{worker.role || 'worker'}</span>
                  <span className={cn('badge', worker.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-500')}>{worker.status}</span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {isManager && <button onClick={() => setShowEdit(true)} className="btn-secondary"><Pencil className="w-4 h-4" /> Edit</button>}
                {isAdmin && <button onClick={handleDelete} className="btn-danger !px-3"><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-stagger">
          {stats.map(s => (
            <div key={s.label} className="stat-card">
              <s.icon className={cn('w-4.5 h-4.5', s.color)} />
              <p className="text-2xl font-display font-bold text-surface-900">{s.value}</p>
              <p className="text-xs text-surface-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6 space-y-4">
            <h3 className="section-title flex items-center gap-2"><Mail className="w-4 h-4 text-surface-400" /> Contact</h3>
            <div className="space-y-3">
              {worker.email && <div className="flex items-center gap-3 text-sm"><div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center flex-shrink-0"><Mail className="w-3.5 h-3.5 text-surface-500" /></div><span className="text-surface-700">{worker.email}</span></div>}
              {worker.phone && <div className="flex items-center gap-3 text-sm"><div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center flex-shrink-0"><Phone className="w-3.5 h-3.5 text-surface-500" /></div><span className="text-surface-700">{worker.phone}</span></div>}
              {worker.address && <div className="flex items-center gap-3 text-sm"><div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center flex-shrink-0"><MapPin className="w-3.5 h-3.5 text-surface-500" /></div><span className="text-surface-700">{worker.address}</span></div>}
              {worker.emergencyContact && <div className="pt-3 border-t border-surface-100"><p className="text-xs text-surface-400 mb-1">Emergency Contact</p><p className="text-sm text-surface-700">{worker.emergencyContact} {worker.emergencyPhone && `· ${worker.emergencyPhone}`}</p></div>}
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h3 className="section-title flex items-center gap-2"><Briefcase className="w-4 h-4 text-surface-400" /> Employment</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Pay Type', value: worker.payType === 'salaried' ? 'Salaried' : 'Hourly' },
                { label: 'Rate', value: worker.payType === 'salaried' ? `${formatCurrency(worker.monthlySalary || 0)}/mo` : `${formatCurrency(worker.costPerHour || 0)}/hr` },
                { label: 'Hours/Week', value: worker.payType === 'salaried' ? `${worker.fixedHoursWeek || 40}h` : worker.contractedHours ? `${worker.contractedHours}h` : '—' },
                { label: 'Start Date', value: worker.startDate || '—' },
              ].map(d => (
                <div key={d.label} className="bg-surface-50 rounded-xl p-3">
                  <p className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">{d.label}</p>
                  <p className="text-sm font-semibold text-surface-800 mt-0.5">{d.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Attendance */}
        <div className="card">
          <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
            <h3 className="section-title">Recent Attendance</h3>
            <span className="text-xs text-surface-400">{attendance.length} records</span>
          </div>
          <div className="divide-y divide-surface-100">
            {attendance.length === 0 && <p className="p-6 text-sm text-surface-400 text-center">No attendance records</p>}
            {attendance.slice(0, 10).map(a => (
              <div key={a.id} className="px-5 py-3.5 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-surface-300" />
                  <span className="font-medium text-surface-700">{a.date}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-surface-500 font-mono text-xs">{a.clockIn?.slice(11, 16) || '—'} → {a.clockOut?.slice(11, 16) || 'Active'}</span>
                  <span className={cn('badge text-[10px]', a.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>{a.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Worker" size="lg">
          <WorkerForm worker={worker} onSuccess={() => { setShowEdit(false); getWorker(id).then(setWorker); }} onCancel={() => setShowEdit(false)} />
        </Modal>
      </div>
    </Layout>
  );
}
