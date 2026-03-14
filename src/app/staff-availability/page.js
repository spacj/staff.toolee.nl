'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { getStaffAvailability, getWorkers, getAvailabilitySettings } from '@/lib/firestore';
import { AlertCircle, Calendar, Users, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StaffAvailabilityPage() {
  const { orgId, isManager, userProfile } = useAuth();
  
  console.log('=== StaffAvailability Debug ===');
  console.log('orgId:', orgId);
  console.log('isManager:', isManager);
  console.log('userProfile:', userProfile);
  console.log('userProfile.role:', userProfile?.role);
  console.log('================================');
  const [availability, setAvailability] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [settings, setSettings] = useState({ deadlineDays: 7, enabled: true });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  console.log('StaffAvailabilityPage - orgId:', orgId, 'isManager:', isManager);

  useEffect(() => {
    if (!orgId) {
      setError('No organization found. Please log out and log back in.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getStaffAvailability({ orgId, startDate: '2026-01-01', endDate: '2026-12-31' })
      .then(data => {
        console.log('Availability loaded:', data?.length || 0);
        setAvailability(data || []);
      })
      .catch(err => {
        console.error('Availability error:', err);
        setError('Failed to load availability: ' + err.message);
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    
    getWorkers({ orgId, status: 'active' })
      .then(data => {
        console.log('Workers loaded:', data?.length || 0);
        setWorkers(data || []);
      })
      .catch(err => {
        console.error('Workers error:', err);
      });
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    
    getAvailabilitySettings(orgId)
      .then(data => {
        console.log('Settings loaded:', data);
        setSettings(data || { deadlineDays: 7, enabled: true });
      })
      .catch(err => {
        console.error('Settings error:', err);
      });
  }, [orgId]);

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
              {loading ? 'Loading...' : `${workers.length} staff members · ${availability.length} availability entries`}
              {settings.enabled && settings.deadlineDays && ` · Min. ${settings.deadlineDays} days advance notice`}
            </p>
          </div>
        </div>

        {error && (
          <div className="card p-4 bg-red-50 border border-red-200">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            <span className="ml-2">Loading availability data...</span>
          </div>
        )}

        {!loading && !error && (
          <div className="card p-8">
            <h2 className="text-lg font-semibold mb-4">Availability Overview</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-surface-50 rounded-lg">
                <p className="text-2xl font-bold text-brand-600">{workers.length}</p>
                <p className="text-sm text-surface-600">Staff Members</p>
              </div>
              <div className="p-4 bg-surface-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{availability.length}</p>
                <p className="text-sm text-surface-600">Availability Entries</p>
              </div>
              <div className="p-4 bg-surface-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{settings.deadlineDays || 7}</p>
                <p className="text-sm text-surface-600">Days Advance Notice</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && availability.length > 0 && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-100">
                    <th className="text-left px-4 py-3 font-medium text-surface-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-surface-600">Worker</th>
                    <th className="text-left px-4 py-3 font-medium text-surface-600">Shift</th>
                  </tr>
                </thead>
                <tbody>
                  {availability.slice(0, 20).map((item, idx) => (
                    <tr key={item.id || idx} className="border-b border-surface-50">
                      <td className="px-4 py-3">{item.date}</td>
                      <td className="px-4 py-3">{item.workerName || 'Unknown'}</td>
                      <td className="px-4 py-3">{item.shiftType || 'Not specified'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {availability.length > 20 && (
              <p className="p-4 text-sm text-surface-500 text-center">
                Showing 20 of {availability.length} entries
              </p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
