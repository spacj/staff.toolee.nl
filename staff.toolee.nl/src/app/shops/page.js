'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { getShops, createShop, updateShop, deleteShop, getWorkers, syncOrgPlan } from '@/lib/firestore';
import { formatCurrency, PRICE_PER_SHOP, canAddShop } from '@/lib/pricing';
import { cn } from '@/utils/helpers';
import { Store, Plus, Pencil, Trash2, MapPin, Users, MoreVertical, Lock, Phone } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ShopsPage() {
  const { orgId, isManager } = useAuth();
  const [shops, setShops] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const [menuId, setMenuId] = useState(null);
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
          {isManager && <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> Add Shop</button>}
        </div>

        {!currentShopCheck.allowed && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
            <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div><p className="text-sm font-semibold text-amber-800">Shop limit reached</p><p className="text-sm text-amber-700 mt-0.5">{currentShopCheck.message}</p></div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {shops.map((s, idx) => {
            const shopWorkers = workers.filter(w => w.shopId === s.id);
            const clr = s.color || '#4c6ef5';
            return (
              <div key={s.id} className="card-hover relative overflow-hidden group">
                <div className="h-2" style={{ background: `linear-gradient(135deg, ${clr}, ${clr}88)` }} />
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: clr + '18' }}>
                        <Store className="w-5 h-5" style={{ color: clr }} />
                      </div>
                      <div>
                        <h3 className="font-display font-semibold text-surface-900">{s.name}</h3>
                        {s.address && <p className="text-xs text-surface-400 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {s.address}</p>}
                        {s.phone && <p className="text-xs text-surface-400 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {s.phone}</p>}
                      </div>
                    </div>
                    {isManager && (
                      <div className="relative">
                        <button onClick={() => setMenuId(menuId === s.id ? null : s.id)} className="btn-icon !w-8 !h-8 opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical className="w-4 h-4" /></button>
                        {menuId === s.id && (
                          <>
                            <div className="dropdown-backdrop" onClick={() => setMenuId(null)} />
                            <div className="dropdown-menu">
                              <button onClick={() => { openEdit(s); setMenuId(null); }} className="dropdown-item"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                              <button onClick={() => { handleDelete(s.id); setMenuId(null); }} className="dropdown-item-danger"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-4 pt-3 border-t border-surface-100 text-sm">
                    <span className="flex items-center gap-1.5 text-surface-500"><Users className="w-3.5 h-3.5" /> {shopWorkers.length} staff</span>
                    <span className={idx === 0 ? 'text-emerald-600 font-semibold text-xs' : 'text-surface-400 text-xs'}>{idx === 0 ? '✓ Free' : `${formatCurrency(PRICE_PER_SHOP)}/mo`}</span>
                  </div>
                </div>
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
