'use client';
import { useState, useEffect } from 'react';
import { createWorker, updateWorker, createInvite, getShops, getWorkers, syncOrgPlan } from '@/lib/firestore';
import { canAddWorker, formatCurrency } from '@/lib/pricing';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { Copy, Check, Ticket, AlertTriangle, ArrowUpCircle } from 'lucide-react';

const POSITIONS = ['Barista', 'Cashier', 'Shop Manager', 'Sales Associate', 'Stock Clerk', 'Cleaner', 'Security', 'Chef', 'Waiter', 'Driver', 'Other'];

export default function WorkerForm({ worker, onSuccess, onCancel }) {
  const { isAdmin, orgId, organization } = useAuth();
  const isEditing = !!worker?.id;
  const [shops, setShops] = useState([]);
  const [activeWorkerCount, setActiveWorkerCount] = useState(0);
  const [shopCount, setShopCount] = useState(0);
  const [upgradeCheck, setUpgradeCheck] = useState(null); // result of canAddWorker
  const [upgradeAccepted, setUpgradeAccepted] = useState(false);
  const [form, setForm] = useState({
    firstName: worker?.firstName || '', lastName: worker?.lastName || '', email: worker?.email || '', phone: worker?.phone || '',
    position: worker?.position || '', role: worker?.role || 'worker', customRole: worker?.customRole || '', status: worker?.status || 'active',
    shopId: worker?.shopId || '', startDate: worker?.startDate || new Date().toISOString().split('T')[0],
    shiftPreference: worker?.shiftPreference || 'any',
    availableDays: worker?.availableDays || [1, 2, 3, 4, 5], // Mon-Fri default
    minHoursWeek: worker?.minHoursWeek || 0,
    maxHoursWeek: worker?.maxHoursWeek || 40,
    payType: worker?.payType || 'hourly', costPerHour: worker?.costPerHour || 12, monthlySalary: worker?.monthlySalary || 1800,
    fixedHoursWeek: worker?.fixedHoursWeek || 40, contractedHours: worker?.contractedHours || 40,
    address: worker?.address || '', emergencyContact: worker?.emergencyContact || '', emergencyPhone: worker?.emergencyPhone || '',
    notes: worker?.notes || '', sendInvite: !isEditing,
  });
  const [loading, setLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    getShops(orgId).then(s => { setShops(s); setShopCount(s.length); });
    getWorkers({ orgId, status: 'active' }).then(w => {
      setActiveWorkerCount(w.length);
      // Pre-check if adding one more worker triggers an upgrade
      if (!isEditing) {
        const check = canAddWorker(w.length, 0, organization?.plan || 'free');
        setUpgradeCheck(check);
      }
    });
  }, [orgId, isEditing, organization?.plan]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) || 0 : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email) { toast.error('Fill in required fields'); return; }

    // Enforce tier limits for new workers
    if (!isEditing && upgradeCheck?.requiresUpgrade && !upgradeAccepted) {
      toast.error('Please acknowledge the plan upgrade before adding this worker.');
      return;
    }

    setLoading(true);
    try {
      const { sendInvite, ...data } = form;
      if (isEditing) {
        await updateWorker(worker.id, data);
        toast.success('Worker updated');
        // Sync plan in case status changed
        await syncOrgPlan(orgId).catch(() => {});
        onSuccess?.();
      } else {
        const workerId = await createWorker({ ...data, orgId });
        // Sync the org plan tier after adding a worker
        await syncOrgPlan(orgId).catch(() => {});
        if (sendInvite) {
          const invite = await createInvite({ orgId, orgName: organization?.name || '', workerId, workerName: `${form.firstName} ${form.lastName}`, workerEmail: form.email, role: form.role, createdByAdmin: true });
          setInviteResult(invite);
          toast.success('Worker added — share the invite code!');
        } else { toast.success('Worker added'); onSuccess?.(); }
      }
    } catch (err) { toast.error(err.message); }
    setLoading(false);
  };

  if (inviteResult) {
    return (
      <div className="space-y-5 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto"><Ticket className="w-8 h-8 text-emerald-600" /></div>
        <div><h3 className="text-lg font-display font-bold text-surface-900">Worker Added!</h3><p className="text-sm text-surface-500 mt-1">Share this code with <strong>{form.firstName} {form.lastName}</strong></p></div>
        <div className="relative">
          <div className="bg-surface-50 border-2 border-dashed border-surface-300 rounded-xl py-5 px-4">
            <p className="text-3xl font-mono font-bold tracking-[0.25em] text-surface-900">{inviteResult.code}</p>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(inviteResult.code); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="absolute top-3 right-3 btn-icon !w-8 !h-8">
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-surface-400">Worker visits <strong>/join</strong> and enters this code to create their account.</p>
        <div className="flex gap-3 pt-2">
          <button onClick={() => { setInviteResult(null); setUpgradeAccepted(false); setForm(f => ({ ...f, firstName: '', lastName: '', email: '', phone: '', sendInvite: true })); setActiveWorkerCount(c => c + 1); const check = canAddWorker(activeWorkerCount + 1, shopCount, organization?.plan); setUpgradeCheck(check); }} className="btn-secondary flex-1">Add Another</button>
          <button onClick={() => onSuccess?.()} className="btn-primary flex-1">Done</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Upgrade warning banner */}
      {!isEditing && upgradeCheck?.requiresUpgrade && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex gap-3">
            <ArrowUpCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Plan Upgrade Required</p>
              <p className="text-sm text-amber-700 mt-1">{upgradeCheck.message}</p>
              <p className="text-xs text-amber-600 mt-2">You currently have {activeWorkerCount} active worker{activeWorkerCount !== 1 ? 's' : ''} and {shopCount} shop{shopCount !== 1 ? 's' : ''}.</p>
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input type="checkbox" checked={upgradeAccepted} onChange={e => setUpgradeAccepted(e.target.checked)} className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500" />
                <span className="text-sm font-medium text-amber-800">I understand and accept the new pricing</span>
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="label">First Name *</label><input name="firstName" value={form.firstName} onChange={handleChange} className="input-field" required /></div>
        <div><label className="label">Last Name *</label><input name="lastName" value={form.lastName} onChange={handleChange} className="input-field" required /></div>
        <div><label className="label">Email *</label><input name="email" type="email" value={form.email} onChange={handleChange} className="input-field" required /></div>
        <div><label className="label">Phone</label><input name="phone" value={form.phone} onChange={handleChange} className="input-field" /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="label">Position</label><select name="position" value={form.position} onChange={handleChange} className="select-field"><option value="">Select...</option>{POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
        <div><label className="label">Shop</label><select name="shopId" value={form.shopId} onChange={handleChange} className="select-field"><option value="">All shops</option>{shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div><label className="label">System Role</label><select name="role" value={form.role} onChange={handleChange} className="select-field" disabled={!isAdmin}><option value="worker">Worker</option><option value="manager">Manager</option>{isAdmin && <option value="admin">Admin</option>}</select><p className="text-[10px] text-surface-400 mt-1">Controls permissions: managers can approve hours & manage staff</p></div>
        <div><label className="label">Job Title / Custom Role</label><input name="customRole" value={form.customRole || ''} onChange={handleChange} className="input-field" placeholder="e.g. Head Barista, Shift Lead, Supervisor" /><p className="text-[10px] text-surface-400 mt-1">Display name shown in the app (optional)</p></div>
        <div><label className="label">Status</label><select name="status" value={form.status} onChange={handleChange} className="select-field"><option value="active">Active</option><option value="inactive">Inactive</option><option value="onLeave">On Leave</option></select></div>
        <div><label className="label">Start Date</label><input name="startDate" type="date" value={form.startDate} onChange={handleChange} className="input-field" /></div>
        <div><label className="label">Shift Preference</label><select name="shiftPreference" value={form.shiftPreference} onChange={handleChange} className="select-field"><option value="any">Any / Flexible</option><option value="morning">🌅 Morning (05–12)</option><option value="afternoon">☀️ Afternoon (12–17)</option><option value="evening">🌙 Evening (17–00)</option></select></div>
      </div>

      {/* Availability & Hours */}
      <div className="p-4 bg-surface-50 rounded-xl space-y-4">
        <h4 className="text-sm font-semibold text-surface-700">Availability</h4>
        <div>
          <label className="label mb-2">Available Days</label>
          <div className="flex flex-wrap gap-2">
            {[{d:1,l:'Mon'},{d:2,l:'Tue'},{d:3,l:'Wed'},{d:4,l:'Thu'},{d:5,l:'Fri'},{d:6,l:'Sat'},{d:0,l:'Sun'}].map(({d,l}) => (
              <button key={d} type="button" onClick={() => setForm(f => {
                const days = f.availableDays?.includes(d) ? f.availableDays.filter(x => x !== d) : [...(f.availableDays || []), d];
                return { ...f, availableDays: days };
              })} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${form.availableDays?.includes(d) ? 'bg-brand-600 text-white shadow-sm' : 'bg-white border border-surface-200 text-surface-500 hover:border-surface-300'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Min Hours/Week</label><input name="minHoursWeek" type="number" min="0" max="60" step="1" value={form.minHoursWeek} onChange={handleChange} className="input-field" /></div>
          <div><label className="label">Max Hours/Week</label><input name="maxHoursWeek" type="number" min="0" max="60" step="1" value={form.maxHoursWeek} onChange={handleChange} className="input-field" /></div>
        </div>
        <p className="text-xs text-surface-400">
          Auto-scheduler targets contracted hours ({form.payType === 'salaried' ? form.fixedHoursWeek : form.contractedHours}h/wk) within min/max bounds.
          {form.availableDays?.length < 7 && ` Available ${form.availableDays?.length || 0} days/week.`}
        </p>
      </div>

      {/* Pay section */}
      <div className="p-4 bg-surface-50 rounded-xl space-y-4">
        <h4 className="text-sm font-semibold text-surface-700">Compensation</h4>
        <div className="flex gap-2">
          {['hourly', 'salaried'].map(t => (
            <button key={t} type="button" onClick={() => setForm(f => ({ ...f, payType: t }))}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${form.payType === t ? 'bg-brand-600 text-white shadow-sm' : 'bg-white border border-surface-200 text-surface-600 hover:border-surface-300'}`}>
              {t === 'hourly' ? '⏰ Hourly' : '💰 Salaried'}
            </button>
          ))}
        </div>
        {form.payType === 'hourly' ? (
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Cost/Hour (€) *</label><input name="costPerHour" type="number" min="0" step="0.50" value={form.costPerHour} onChange={handleChange} className="input-field" /></div>
            <div><label className="label">Contracted Hours/Week</label><input name="contractedHours" type="number" min="0" max="60" value={form.contractedHours} onChange={handleChange} className="input-field" /></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Monthly Salary (€) *</label><input name="monthlySalary" type="number" min="0" step="50" value={form.monthlySalary} onChange={handleChange} className="input-field" /></div>
            <div><label className="label">Fixed Hours/Week *</label><input name="fixedHoursWeek" type="number" min="1" max="60" value={form.fixedHoursWeek} onChange={handleChange} className="input-field" /></div>
          </div>
        )}
        <p className="text-xs text-surface-400">
          {form.payType === 'salaried'
            ? `Effective rate: €${form.fixedHoursWeek > 0 ? (form.monthlySalary / (form.fixedHoursWeek * 4.33)).toFixed(2) : '0'}/hr · Salaried workers get scheduling priority.`
            : `Monthly estimate: €${(form.costPerHour * (form.contractedHours || 0) * 4.33).toFixed(0)} at ${form.contractedHours}h/week.`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="label">Emergency Contact</label><input name="emergencyContact" value={form.emergencyContact} onChange={handleChange} className="input-field" /></div>
        <div><label className="label">Emergency Phone</label><input name="emergencyPhone" value={form.emergencyPhone} onChange={handleChange} className="input-field" /></div>
      </div>
      <div><label className="label">Address</label><input name="address" value={form.address} onChange={handleChange} className="input-field" /></div>
      <div><label className="label">Notes</label><textarea name="notes" value={form.notes} onChange={handleChange} rows={2} className="input-field resize-none" /></div>

      {!isEditing && (
        <label className="flex items-start gap-3 p-4 bg-brand-50 border border-brand-200 rounded-xl cursor-pointer">
          <input type="checkbox" name="sendInvite" checked={form.sendInvite} onChange={handleChange} className="mt-0.5 w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
          <div><p className="text-sm font-semibold text-brand-800">Generate invite code</p><p className="text-xs text-brand-600 mt-0.5">Worker can create their login at /join</p></div>
        </label>
      )}

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>}
        <button type="submit" disabled={loading || (!isEditing && upgradeCheck?.requiresUpgrade && !upgradeAccepted)} className="btn-primary">
          {loading ? 'Saving...' : isEditing ? 'Update' : form.sendInvite ? 'Add & Invite' : 'Add Worker'}
        </button>
      </div>
    </form>
  );
}
