'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { getShiftTemplates, createShiftTemplate, updateShiftTemplate, deleteShiftTemplate, getShops, getWorkers, getOvertimeRules } from '@/lib/firestore';
import { cn } from '@/utils/helpers';
import { DAY_LABELS } from '@/lib/scheduling';
import { ClipboardList, Plus, Pencil, Trash2, Clock, Users, Store, Calendar, X, DollarSign, Moon, Sun, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const SHIFT_TYPES = ['morning', 'afternoon', 'evening', 'night', 'split', 'custom'];
const TYPE_COLORS = { morning: 'bg-amber-100 text-amber-700', afternoon: 'bg-orange-100 text-orange-700', evening: 'bg-purple-100 text-purple-700', night: 'bg-indigo-100 text-indigo-700', split: 'bg-teal-100 text-teal-700', custom: 'bg-surface-100 text-surface-600' };
const DAY_BUTTONS = [{d:1,l:'Mon'},{d:2,l:'Tue'},{d:3,l:'Wed'},{d:4,l:'Thu'},{d:5,l:'Fri'},{d:6,l:'Sat'},{d:0,l:'Sun'}];
const RULE_TYPES = [
  { value: 'unpaid_break', label: 'Unpaid Break', description: 'Deduct break time from paid hours' },
  { value: 'incompatible_workers', label: 'Incompatible Workers', description: 'Two workers who cannot work this shift together' },
  { value: 'min_rest_hours', label: 'Minimum Rest Between Shifts', description: 'Hours of rest required before next shift' },
  { value: 'max_consecutive_days', label: 'Max Consecutive Days', description: 'Limit how many days in a row a worker can do this shift' },
];
const DEFAULT_OT = { dailyThreshold: 0, dailyMultiplier: 1.5, dailyMultiplier2: 2.0, dailyThreshold2: 12, weeklyThreshold: 0, weeklyMultiplier: 1.5, monthlyThreshold: 0, monthlyMultiplier: 1.5, weekendMultiplier: 1.25, nightStart: '', nightEnd: '', nightMultiplier: 1.25, earlyStart: '', earlyEnd: '', earlyMultiplier: 1.1, holidayMultiplier: 2.0, enabled: false };

export default function ShiftTemplatesPage() {
  const { orgId } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [shops, setShops] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({
    name: '', shopId: '', type: 'morning', startTime: '06:00', endTime: '14:00',
    requiredWorkers: 1, breakMinutes: 30, notes: '',
    daysOfWeek: [], // empty — user must explicitly select days
    usePerDayRequirements: false,
    requiredByDay: {}, // { "1": 2, "6": 3 } — day-specific overrides
    rules: [], // extra rules: [{ type: 'incompatible_workers', workers: ['id1', 'id2'] }]
  });
  const [workers, setWorkers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [orgOvertimeDefaults, setOrgOvertimeDefaults] = useState(DEFAULT_OT);

  const load = () => {
    if (!orgId) return;
    getShiftTemplates(orgId).then(setTemplates);
    getShops(orgId).then(setShops);
    getWorkers({ orgId }).then(setWorkers);
    getOvertimeRules(orgId).then(r => setOrgOvertimeDefaults(r || DEFAULT_OT));
  };
  useEffect(() => { load(); }, [orgId]);

  const openAdd = () => {
    setEdit(null);
    setForm({
      name: '', shopId: shops[0]?.id || '', type: 'morning', startTime: '06:00', endTime: '14:00',
      requiredWorkers: 1, breakMinutes: 30, notes: '', daysOfWeek: [],
      usePerDayRequirements: false, requiredByDay: {}, rules: [],
      useOvertimeOverride: false,
      overtime: { ...orgOvertimeDefaults, enabled: orgOvertimeDefaults.enabled },
    });
    setShowForm(true);
  };

  const openEdit = (t) => {
    setEdit(t);
    const hasPerDay = t.requiredByDay && Object.keys(t.requiredByDay).length > 0;
    const hasOtOverride = !!t.overtimeOverride;
    setForm({
      name: t.name, shopId: t.shopId || '', type: t.type || 'morning',
      startTime: t.startTime, endTime: t.endTime,
      requiredWorkers: t.requiredWorkers || 1, breakMinutes: t.breakMinutes || 30,
      notes: t.notes || '',
      daysOfWeek: t.daysOfWeek || [0,1,2,3,4,5,6],
      usePerDayRequirements: hasPerDay,
      requiredByDay: t.requiredByDay || {},
      rules: (t.rules || []).map(migrateRule),
      useOvertimeOverride: hasOtOverride,
      overtime: hasOtOverride ? t.overtimeOverride : { ...orgOvertimeDefaults },
    });
    setShowForm(true);
  };

  const calcHours = (s, e) => {
    const [sh, sm] = s.split(':').map(Number);
    const [eh, em] = e.split(':').map(Number);
    let h = (eh + em / 60) - (sh + sm / 60);
    if (h <= 0) h += 24;
    return h.toFixed(1);
  };

  const toggleDay = (d) => {
    setForm(f => {
      const days = f.daysOfWeek.includes(d) ? f.daysOfWeek.filter(x => x !== d) : [...f.daysOfWeek, d];
      const rbd = { ...f.requiredByDay };
      if (!days.includes(d)) delete rbd[String(d)]; // remove override for unselected day
      return { ...f, daysOfWeek: days, requiredByDay: rbd };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.shopId) { toast.error('Name and shop are required'); return; }
    if (form.daysOfWeek.length === 0) { toast.error('Select at least one day'); return; }
    setSaving(true);
    try {
      // Normalize rules before saving
      const normalizedRules = form.rules.map(r => {
        if (r.type === 'incompatible_workers') {
          // Store as workers[] array for scheduling algorithm compatibility
          const w = [r.workerA, r.workerB].filter(Boolean);
          return { type: 'incompatible_workers', workers: w, workerA: r.workerA || '', workerB: r.workerB || '' };
        }
        return r;
      }).filter(r => {
        // Remove incomplete rules
        if (r.type === 'incompatible_workers' && (!r.workers || r.workers.length < 2)) return false;
        if (r.type === 'unpaid_break' && (!r.minutes || r.minutes <= 0)) return false;
        return true;
      });
      const data = {
        ...form, orgId,
        requiredWorkers: parseInt(form.requiredWorkers) || 1,
        breakMinutes: parseInt(form.breakMinutes) || 0,
        requiredByDay: form.usePerDayRequirements ? form.requiredByDay : {},
        rules: normalizedRules,
        overtimeOverride: form.useOvertimeOverride ? form.overtime : null,
      };
      delete data.usePerDayRequirements;
      delete data.useOvertimeOverride;
      delete data.overtime;
      if (edit) { await updateShiftTemplate(edit.id, data); toast.success('Template updated'); }
      else { await createShiftTemplate(data); toast.success('Template created'); }
      setShowForm(false); load();
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  const addRule = (type = 'unpaid_break') => {
    const defaults = {
      unpaid_break: { type: 'unpaid_break', minutes: 30 },
      incompatible_workers: { type: 'incompatible_workers', workerA: '', workerB: '' },
      min_rest_hours: { type: 'min_rest_hours', hours: 11 },
      max_consecutive_days: { type: 'max_consecutive_days', days: 5 },
    };
    setForm(f => ({ ...f, rules: [...f.rules, defaults[type] || defaults.unpaid_break] }));
  };

  const removeRule = (idx) => {
    setForm(f => ({ ...f, rules: f.rules.filter((_, i) => i !== idx) }));
  };

  const updateRule = (idx, rule) => {
    setForm(f => ({ ...f, rules: f.rules.map((r, i) => i === idx ? rule : r) }));
  };

  // Migrate old incompatible_workers rules (workers[] array → workerA/workerB)
  const migrateRule = (rule) => {
    if (rule.type === 'incompatible_workers' && rule.workers && !rule.workerA) {
      return { type: 'incompatible_workers', workerA: rule.workers[0] || '', workerB: rule.workers[1] || '' };
    }
    return rule;
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this shift template?')) return;
    await deleteShiftTemplate(id); toast.success('Deleted'); load();
  };

  const grouped = shops.map(s => ({ shop: s, templates: templates.filter(t => t.shopId === s.id) }));

  const dayLabelsForTemplate = (t) => {
    const days = t.daysOfWeek || [0,1,2,3,4,5,6];
    if (days.length === 7) return 'Every day';
    if (JSON.stringify([...days].sort()) === JSON.stringify([1,2,3,4,5])) return 'Mon–Fri';
    if (JSON.stringify([...days].sort()) === JSON.stringify([0,6])) return 'Weekends';
    return days.sort((a,b) => a-b).map(d => DAY_LABELS[d]).join(', ');
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Shift Templates</h1>
            <p className="text-surface-500 mt-1">Define shifts per day. The auto-scheduler fills them based on worker preferences and availability.</p>
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
                  <div key={t.id} className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-surface-800 text-sm sm:text-base">{t.name}</h4>
                        <span className={cn('badge text-[10px]', TYPE_COLORS[t.type] || TYPE_COLORS.custom)}>{t.type}</span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4 mt-1 text-xs text-surface-500 flex-wrap">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {t.startTime}–{t.endTime} ({calcHours(t.startTime, t.endTime)}h)</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {t.requiredWorkers}</span>
                         <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {dayLabelsForTemplate(t)}</span>
                         {t.breakMinutes > 0 && <span>{t.breakMinutes}min break</span>}
                         {t.rules && t.rules.length > 0 && (
                           <span className="flex items-center gap-1 text-brand-600">
                             {t.rules.length} rule{t.rules.length > 1 ? 's' : ''}
                             {t.rules.some(r => r.type === 'unpaid_break') && ' (unpaid break)'}
                             {t.rules.some(r => r.type === 'incompatible_workers') && ' (incompatible)'}
                           </span>
                          )}
                         {t.overtimeOverride && (
                           <span className="flex items-center gap-1 text-amber-600">
                             <DollarSign className="w-3 h-3" /> OT rules
                           </span>
                          )}
                       </div>
                      {t.requiredByDay && Object.keys(t.requiredByDay).length > 0 && (
                        <div className="flex gap-1.5 mt-1.5">
                          {Object.entries(t.requiredByDay).map(([d, n]) => (
                            <span key={d} className="text-[10px] bg-brand-50 text-brand-600 rounded px-1.5 py-0.5">{DAY_LABELS[d]}: {n}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0 self-end sm:self-center">
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

        {/* ─── Template Form Modal ─── */}
        <Modal open={showForm} onClose={() => setShowForm(false)} title={edit ? 'Edit Shift Template' : 'New Shift Template'} size="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Template Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Morning Shift" className="input-field" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Start Time *</label><input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="input-field" required /></div>
              <div><label className="label">End Time *</label><input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="input-field" required /></div>
            </div>

            {/* Days of week */}
            <div>
              <label className="label mb-2">Days This Shift Runs *</label>
              <div className="flex flex-wrap gap-2">
                {DAY_BUTTONS.map(({ d, l }) => (
                  <button key={d} type="button" onClick={() => toggleDay(d)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${form.daysOfWeek.includes(d) ? 'bg-brand-600 text-white shadow-sm' : 'bg-white border border-surface-200 text-surface-500 hover:border-surface-300'}`}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setForm(f => ({ ...f, daysOfWeek: [1,2,3,4,5] }))} className="text-[11px] text-brand-600 hover:underline">Mon–Fri</button>
                <button type="button" onClick={() => setForm(f => ({ ...f, daysOfWeek: [0,6] }))} className="text-[11px] text-brand-600 hover:underline">Weekends</button>
                <button type="button" onClick={() => setForm(f => ({ ...f, daysOfWeek: [0,1,2,3,4,5,6] }))} className="text-[11px] text-brand-600 hover:underline">Every day</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Default Workers Needed *</label><input type="number" min="1" max="50" value={form.requiredWorkers} onChange={e => setForm(f => ({ ...f, requiredWorkers: e.target.value }))} className="input-field" /></div>
              <div><label className="label">Break (min)</label><input type="number" min="0" max="120" value={form.breakMinutes} onChange={e => setForm(f => ({ ...f, breakMinutes: e.target.value }))} className="input-field" /></div>
            </div>

            {/* Per-day requirements */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.usePerDayRequirements} onChange={e => setForm(f => ({ ...f, usePerDayRequirements: e.target.checked }))} className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                <span className="text-sm font-medium text-surface-700">Different worker counts per day</span>
              </label>
              {form.usePerDayRequirements && (
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mt-3 p-3 bg-surface-50 rounded-xl">
                  {DAY_BUTTONS.filter(({ d }) => form.daysOfWeek.includes(d)).map(({ d, l }) => (
                    <div key={d} className="text-center">
                      <label className="text-[11px] font-medium text-surface-500 block mb-1">{l}</label>
                      <input type="number" min="1" max="50"
                        value={form.requiredByDay[String(d)] || form.requiredWorkers}
                        onChange={e => setForm(f => ({ ...f, requiredByDay: { ...f.requiredByDay, [String(d)]: parseInt(e.target.value) || 1 } }))}
                        className="input-field !text-center !px-1 !py-1.5 text-sm" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Extra Rules */}
            <div>
              <label className="label mb-2">Shift Rules</label>
              <div className="space-y-3">
                {form.rules.map((rule, idx) => {
                  const ruleDef = RULE_TYPES.find(r => r.value === rule.type);
                  return (
                    <div key={idx} className="p-3 bg-surface-50 rounded-xl border border-surface-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-surface-700 bg-white border border-surface-200 rounded-lg px-2 py-1">{ruleDef?.label || rule.type}</span>
                          <span className="text-[11px] text-surface-400">{ruleDef?.description}</span>
                        </div>
                        <button type="button" onClick={() => removeRule(idx)} className="btn-icon !w-6 !h-6 hover:!text-red-600 hover:!bg-red-50"><X className="w-3 h-3" /></button>
                      </div>

                      {/* Unpaid Break */}
                      {rule.type === 'unpaid_break' && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-surface-500">Break duration:</label>
                          <input type="number" min="0" max="120" value={rule.minutes || 0}
                            onChange={e => updateRule(idx, { ...rule, minutes: parseInt(e.target.value) || 0 })}
                            className="input-field !w-20 !py-1 text-sm text-center" />
                          <span className="text-xs text-surface-400">minutes (deducted from paid hours)</span>
                        </div>
                      )}

                      {/* Incompatible Workers — two dropdowns side by side */}
                      {rule.type === 'incompatible_workers' && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <select value={rule.workerA || ''}
                            onChange={e => updateRule(idx, { ...rule, workerA: e.target.value })}
                            className="input-field !py-1.5 text-sm flex-1 min-w-[140px]">
                            <option value="">Select worker 1...</option>
                            {workers.filter(w => w.id !== rule.workerB).map(w => (
                              <option key={w.id} value={w.id}>{w.firstName} {w.lastName}</option>
                            ))}
                          </select>
                          <span className="text-xs text-surface-400 font-medium">can't work with</span>
                          <select value={rule.workerB || ''}
                            onChange={e => updateRule(idx, { ...rule, workerB: e.target.value })}
                            className="input-field !py-1.5 text-sm flex-1 min-w-[140px]">
                            <option value="">Select worker 2...</option>
                            {workers.filter(w => w.id !== rule.workerA).map(w => (
                              <option key={w.id} value={w.id}>{w.firstName} {w.lastName}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Min Rest Hours */}
                      {rule.type === 'min_rest_hours' && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-surface-500">Minimum rest:</label>
                          <input type="number" min="1" max="48" value={rule.hours || 11}
                            onChange={e => updateRule(idx, { ...rule, hours: parseInt(e.target.value) || 11 })}
                            className="input-field !w-20 !py-1 text-sm text-center" />
                          <span className="text-xs text-surface-400">hours between end of this shift and next shift</span>
                        </div>
                      )}

                      {/* Max Consecutive Days */}
                      {rule.type === 'max_consecutive_days' && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-surface-500">Max consecutive:</label>
                          <input type="number" min="1" max="7" value={rule.days || 5}
                            onChange={e => updateRule(idx, { ...rule, days: parseInt(e.target.value) || 5 })}
                            className="input-field !w-20 !py-1 text-sm text-center" />
                          <span className="text-xs text-surface-400">days in a row a worker can be assigned this shift</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add rule dropdown */}
                <div className="flex items-center gap-2">
                  <select id="newRuleType" className="input-field !py-1.5 text-sm !w-auto" defaultValue="">
                    <option value="" disabled>Add a rule...</option>
                    {RULE_TYPES.filter(rt => {
                      // Only allow one unpaid_break rule
                      if (rt.value === 'unpaid_break' && form.rules.some(r => r.type === 'unpaid_break')) return false;
                      return true;
                    }).map(rt => (
                      <option key={rt.value} value={rt.value}>{rt.label}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => {
                    const sel = document.getElementById('newRuleType');
                    if (sel.value) { addRule(sel.value); sel.value = ''; }
                  }} className="text-sm text-brand-600 hover:text-brand-700 font-medium">+ Add</button>
                </div>
              </div>
            </div>
            {/* Overtime Rules */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.useOvertimeOverride} onChange={e => setForm(f => ({ ...f, useOvertimeOverride: e.target.checked, overtime: f.overtime || { ...orgOvertimeDefaults } }))} className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                <span className="text-sm font-medium text-surface-700">Custom overtime rules for this template</span>
                {!form.useOvertimeOverride && orgOvertimeDefaults.enabled && (
                  <span className="text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Using org defaults</span>
                )}
              </label>
              {form.useOvertimeOverride && (
                <div className="mt-3 p-4 bg-amber-50/50 rounded-xl border border-amber-100 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-800">Overtime & Premium Pay</span>
                  </div>

                   {/* Daily overtime */}
                   <div className="grid grid-cols-2 gap-3">
                     <div>
                       <label className="text-xs text-surface-600 font-medium">Daily hours threshold</label>
                       <input type="number" min="0" max="24" step="0.5" value={form.overtime.dailyThreshold || 0}
                         onChange={e => setForm(f => ({ ...f, overtime: { ...f.overtime, dailyThreshold: parseFloat(e.target.value) || 0 } }))}
                         className="input-field !py-1.5 text-sm" placeholder="e.g. 8" />
                       <p className="text-[10px] text-surface-400 mt-0.5">0 = disabled. Hours over this per day = overtime</p>
                     </div>
                     <div>
                       <label className="text-xs text-surface-600 font-medium">Daily OT multiplier</label>
                       <input type="number" min="1" max="5" step="0.05" value={form.overtime.dailyMultiplier || 1.5}
                         onChange={e => setForm(f => ({ ...f, overtime: { ...f.overtime, dailyMultiplier: parseFloat(e.target.value) || 1.5 } }))}
                         className="input-field !py-1.5 text-sm" />
                     </div>
                   </div>

                   {/* Second tier daily OT */}
                   <div className="grid grid-cols-2 gap-3">
                     <div>
                       <label className="text-xs text-surface-600 font-medium">2nd tier daily threshold</label>
                       <input type="number" min="0" max="24" step="0.5" value={form.overtime.dailyThreshold2 || 12}
                         onChange={e => setForm(f => ({ ...f, overtime: { ...f.overtime, dailyThreshold2: parseFloat(e.target.value) || 12 } }))}
                         className="input-field !py-1.5 text-sm" placeholder="e.g. 12" />
                       <p className="text-[10px] text-surface-400 mt-0.5">Hours over this = double time (0 = disabled)</p>
                     </div>
                     <div>
                       <label className="text-xs text-surface-600 font-medium">2nd tier multiplier</label>
                       <input type="number" min="1" max="5" step="0.05" value={form.overtime.dailyMultiplier2 || 2.0}
                         onChange={e => setForm(f => ({ ...f, overtime: { ...f.overtime, dailyMultiplier2: parseFloat(e.target.value) || 2.0 } }))}
                         className="input-field !py-1.5 text-sm" />
                     </div>
                   </div>

                  {/* Weekly overtime */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-surface-600 font-medium">Weekly hours threshold</label>
                      <input type="number" min="0" max="168" step="0.5" value={form.overtime.weeklyThreshold || 0}
                        onChange={e => setForm(f => ({ ...f, overtime: { ...f.overtime, weeklyThreshold: parseFloat(e.target.value) || 0 } }))}
                        className="input-field !py-1.5 text-sm" placeholder="e.g. 40" />
                      <p className="text-[10px] text-surface-400 mt-0.5">0 = disabled. Hours over this per week = overtime</p>
                    </div>
                    <div>
                      <label className="text-xs text-surface-600 font-medium">Weekly OT multiplier</label>
                      <input type="number" min="1" max="5" step="0.05" value={form.overtime.weeklyMultiplier || 1.5}
                        onChange={e => setForm(f => ({ ...f, overtime: { ...f.overtime, weeklyMultiplier: parseFloat(e.target.value) || 1.5 } }))}
                        className="input-field !py-1.5 text-sm" />
                    </div>
                  </div>

                   {/* Monthly overtime */}
                   <div className="grid grid-cols-2 gap-3">
                     <div>
                       <label className="text-xs text-surface-600 font-medium">Monthly hours threshold</label>
                       <input type="number" min="0" max="744" step="1" value={form.overtime.monthlyThreshold || 0}
                         onChange={e => setForm(f => ({ ...f, overtime: { ...f.overtime, monthlyThreshold: parseFloat(e.target.value) || 0 } }))}
                         className="input-field !py-1.5 text-sm" placeholder="e.g. 160" />
                       <p className="text-[10px] text-surface-400 mt-0.5">0 = disabled</p>
                     </div>
                     <div>
                       <label className="text-xs text-surface-600 font-medium">Monthly OT multiplier</label>
                       <input type="number" min="1" max="5" step="0.05" value={form.overtime.monthlyMultiplier || 1.5}
                         onChange={e => setForm(f => ({ ...f, overtime: { ...f.overtime, monthlyMultiplier: parseFloat(e.target.value) || 1.5 } }))}
                         className="input-field !py-1.5 text-sm" />
                     </div>
                   </div>

                   {/* Weekend premium */}
                   <div className="border-t border-amber-200 pt-3">
                     <div className="grid grid-cols-2 gap-3">
                       <div>
                         <label className="text-xs text-surface-600 font-medium">Weekend premium multiplier</label>
                         <input type="number" min="1" max="5" step="0.05" value={form.overtime.weekendMultiplier || 1.25}
                           onChange={e => setForm(f => ({ ...f, overtime: { ...f.overtime, weekendMultiplier: parseFloat(e.target.value) || 1.25 } }))}
                           className="input-field !py-1.5 text-sm" />
                         <p className="text-[10px] text-surface-400 mt-0.5">Applied to all hours worked on Saturdays and Sundays</p>
                       </div>
                     </div>
                   </div>

                  {/* Night premium */}
                  <div className="border-t border-amber-200 pt-3">
                    <div className="flex items-center gap-1 mb-2">
                      <Moon className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="text-xs font-semibold text-surface-700">Night & Early Morning Premium</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-surface-600 font-medium">Night start</label>
                        <input type="time" value={form.overtime.nightStart || ''} onChange={e => setForm(f => ({ ...f, overtime: { ...f.overtime, nightStart: e.target.value } }))} className="input-field !py-1.5 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-surface-600 font-medium">Night end</label>
                        <input type="time" value={form.overtime.nightEnd || ''} onChange={e => setForm(f => ({ ...f, overtime: { ...f.overtime, nightEnd: e.target.value } }))} className="input-field !py-1.5 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-surface-600 font-medium">Night multiplier</label>
                        <input type="number" min="1" max="5" step="0.05" value={form.overtime.nightMultiplier || 1.25} onChange={e => setForm(f => ({ ...f, overtime: { ...f.overtime, nightMultiplier: parseFloat(e.target.value) || 1.25 } }))} className="input-field !py-1.5 text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-2">
                      <div>
                        <label className="text-xs text-surface-600 font-medium">Early start</label>
                        <input type="time" value={form.overtime.earlyStart || ''} onChange={e => setForm(f => ({ ...f, overtime: { ...f.overtime, earlyStart: e.target.value } }))} className="input-field !py-1.5 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-surface-600 font-medium">Early end</label>
                        <input type="time" value={form.overtime.earlyEnd || ''} onChange={e => setForm(f => ({ ...f, overtime: { ...f.overtime, earlyEnd: e.target.value } }))} className="input-field !py-1.5 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-surface-600 font-medium">Early multiplier</label>
                        <input type="number" min="1" max="5" step="0.05" value={form.overtime.earlyMultiplier || 1.1} onChange={e => setForm(f => ({ ...f, overtime: { ...f.overtime, earlyMultiplier: parseFloat(e.target.value) || 1.1 } }))} className="input-field !py-1.5 text-sm" />
                      </div>
                    </div>
                    <p className="text-[10px] text-surface-400 mt-1">Leave times empty to disable. Hours falling in these ranges get the premium multiplier.</p>
                  </div>

                  {/* Holiday multiplier */}
                  <div className="border-t border-amber-200 pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-surface-600 font-medium">Public holiday multiplier</label>
                        <input type="number" min="1" max="5" step="0.1" value={form.overtime.holidayMultiplier || 2.0}
                          onChange={e => setForm(f => ({ ...f, overtime: { ...f.overtime, holidayMultiplier: parseFloat(e.target.value) || 2.0 } }))}
                          className="input-field !py-1.5 text-sm" />
                        <p className="text-[10px] text-surface-400 mt-0.5">Applied to all hours worked on public holidays (set holidays in Settings)</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div><label className="label">Notes</label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="input-field resize-none" /></div>
            <p className="text-xs text-surface-400 bg-surface-50 p-3 rounded-xl">Duration: <strong>{calcHours(form.startTime, form.endTime)}h</strong>{(() => {
              const unpaidRule = form.rules.find(r => r.type === 'unpaid_break');
              const breakMins = unpaidRule ? (unpaidRule.minutes || 0) : (parseInt(form.breakMinutes) || 0);
              const net = (parseFloat(calcHours(form.startTime, form.endTime)) - breakMins / 60).toFixed(1);
              return breakMins > 0 ? ` (paid: ${net}h after ${breakMins}min unpaid break)` : '';
            })()} · Runs {form.daysOfWeek.length} day{form.daysOfWeek.length !== 1 ? 's' : ''}/week</p>
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
