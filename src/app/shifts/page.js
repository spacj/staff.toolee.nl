'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { getShiftTemplates, createShiftTemplate, updateShiftTemplate, deleteShiftTemplate, getShops } from '@/lib/firestore';
import { cn } from '@/utils/helpers';
import { ClipboardList, Plus, Pencil, Trash2, Clock, Users, Store } from 'lucide-react';
import toast from 'react-hot-toast';

const SHIFT_TYPES = ['morning', 'afternoon', 'evening', 'night', 'split', 'custom'];
const TYPE_COLORS = { morning: 'bg-amber-100 text-amber-700', afternoon: 'bg-orange-100 text-orange-700', evening: 'bg-purple-100 text-purple-700', night: 'bg-indigo-100 text-indigo-700', split: 'bg-teal-100 text-teal-700', custom: 'bg-surface-100 text-surface-600' };

export default function ShiftTemplatesPage() {
  const { orgId } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [shops, setShops] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ name: '', shopId: '', type: 'morning', startTime: '06:00', endTime: '14:00', requiredWorkers: 1, breakMinutes: 30, notes: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!orgId) return;
    getShiftTemplates(orgId).then(setTemplates);
    getShops(orgId).then(setShops);
  };
  useEffect(() => { load(); }, [orgId]);

  const openAdd = () => { setEdit(null); setForm({ name: '', shopId: shops[0]?.id || '', type: 'morning', startTime: '06:00', endTime: '14:00', requiredWorkers: 1, breakMinutes: 30, notes: '' }); setShowForm(true); };
  const openEdit = (t) => { setEdit(t); setForm({ name: t.name, shopId: t.shopId || '', type: t.type || 'morning', startTime: t.startTime, endTime: t.endTime, requiredWorkers: t.requiredWorkers || 1, breakMinutes: t.breakMinutes || 30, notes: t.notes || '' }); setShowForm(true); };

  const calcHours = (s, e) => { const [sh, sm] = s.split(':').map(Number); const [eh, em] = e.split(':').map(Number); let h = (eh + em / 60) - (sh + sm / 60); if (h <= 0) h += 24; return h.toFixed(1); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.shopId) { toast.error('Name and shop are required'); return; }
    setSaving(true);
    try {
      const data = { ...form, orgId, requiredWorkers: parseInt(form.requiredWorkers) || 1, breakMinutes: parseInt(form.breakMinutes) || 0 };
      if (edit) { await updateShiftTemplate(edit.id, data); toast.success('Template updated'); }
      else { await createShiftTemplate(data); toast.success('Template created'); }
      setShowForm(false); load();
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this shift template?')) return;
    await deleteShiftTemplate(id); toast.success('Deleted'); load();
  };

  const grouped = shops.map(s => ({ shop: s, templates: templates.filter(t => t.shopId === s.id) }));

  return (
    <Layout>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Shift Templates</h1>
            <p className="text-surface-500 mt-1">Define shifts that need to be filled. These are the blueprint for your weekly schedule.</p>
          </div>
          <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> New Template</button>
        </div>

        {grouped.map(({ shop, templates: tpls }) => (
          <div key={shop.id} className="card">
            <div className="px-5 py-4 border-b border-surface-100 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: shop.color || '#4c6ef5' }} />
              <h3 className="section-title">{shop.name}</h3>
              <span className="text-xs text-surface-400 ml-auto">{tpls.length} template{tpls.length !== 1 ? 's' : ''}</span>
            </div>
            {tpls.length === 0 ? (
              <p className="p-5 text-sm text-surface-400 text-center">No shift templates for this shop yet.</p>
            ) : (
              <div className="divide-y divide-surface-100">
                {tpls.map(t => (
                  <div key={t.id} className="px-5 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-surface-800">{t.name}</h4>
                        <span className={cn('badge text-[10px]', TYPE_COLORS[t.type] || TYPE_COLORS.custom)}>{t.type}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-surface-500">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {t.startTime} → {t.endTime} ({calcHours(t.startTime, t.endTime)}h)</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {t.requiredWorkers} needed</span>
                        {t.breakMinutes > 0 && <span>{t.breakMinutes}min break</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(t)} className="btn-icon !w-8 !h-8"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(t.id)} className="btn-icon !w-8 !h-8 hover:!text-red-600 hover:!bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {shops.length === 0 && (
          <div className="card p-12 text-center">
            <Store className="w-10 h-10 text-surface-300 mx-auto mb-3" />
            <p className="text-surface-500">Add a shop first, then create shift templates for it.</p>
          </div>
        )}

        <Modal open={showForm} onClose={() => setShowForm(false)} title={edit ? 'Edit Shift Template' : 'New Shift Template'}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Template Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Morning Shift" className="input-field" required />
            </div>
            <div>
              <label className="label">Shop *</label>
              <select value={form.shopId} onChange={e => setForm(f => ({ ...f, shopId: e.target.value }))} className="select-field" required>
                <option value="">Select shop...</option>
                {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Shift Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="select-field">
                {SHIFT_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Start Time *</label><input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="input-field" required /></div>
              <div><label className="label">End Time *</label><input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="input-field" required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Workers Needed *</label><input type="number" min="1" max="50" value={form.requiredWorkers} onChange={e => setForm(f => ({ ...f, requiredWorkers: e.target.value }))} className="input-field" /></div>
              <div><label className="label">Break (min)</label><input type="number" min="0" max="120" value={form.breakMinutes} onChange={e => setForm(f => ({ ...f, breakMinutes: e.target.value }))} className="input-field" /></div>
            </div>
            <div><label className="label">Notes</label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="input-field resize-none" /></div>
            <p className="text-xs text-surface-400 bg-surface-50 p-3 rounded-xl">Duration: <strong>{calcHours(form.startTime, form.endTime)}h</strong> (net: {(parseFloat(calcHours(form.startTime, form.endTime)) - (parseInt(form.breakMinutes) || 0) / 60).toFixed(1)}h after break)</p>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : edit ? 'Update' : 'Create Template'}</button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}
