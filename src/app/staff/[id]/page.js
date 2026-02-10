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
import { ArrowLeft, Pencil, Trash2, Clock, Calendar, FileCheck, Briefcase, Mail, Phone, MapPin } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function StaffDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { isAdmin, orgId } = useAuth();
  const [worker, setWorker] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [permits, setPermits] = useState([]);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    if (!id) return;
    getWorker(id).then(setWorker);
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    getShifts({ workerId: id, startDate: `${month}-01`, endDate: `${month}-31` }).then(setShifts);
    getAttendance({ workerId: id, limit: 20 }).then(setAttendance);
    getPermits({ workerId: id, limit: 10 }).then(setPermits);
  }, [id]);

  if (!worker) return <Layout><div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" /></div></Layout>;

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

  return (
    <Layout>
      <div className="space-y-6">
        <Link href="/staff" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700">
          <ArrowLeft className="w-4 h-4" /> Back to Staff
        </Link>

        {/* Header */}
        <div className="card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white', color)}>
              {getInitials(worker.firstName, worker.lastName)}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-display font-bold text-surface-900">{worker.firstName} {worker.lastName}</h1>
              <p className="text-surface-500">{worker.position || 'No position'} · <span className="capitalize">{worker.role || 'worker'}</span></p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className={cn('badge', worker.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-500')}>{worker.status}</span>
                <span className="badge bg-brand-100 text-brand-700">{worker.payType === 'salaried' ? `Salaried · ${formatCurrency(worker.monthlySalary || 0)}/mo` : `Hourly · ${formatCurrency(worker.costPerHour || 0)}/hr`}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowEdit(true)} className="btn-secondary"><Pencil className="w-4 h-4" /> Edit</button>
              {isAdmin && <button onClick={handleDelete} className="btn-danger"><Trash2 className="w-4 h-4" /></button>}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card">
            <Calendar className="w-4 h-4 text-brand-400" />
            <p className="text-2xl font-display font-bold">{shifts.length}</p>
            <p className="text-xs text-surface-400">Shifts this month</p>
          </div>
          <div className="stat-card">
            <Clock className="w-4 h-4 text-emerald-400" />
            <p className="text-2xl font-display font-bold">{totalHours.toFixed(1)}h</p>
            <p className="text-xs text-surface-400">Hours this month</p>
          </div>
          <div className="stat-card">
            <Briefcase className="w-4 h-4 text-amber-400" />
            <p className="text-2xl font-display font-bold">{formatCurrency(monthlyCost)}</p>
            <p className="text-xs text-surface-400">Cost this month</p>
          </div>
          <div className="stat-card">
            <FileCheck className="w-4 h-4 text-purple-400" />
            <p className="text-2xl font-display font-bold">{permits.filter(p => p.status === 'approved').length}</p>
            <p className="text-xs text-surface-400">Approved leaves</p>
          </div>
        </div>

        {/* Contact + Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5 space-y-3">
            <h3 className="section-title">Contact</h3>
            {worker.email && <p className="flex items-center gap-2 text-sm text-surface-600"><Mail className="w-4 h-4 text-surface-400" /> {worker.email}</p>}
            {worker.phone && <p className="flex items-center gap-2 text-sm text-surface-600"><Phone className="w-4 h-4 text-surface-400" /> {worker.phone}</p>}
            {worker.address && <p className="flex items-center gap-2 text-sm text-surface-600"><MapPin className="w-4 h-4 text-surface-400" /> {worker.address}</p>}
            {worker.emergencyContact && <p className="text-sm text-surface-500 pt-2 border-t border-surface-100">Emergency: {worker.emergencyContact} {worker.emergencyPhone && `· ${worker.emergencyPhone}`}</p>}
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="section-title">Employment</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-surface-400">Pay Type:</span><p className="font-medium capitalize">{worker.payType || 'hourly'}</p></div>
              <div><span className="text-surface-400">Rate:</span><p className="font-medium">{worker.payType === 'salaried' ? `${formatCurrency(worker.monthlySalary || 0)}/mo` : `${formatCurrency(worker.costPerHour || 0)}/hr`}</p></div>
              <div><span className="text-surface-400">Hours/Week:</span><p className="font-medium">{worker.payType === 'salaried' ? worker.fixedHoursWeek || 40 : worker.contractedHours || '—'}</p></div>
              <div><span className="text-surface-400">Start Date:</span><p className="font-medium">{worker.startDate || '—'}</p></div>
            </div>
          </div>
        </div>

        {/* Recent attendance */}
        <div className="card">
          <div className="px-5 py-4 border-b border-surface-100"><h3 className="section-title">Recent Attendance</h3></div>
          <div className="divide-y divide-surface-100">
            {attendance.length === 0 && <p className="p-5 text-sm text-surface-400 text-center">No attendance records</p>}
            {attendance.slice(0, 10).map(a => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <span className="text-surface-700">{a.date}</span>
                <div className="flex items-center gap-4">
                  <span className="text-surface-500">{a.clockIn?.slice(11, 16) || '—'} → {a.clockOut?.slice(11, 16) || 'Active'}</span>
                  <span className={cn('badge', a.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>{a.status}</span>
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
