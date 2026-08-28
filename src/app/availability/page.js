'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import ScheduleTabs from '@/components/ScheduleTabs';
import { useAuth } from '@/contexts/AuthContext';
import { getStaffAvailability, setStaffAvailability, removeStaffAvailability, getAvailabilitySettings } from '@/lib/firestore';
import { cn } from '@/utils/helpers';
import { ChevronLeft, ChevronRight, Calendar, Sun, Sunset, Moon, Clock, AlertCircle, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const SHIFT_TYPES = [
  { id: 'morning', label: 'Morning', icon: Sun, color: 'bg-amber-100 text-amber-700' },
  { id: 'afternoon', label: 'Afternoon', icon: Sunset, color: 'bg-orange-100 text-orange-700' },
  { id: 'evening', label: 'Evening', icon: Moon, color: 'bg-indigo-100 text-indigo-700' },
  { id: 'full', label: 'Full Day', icon: Clock, color: 'bg-emerald-100 text-emerald-700' },
];

export default function AvailabilityPage() {
  const { userProfile, workerId, orgId, isWorker } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [availability, setAvailability] = useState([]);
  const [settings, setSettings] = useState({ deadlineDays: 7, enabled: true });
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState('full');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  const loadRange = {
    start: `${monthStr}-01`,
    end: `${monthStr}-31`,
  };

  useEffect(() => {
    if (!orgId || !workerId) return;
    getStaffAvailability({ orgId, workerId, startDate: loadRange.start, endDate: loadRange.end })
      .then(setAvailability)
      .finally(() => setLoading(false));
    getAvailabilitySettings(orgId).then(setSettings);
  }, [orgId, workerId, loadRange.start, loadRange.end]);

  const getDateStr = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const todayStr = new Date().toISOString().split('T')[0];

  const isDateSelectable = (dateStr) => {
    if (!settings.enabled) return false;
    const date = new Date(dateStr);
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + settings.deadlineDays);
    return date >= deadline;
  };

  const monthDays = () => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  };

  const getAvailabilityForDate = (dateStr) => availability.find(a => a.date === dateStr);

  const nav = (dir) => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const openAvailabilityModal = (date) => {
    const existing = getAvailabilityForDate(date);
    setSelectedDate(date);
    setSelectedShift(existing?.shiftType || 'full');
    setShowModal(true);
  };

  const handleSaveAvailability = async () => {
    if (!selectedDate) return;
    setSaving(true);
    try {
      await setStaffAvailability({
        orgId,
        workerId,
        workerName: userProfile?.displayName || 'Worker',
        date: selectedDate,
        shiftType: selectedShift,
        status: 'available',
      });
      const updated = await getStaffAvailability({ orgId, workerId, startDate: loadRange.start, endDate: loadRange.end });
      setAvailability(updated);
      setShowModal(false);
      toast.success('Availability saved!');
    } catch (err) {
      toast.error('Failed to save availability');
    }
    setSaving(false);
  };

  const handleRemoveAvailability = async () => {
    if (!selectedDate) return;
    setSaving(true);
    try {
      await removeStaffAvailability(workerId, selectedDate);
      const updated = await getStaffAvailability({ orgId, workerId, startDate: loadRange.start, endDate: loadRange.end });
      setAvailability(updated);
      setShowModal(false);
      toast.success('Availability removed');
    } catch (err) {
      toast.error('Failed to remove availability');
    }
    setSaving(false);
  };

  const getShiftTypeInfo = (shiftType) => SHIFT_TYPES.find(s => s.id === shiftType) || SHIFT_TYPES[3];

   if (!isWorker) {
     return (
       <Layout>
         <div className="space-y-4">
           <div className="page-header">
             <div>
               <h1 className="page-title">My Availability</h1>
               <p className="text-surface-500 mt-1">Workers only - Submit your availability for upcoming shifts</p>
             </div>
           </div>
           <div className="card p-8 text-center bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
             <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
             <h2 className="text-lg font-semibold text-amber-900">Access Restricted</h2>
             <p className="text-amber-700 mt-2">This page is for staff members only. Only workers can submit their availability.</p>
             <p className="text-sm text-amber-600 mt-4">If you are a manager or owner, you can view staff availability in the <strong>Staff Availability</strong> section from the sidebar menu.</p>
           </div>
         </div>
       </Layout>
     );
   }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">My Availability</h1>
            <p className="text-surface-500 mt-1">
              {!settings.enabled 
                ? 'Availability tracking is not enabled by your organization'
                : `Submit availability at least ${settings.deadlineDays} days in advance`
              }
            </p>
          </div>
        </div>

        <ScheduleTabs />

        {!settings.enabled && (
          <div className="card p-4 bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <p className="text-sm text-amber-800">Availability tracking is currently disabled by your organization.</p>
            </div>
          </div>
        )}

        {settings.enabled && (
          <>
            {/* Month switcher */}
            <div className="flex items-center justify-between">
              <button onClick={() => nav(-1)} className="w-9 h-9 rounded-xl bg-white border border-surface-200 flex items-center justify-center text-surface-600 hover:bg-surface-50 hover:border-surface-300 active:scale-95 transition-all"><ChevronLeft className="w-5 h-5" /></button>
              <h2 className="text-base sm:text-lg font-display font-semibold text-surface-900">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
              <button onClick={() => nav(1)} className="w-9 h-9 rounded-xl bg-white border border-surface-200 flex items-center justify-center text-surface-600 hover:bg-surface-50 hover:border-surface-300 active:scale-95 transition-all"><ChevronRight className="w-5 h-5" /></button>
            </div>

            {/* Weekday header */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center text-[10px] sm:text-xs font-semibold text-surface-400">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d}><span className="hidden sm:inline">{d}</span><span className="sm:hidden">{d[0]}</span></div>
              ))}
            </div>

            {/* Day cards */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {monthDays().map((d, i) => {
                if (!d) return <div key={`e${i}`} className="aspect-square" />;

                const dateStr = getDateStr(year, month, d);
                const dayAvailability = getAvailabilityForDate(dateStr);
                const isToday = dateStr === todayStr;
                const isSelectable = isDateSelectable(dateStr);
                const isPast = dateStr < todayStr;
                const info = dayAvailability ? getShiftTypeInfo(dayAvailability.shiftType) : null;

                return (
                  <button
                    key={d}
                    type="button"
                    disabled={isPast}
                    onClick={() => !isPast && openAvailabilityModal(dateStr)}
                    title={dayAvailability ? `Available · ${info.label}` : undefined}
                    className={cn(
                      'aspect-square rounded-xl border flex flex-col items-center justify-center gap-0.5 p-1 transition-all',
                      dayAvailability
                        ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300'
                        : isPast
                          ? 'bg-surface-50/50 border-surface-100 opacity-50 cursor-not-allowed'
                          : isSelectable
                            ? 'bg-white border-surface-200 hover:border-brand-300 hover:bg-brand-50/50 active:scale-95'
                            : 'bg-surface-50 border-surface-100',
                      isToday && !dayAvailability && 'ring-2 ring-brand-400 ring-offset-1'
                    )}
                  >
                    <span className={cn(
                      'text-xs sm:text-sm font-semibold leading-none',
                      dayAvailability ? 'text-emerald-700' : isToday ? 'text-brand-600' : isSelectable ? 'text-surface-700' : 'text-surface-300'
                    )}>
                      {d}
                    </span>
                    {dayAvailability ? (
                      <span className={cn('inline-flex items-center justify-center w-4 h-4 rounded-full', info.color)}><info.icon className="w-2.5 h-2.5" /></span>
                    ) : (!isSelectable && !isPast) ? (
                      <span className="text-[7px] text-surface-300 uppercase tracking-wide">locked</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-display font-semibold text-surface-800">Shift types</h3>
                <span className="text-[11px] text-surface-400">Tap a day to set yours</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SHIFT_TYPES.map(type => (
                  <div key={type.id} className={cn('flex items-center gap-2 p-2.5 rounded-xl', type.color)}>
                    <type.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-medium">{type.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <Modal open={showModal} onClose={() => setShowModal(false)} title="Set Availability">
          <div className="space-y-4">
            <div className="p-3 bg-surface-50 rounded-xl">
              <p className="text-sm text-surface-600">Date: <span className="font-medium text-surface-800">{selectedDate}</span></p>
              {!isDateSelectable(selectedDate) && settings.enabled && (
                <p className="text-xs text-amber-600 mt-1">This date is within the deadline period ({settings.deadlineDays} days).</p>
              )}
            </div>
            
            <div>
              <label className="label">Preferred Shift</label>
              <div className="grid grid-cols-2 gap-2">
                {SHIFT_TYPES.map(type => {
                  const active = selectedShift === type.id;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setSelectedShift(type.id)}
                      className={cn(
                        'relative flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all active:scale-[0.98]',
                        active ? 'border-brand-500 bg-brand-50' : 'border-surface-200 hover:border-surface-300'
                      )}
                    >
                      <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', type.color)}><type.icon className="w-4 h-4" /></span>
                      <span className="text-sm font-medium text-surface-800">{type.label}</span>
                      {active && <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-brand-500 text-white flex items-center justify-center"><Check className="w-3 h-3" /></span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              {getAvailabilityForDate(selectedDate) && (
                <button
                  onClick={handleRemoveAvailability}
                  disabled={saving}
                  className="btn-secondary !text-red-600 hover:!bg-red-50"
                >
                  Remove
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button
                  onClick={handleSaveAvailability}
                  disabled={saving || !isDateSelectable(selectedDate)}
                  className="btn-primary"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  );
}
