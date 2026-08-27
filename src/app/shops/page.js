'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { getShops, createShop, updateShop, deleteShop, getWorkers, syncOrgPlan } from '@/lib/firestore';
import { formatCurrency, PRICE_PER_SHOP, canAddShop } from '@/lib/pricing';
import { cn } from '@/utils/helpers';
import { Store, Plus, Pencil, Trash2, MapPin, Users, Lock, Phone, ChevronDown, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

const Mini = ({ icon: Icon, label, value }) => (
  <div className="rounded-lg bg-surface-50 border border-surface-200/60 p-2.5 min-w-0">
    <div className="flex items-center gap-1.5 text-[10px] text-surface-400 mb-0.5"><Icon className="w-3 h-3 flex-shrink-0" /> {label}</div>
    <p className="text-[12px] font-medium text-surface-700 truncate">{value}</p>
  </div>
);

export default function ShopsPage() {
  const { orgId, isAdmin, isManager } = useAuth();
  const [shops, setShops] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState({ name: '', address: '', color: '#4c6ef5', phone: '', manager: '' });
  const [saving, setSaving] = useState(false);
  const [shopCheck, setShopCheck] = useState(null);

  const load = () => { if (!orgId) return; getShops(orgId).then(setShops); getWorkers({ orgId, status: 'active' }).then(setWorkers); };
  useEffect(() => { load(); }, [orgId]);

  const openAdd = () => {
    const check = canAddShop(shops.length, workers.length);
    setShopCheck(check);
    if (!check.allowed) { toast.error(check.message); return; }
    setEdit(null); setForm({ name: '', address: '', color: '#4c6ef5', phone: '', manager: '' }); setShowForm(true);
  };
  const openEdit = (s) => { setShopCheck(null); setEdit(s); setForm({ name: s.name, address: s.address || '', color: s.color || '#4c6ef5', phone: s.phone || '', manager: s.manager || '' }); setShowForm(true); };

  const handleSubmit = async (e) => {
    e.preventDefault(); if (!form.name) { toast.error('Shop name required'); return; }
    setSaving(true);
    try {
      if (edit) { await updateShop(edit.id, form); toast.success('Shop updated'); }
      else { await createShop({ ...form, orgId }); await syncOrgPlan(orgId).catch(() => {}); toast.success('Shop added'); }
      setShowForm(false); load();
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this shop? Workers assigned to it will become unassigned.')) return;
    await deleteShop(id); await syncOrgPlan(orgId).catch(() => {}); toast.success('Deleted'); load();
  };

  const currentShopCheck = canAddShop(shops.length, workers.length);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Shops</h1>
            <p className="text-surface-500 mt-1">{shops.length} location{shops.length !== 1 ? 's' : ''} · 1st shop free, then {formatCurrency(PRICE_PER_SHOP)}/mo</p>
          </div>
          {isAdmin && <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> Add Shop</button>}
        </div>

        {!currentShopCheck.allowed && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
            <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div><p className="text-sm font-semibold text-amber-800">Shop limit reached</p><p className="text-sm text-amber-700 mt-0.5">{currentShopCheck.message}</p></div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shops.map((s, idx) => {
            const shopWorkers = workers.filter(w => w.shopId === s.id);
            const clr = s.color || '#4c6ef5';
            const open = openId === s.id;
            return (
              <div key={s.id} className="card overflow-hidden self-start">
                <div className="h-1.5" style={{ background: `linear-gradient(135deg, ${clr}, ${clr}88)` }} />
                <button type="button" onClick={() => setOpenId(open ? null : s.id)} className="w-full text-left p-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: clr + '18' }}>
                    <Store className="w-5 h-5" style={{ color: clr }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-display font-semibold text-surface-900 truncate">{s.name}</h3>
                      <span className="badge bg-emerald-100 text-emerald-700 !text-[9px] !px-1.5 !py-0 flex-shrink-0">Open</span>
                    </div>
                    {s.address
                      ? <p className="text-xs text-surface-400 flex items-center gap-1 truncate mt-0.5"><MapPin className="w-3 h-3 flex-shrink-0" /> {s.address}</p>
                      : <p className="text-xs text-surface-400 flex items-center gap-1 mt-0.5"><Users className="w-3 h-3" /> {shopWorkers.length} staff</p>}
                  </div>
                  <span className={cn('text-[11px] font-medium flex-shrink-0', idx === 0 ? 'text-emerald-600' : 'text-surface-400')}>{idx === 0 ? 'Free' : `${formatCurrency(PRICE_PER_SHOP)}/mo`}</span>
                  <ChevronDown className={cn('w-4 h-4 text-surface-400 flex-shrink-0 transition-transform', open && 'rotate-180')} />
                </button>
                {open && (
                  <div className="px-4 pb-4 animate-in">
                    <div className="grid grid-cols-2 gap-2">
                      <Mini icon={Users} label="Team" value={`${shopWorkers.length} staff`} />
                      <Mini icon={Shield} label="Manager" value={s.manager || '—'} />
                      <Mini icon={Phone} label="Phone" value={s.phone || '—'} />
                      <Mini icon={idx === 0 ? Store : MapPin} label={idx === 0 ? 'Billing' : 'Address'} value={idx === 0 ? 'Free shop' : (s.address || '—')} />
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => openEdit(s)} className="btn-secondary flex-1 !py-2 !text-sm"><Pencil className="w-4 h-4" /> Edit</button>
                        <button onClick={() => handleDelete(s.id)} className="btn-secondary !py-2 !text-sm !text-red-600 hover:!bg-red-50 hover:!border-red-200"><Trash2 className="w-4 h-4" /> Delete</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {shops.length === 0 && (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
              <Store className="w-8 h-8 text-surface-300" />
            </div>
            <p className="font-medium text-surface-700">No shops yet</p>
            <p className="text-sm text-surface-400 mt-1">Add your first location to get started.</p>
          </div>
        )}

        <Modal open={showForm} onClose={() => setShowForm(false)} title={edit ? 'Edit Shop' : 'Add Shop'}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!edit && shopCheck?.message && <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl text-sm text-brand-700">{shopCheck.message}</div>}
            <div><label className="label">Shop Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" required /></div>
            <div><label className="label">Address</label><input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="input-field" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-field" /></div>
              <div><label className="label">Color</label><input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="input-field h-[42px] p-1 cursor-pointer" /></div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : edit ? 'Update' : 'Add Shop'}</button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}
