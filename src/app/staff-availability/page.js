'use client';
import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { getStaffAvailability, getWorkers, getAvailabilitySettings } from '@/lib/firestore';
import { cn } from '@/utils/helpers';
import { ChevronLeft, ChevronRight, Calendar, Users, Sun, Sunset, Moon, Clock, User, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const SHIFT_TYPES = [
  { id: 'morning', label: 'Morning', icon: Sun, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 'afternoon', label: 'Afternoon', icon: Sunset, color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'evening', label: 'Evening', icon: Moon, color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { id: 'full', label: 'Full Day', icon: Clock, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
];

export default function StaffAvailabilityPage() {
  const { orgId, isManager } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [availability, setAvailability] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [settings, setSettings] = useState({ deadlineDays: 7, enabled: true });
  const [selectedWorker, setSelectedWorker] = useState('all');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('calendar');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  const loadRange = {
    start: `${monthStr}-01`,
    end: `${monthStr}-31`,
  };

  useEffect(() => {
    if (!orgId) return;
    Promise.all([
      getStaffAvailability({ orgId, startDate: loadRange.start, endDate: loadRange.end }),
      getWorkers({ orgId, status: 'active' }),
      getAvailabilitySettings(orgId),
    ]).then(([avail, workersList, availSettings]) => {
      setAvailability(avail);
      setWorkers(workersList);
      setSettings(availSettings);
    }).finally(() => setLoading(false));
  }, [orgId, loadRange.start, loadRange.end]);

  const getDateStr = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const todayStr = new Date().toISOString().split('T')[0];

  const monthDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [year, month]);

  const filteredAvailability = selectedWorker === 'all' 
    ? availability 
    : availability.filter(a => a.workerId === selectedWorker);

  const getAvailabilityForDate = (dateStr) => filteredAvailability.filter(a => a.date === dateStr);

  const nav = (dir) => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const getShiftTypeInfo = (shiftType) => SHIFT_TYPES.find(s => s.id === shiftType) || SHIFT_TYPES[3];

  const workerStats = useMemo(() => {
    const stats = {};
    workers.forEach(w => {
      stats[w.id] = {
        name: `${w.firstName} ${w.lastName}`,
        total: 0,
        morning: 0,
        afternoon: 0,
        evening: 0,
        full: 0,
      };
    });
    filteredAvailability.forEach(a => {
      if (stats[a.workerId]) {
        stats[a.workerId].total++;
        stats[a.workerId][a.shiftType]++;
      }
    });
    return Object.values(stats);
  }, [filteredAvailability, workers]);

  if (!isManager) {
    return (
      <Layout>
        <div className="card p-8 text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-surface-800">Staff Availability</h2>
          <p className="text-surface-500 mt-2">This page is for managers and admins only.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Staff Availability</h1>
            <p className="text-surface-500 mt-1">
              {workers.length} staff members · {filteredAvailability.length} availability entries
              {settings.enabled && ` · Min. ${settings.deadlineDays} days advance notice`}
            </p>
          </div>
        </div>

        {!settings.enabled && (
          <div className="card p-4 bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <p className="text-sm text-amber-800">Availability tracking is currently disabled. Enable it in Settings → Organization.</p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                'flex items-center justify-center gap-1.5 flex-1 sm:flex-none px-3 py-1.5 text-sm font-medium rounded-lg transition-all',
                viewMode === 'calendar' ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700'
              )}
            >
              <Calendar className="w-3.5 h-3.5" /> Calendar
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center justify-center gap-1.5 flex-1 sm:flex-none px-3 py-1.5 text-sm font-medium rounded-lg transition-all',
                viewMode === 'list' ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700'
              )}
            >
              <Users className="w-3.5 h-3.5" /> Staff
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
            <select
              value={selectedWorker}
              onChange={(e) => setSelectedWorker(e.target.value)}
              className="select-field !py-1.5 !text-xs !w-auto"
            >
              <option value="all">All Staff</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>{w.firstName} {w.lastName}</option>
              ))}
            </select>
            <button onClick={() => nav(-1)} className="btn-icon !w-8 !h-8"><ChevronLeft className="w-5 h-5" /></button>
            <h2 className="text-sm sm:text-base font-display font-semibold text-surface-900 min-w-[140px] text-center">
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h2>
            <button onClick={() => nav(1)} className="btn-icon !w-8 !h-8"><ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>

        {viewMode === 'calendar' && (
          <div className="card overflow-hidden">
            <div className="grid grid-cols-7 text-center text-[10px] sm:text-xs font-medium text-surface-500 border-b border-surface-100">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d} className="py-1.5 sm:py-2"><span className="hidden sm:inline">{d}</span><span className="sm:hidden">{d[0]}</span></div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthDays().map((d, i) => {
                if (!d) return <div key={`e${i}`} className="h-24 sm:h-32 bg-surface-50/50 border-b border-r border-surface-100" />;
                
                const dateStr = getDateStr(year, month, d);
                const dayAvailability = getAvailabilityForDate(dateStr);
                const isToday = dateStr === todayStr;
                
                return (
                  <div
                    key={d}
                    className={cn(
                      'h-24 sm:h-32 p-1 border-b border-r border-surface-100 overflow-y-auto',
                      isToday ? 'bg-brand-50/50' : ''
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn('text-[10px] sm:text-xs font-medium', isToday ? 'text-brand-600 font-bold' : 'text-surface-600')}>{d}</span>
                      {dayAvailability.length > 0 && (
                        <span className="text-[8px] bg-brand-100 text-brand-700 rounded-full px-1">{dayAvailability.length}</span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {dayAvailability.slice(0, 4).map(a => {
                        const shiftInfo = getShiftTypeInfo(a.shiftType);
                        return (
                          <div key={a.id} className={cn('text-[8px] sm:text-[9px] px-1 py-0.5 rounded truncate flex items-center gap-1', shiftInfo.color)}>
                            <User className="w-2.5 h-2.5" />
                            {a.workerName?.split(' ')[0] || 'Staff'}
                          </div>
                        );
                      })}
                      {dayAvailability.length > 4 && (
                        <div className="text-[8px] text-surface-400 text-center">+{dayAvailability.length - 4} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'list' && (
          <div className="space-y-4">
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-50 border-b border-surface-100">
                      <th className="text-left px-4 py-3 font-medium text-surface-600">Staff Member</th>
                      <th className="text-center px-4 py-3 font-medium text-surface-600">Total Days</th>
                      <th className="text-center px-4 py-3 font-medium text-amber-600">Morning</th>
                      <th className="text-center px-4 py-3 font-medium text-orange-600">Afternoon</th>
                      <th className="text-center px-4 py-3 font-medium text-indigo-600">Evening</th>
                      <th className="text-center px-4 py-3 font-medium text-emerald-600">Full Day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workerStats.filter(s => s.total > 0).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-surface-400">
                          No availability submitted yet.
                        </td>
                      </tr>
                    )}
                    {workerStats.filter(s => s.total > 0).map(stat => (
                      <tr key={stat.name} className="border-b border-surface-50 hover:bg-surface-50">
                        <td className="px-4 py-3 font-medium text-surface-800">{stat.name}</td>
                        <td className="px-4 py-3 text-center font-semibold text-brand-600">{stat.total}</td>
                        <td className="px-4 py-3 text-center text-amber-700">{stat.morning}</td>
                        <td className="px-4 py-3 text-center text-orange-700">{stat.afternoon}</td>
                        <td className="px-4 py-3 text-center text-indigo-700">{stat.evening}</td>
                        <td className="px-4 py-3 text-center text-emerald-700">{stat.full}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card p-4">
              <h3 className="text-sm font-semibold text-surface-700 mb-3">Shift Type Legend</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SHIFT_TYPES.map(type => (
                  <div key={type.id} className={cn('flex items-center gap-2 p-2 rounded-lg', type.color)}>
                    <type.icon className="w-4 h-4" />
                    <span className="text-xs font-medium">{type.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
