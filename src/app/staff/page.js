'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import WorkerForm from '@/components/WorkerForm';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkers, deleteWorker, syncOrgPlan } from '@/lib/firestore';
import { cn, getInitials, generateAvatarColor, ROLE_LABELS } from '@/utils/helpers';
import { UserPlus, Search, MoreVertical, Pencil, Trash2, Eye, Users } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function StaffPage() {
  const { orgId, isAdmin } = useAuth();
  const [workers, setWorkers] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editWorker, setEditWorker] = useState(null);
  const [menuId, setMenuId] = useState(null);

  const load = () => orgId && getWorkers({ orgId }).then(setWorkers);
  useEffect(() => { load(); }, [orgId]);

  const filtered = workers.filter(w =>
    `${w.firstName} ${w.lastName} ${w.email} ${w.position}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id) => {
    if (!confirm('Delete this worker?')) return;
    await deleteWorker(id);
    await syncOrgPlan(orgId).catch(() => {});
    toast.success('Worker deleted');
    load();
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Staff</h1>
            <p className="text-surface-500 mt-1">{workers.length} team members</p>
          </div>
          <button onClick={() => { setEditWorker(null); setShowForm(true); }} className="btn-primary">
            <UserPlus className="w-4 h-4" /> Add Worker
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff..." className="input-field pl-10 max-w-md" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(w => {
            const color = generateAvatarColor(w.firstName + w.lastName);
            return (
              <div key={w.id} className="card p-5 relative">
                <div className="flex items-start gap-3">
                  <div className={cn('w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0', color)}>
                    {getInitials(w.firstName, w.lastName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/staff/${w.id}`} className="text-sm font-semibold text-surface-900 hover:text-brand-600 truncate block">{w.firstName} {w.lastName}</Link>
                    <p className="text-xs text-surface-500 truncate">{w.position || 'No position'}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={cn('badge', w.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-500')}>{w.status}</span>
                      <span className="badge bg-surface-100 text-surface-600 capitalize">{w.payType === 'salaried' ? '💰 Salaried' : `€${w.costPerHour || 0}/hr`}</span>
                    </div>
                  </div>
                  <div className="relative">
                    <button onClick={() => setMenuId(menuId === w.id ? null : w.id)} className="btn-icon !w-8 !h-8">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuId === w.id && (
                      <>
                        <div className="dropdown-backdrop" onClick={() => setMenuId(null)} />
                        <div className="dropdown-menu">
                          <Link href={`/staff/${w.id}`} className="dropdown-item" onClick={() => setMenuId(null)}><Eye className="w-3.5 h-3.5" /> View</Link>
                          <button onClick={() => { setEditWorker(w); setShowForm(true); setMenuId(null); }} className="dropdown-item"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                          {isAdmin && <button onClick={() => { handleDelete(w.id); setMenuId(null); }} className="dropdown-item-danger"><Trash2 className="w-3.5 h-3.5" /> Delete</button>}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="card p-12 text-center">
            <Users className="w-10 h-10 text-surface-300 mx-auto mb-3" />
            <p className="text-surface-500">No staff found. Add your first team member!</p>
          </div>
        )}

        <Modal open={showForm} onClose={() => setShowForm(false)} title={editWorker ? 'Edit Worker' : 'Add Worker'} size="lg">
          <WorkerForm worker={editWorker} onSuccess={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />
        </Modal>
      </div>
    </Layout>
  );
}
