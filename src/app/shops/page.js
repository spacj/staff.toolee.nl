'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { getShops, createShop, updateShop, deleteShop, getWorkers, syncOrgPlan } from '@/lib/firestore';
import { formatCurrency, PRICE_PER_SHOP, canAddShop } from '@/lib/pricing';
import { cn } from '@/utils/helpers';
import { Store, Plus, Pencil, Trash2, MapPin, Users, MoreVertical, AlertTriangle, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ShopsPage() {
  const { orgId } = useAuth();
  const [shops, setShops] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [form, setForm] = useState({ name: '', address: '', color: '#4c6ef5', phone: '', manager: '' });
  const [saving, setSaving] = useState(false);
  const [shopCheck, setShopCheck] = useState(null);

  const load = () => {
    if (!orgId) return;
    getShops(orgId).then(setShops);
    getWorkers({ orgId, status: 'active' }).then(setWorkers);
  };
  useEffect(() => { load(); }, [orgId]);

  const activeWorkerCount = workers.length;

  const openAdd = () => {
    // Check if adding a shop is allowed
    const check = canAddShop(shops.length, activeWorkerCount);
    setShopCheck(check);
    if (!check.allowed) {
      // Don't open form, show toast
      toast.error(check.message);
      return;
    }
    setEdit(null);
    setForm({ name: '', address: '', color: '#4c6ef5', phone: '', manager: '' });
    setShowForm(true);
  };

  const openEdit = (s) => {
    setShopCheck(null);
    setEdit(s);
    setForm({ name: s.name, address: s.address || '', color: s.color || '#4c6ef5', phone: s.phone || '', manager: s.manager || '' });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error('Shop name required'); return; }
    setSaving(true);
    try {
      if (edit) {
        await updateShop(edit.id, form);
        toast.success('Shop updated');
      } else {
        await createShop({ ...form, orgId });
        // Sync org plan after adding shop
        await syncOrgPlan(orgId).catch(() => {});
        toast.success('Shop added');
      }
      setShowForm(false); load();
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this shop? Workers assigned to it will become unassigned.')) return;
    await deleteShop(id);
    await syncOrgPlan(orgId).catch(() => {});
    toast.success('Deleted'); load();
  };

  // Current add-shop check for the UI banner
  const currentShopCheck = canAddShop(shops.length, activeWorkerCount);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Shops</h1>
            <p className="text-surface-500 mt-1">{shops.length} location{shops.length !== 1 ? 's' : ''} · {formatCurrency(PRICE_PER_SHOP)}/shop/month</p>
          </div>
          <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> Add Shop</button>
        </div>

        {/* Limit warning for free plan */}
        {!currentShopCheck.allowed && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex gap-3">
              <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Shop limit reached</p>
                <p className="text-sm text-amber-700 mt-1">{currentShopCheck.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Cost info for standard plan */}
        {currentShopCheck.allowed && currentShopCheck.message && shops.length > 0 && (
          <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl">
            <p className="text-sm text-brand-700">{currentShopCheck.message}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shops.map(s => {
            const shopWorkers = workers.filter(w => w.shopId === s.id);
            return (
              <div key={s.id} className="card relative">
                <div className="h-1.5 rounded-t-2xl" style={{ backgroundColor: s.color || '#4c6ef5' }} />
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-display font-semibold text-surface-900">{s.name}</h3>
                      {s.address && <p className="text-xs text-surface-400 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {s.address}</p>}
                    </div>
                    <div className="relative">
                      <button onClick={() => setMenuId(menuId === s.id ? null : s.id)} className="btn-icon !w-8 !h-8"><MoreVertical className="w-4 h-4" /></button>
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
                  </div>
                  <div className="flex items-center gap-4 mt-4 pt-3 border-t border-surface-100 text-sm">
                    <span className="flex items-center gap-1.5 text-surface-500"><Users className="w-3.5 h-3.5" /> {shopWorkers.length} staff</span>
                    <span className="text-surface-400">{formatCurrency(PRICE_PER_SHOP)}/mo</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {shops.length === 0 && (
          <div className="card p-12 text-center">
            <Store className="w-10 h-10 text-surface-300 mx-auto mb-3" />
            <p className="text-surface-500">No shops yet. Add your first location!</p>
          </div>
        )}

        <Modal open={showForm} onClose={() => setShowForm(false)} title={edit ? 'Edit Shop' : 'Add Shop'}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Show cost note when adding new shop on standard plan */}
            {!edit && shopCheck?.message && (
              <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl text-sm text-brand-700">{shopCheck.message}</div>
            )}
            <div>
              <label className="label">Shop Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" required />
            </div>
            <div>
              <label className="label">Address</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="input-field" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="label">Color</label>
                <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="input-field h-[42px] p-1 cursor-pointer" />
              </div>
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
