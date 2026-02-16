'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import WorkerForm from '@/components/WorkerForm';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkers, deleteWorker, syncOrgPlan } from '@/lib/firestore';
import { cn, getInitials, generateAvatarColor } from '@/utils/helpers';
import { UserPlus, Search, MoreVertical, Pencil, Trash2, Eye, Users } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import useStore from '@/lib/store';

export default function StaffPage() {
  const { orgId, isAdmin, isManager } = useAuth();
  const [workers, setWorkers] = useState([]);
  const [search, setSearch] = useState('');
  const { searchQuery } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editWorker, setEditWorker] = useState(null);
  const [menuId, setMenuId] = useState(null);

  const load = () => orgId && getWorkers({ orgId }).then(setWorkers);
  useEffect(() => { load(); }, [orgId]);

  const effectiveSearch = search || searchQuery;
  const filtered = workers.filter(w =>
    `${w.firstName} ${w.lastName} ${w.email} ${w.position} ${w.customRole || ''}`.toLowerCase().includes(effectiveSearch.toLowerCase())
  );

  const active = filtered.filter(w => w.status === 'active');
  const inactive = filtered.filter(w => w.status !== 'active');

  const handleDelete = async (id) => {
    if (!confirm('Delete this worker?')) return;
    await deleteWorker(id);
    await syncOrgPlan(orgId).catch(() => {});
    toast.success('Worker deleted');
    load();
  };

  const WorkerCard = ({ w }) => {
    const color = generateAvatarColor(w.firstName + w.lastName);
    return (
      <div className="card-hover p-5 relative group">
        <div className="flex items-start gap-3.5">
          <div className="relative">
            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-sm', color)}>
              {getInitials(w.firstName, w.lastName)}
            </div>
            <div className={cn('absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white', w.status === 'active' ? 'bg-emerald-400' : 'bg-surface-300')} />
          </div>
          <div className="flex-1 min-w-0">
            <Link href={`/staff/${w.id}`} className="text-sm font-semibold text-surface-900 hover:text-brand-600 truncate block transition-colors">{w.firstName} {w.lastName}</Link>
            <p className="text-xs text-surface-500 truncate mt-0.5">{w.customRole || w.position || 'No position'}</p>
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <span className={cn('badge capitalize text-[10px]', w.role === 'admin' ? 'badge-admin' : w.role === 'manager' ? 'badge-manager' : 'badge-worker')}>{w.role || 'worker'}</span>
              <span className="text-[11px] text-surface-400 font-medium">{w.payType === 'salaried' ? 'Salaried' : `€${w.costPerHour || 0}/hr`}</span>
            </div>
          </div>
          {isManager && (
            <div className="relative">
              <button onClick={() => setMenuId(menuId === w.id ? null : w.id)} className="btn-icon !w-8 !h-8 opacity-0 group-hover:opacity-100 transition-opacity">
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
          )}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Staff</h1>
            <p className="text-surface-500 mt-1">{active.length} active · {inactive.length} inactive</p>
          </div>
          {isManager && (
            <button onClick={() => { setEditWorker(null); setShowForm(true); }} className="btn-primary">
              <UserPlus className="w-4 h-4" /> Add Worker
            </button>
          )}
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, role, position..." className="input-field pl-10" />
        </div>

        {active.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-stagger">
            {active.map(w => <WorkerCard key={w.id} w={w} />)}
          </div>
        )}

        {inactive.length > 0 && (
          <>
            <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider pt-2">Inactive ({inactive.length})</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
              {inactive.map(w => <WorkerCard key={w.id} w={w} />)}
            </div>
          </>
        )}

        {filtered.length === 0 && (
          <div className="card p-12 text-center">
            <Users className="w-10 h-10 text-surface-300 mx-auto mb-3" />
            <p className="text-surface-500 font-medium">No staff found</p>
            <p className="text-sm text-surface-400 mt-1">Add your first team member to get started.</p>
          </div>
        )}

        <Modal open={showForm} onClose={() => setShowForm(false)} title={editWorker ? 'Edit Worker' : 'Add Worker'} size="lg">
          <WorkerForm worker={editWorker} onSuccess={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />
        </Modal>
      </div>
    </Layout>
  );
}
