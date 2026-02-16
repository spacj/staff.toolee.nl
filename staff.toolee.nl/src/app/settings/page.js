'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { updateUserProfile } from '@/lib/firestore';
import { ROLE_LABELS, cn, getInitials, generateAvatarColor } from '@/utils/helpers';
import toast from 'react-hot-toast';
import {
  User, Bell, Palette, Shield, Save, Camera,
  Mail, Phone, Building, MapPin, Globe, Clock,
  ChevronRight, ToggleLeft, ToggleRight, AlertCircle,
  Key, LogOut, Trash2, CheckCircle, Link2
} from 'lucide-react';

export default function SettingsPage() {
  const { user, userProfile, role, signOut, linkGoogleAccount, organization } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    displayName: '',
    email: '',
    phone: '',
    company: '',
    location: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Amsterdam',
    language: 'en',
  });

  const [notifications, setNotifications] = useState({
    emailShiftReminders: true,
    emailScheduleChanges: true,
    emailPaymentReceipts: true,
    pushNewShifts: true,
    pushScheduleUpdates: true,
    pushTeamChanges: false,
  });

  const [appearance, setAppearance] = useState({
    theme: 'light',
    compactMode: false,
    showWeekNumbers: false,
    startWeekOn: 'monday',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
  });

  useEffect(() => {
    if (userProfile) {
      setProfile((prev) => ({
        ...prev,
        displayName: userProfile.displayName || '',
        email: user?.email || '',
        phone: userProfile.phone || '',
        company: userProfile.company || '',
        location: userProfile.location || '',
        timezone: userProfile.timezone || prev.timezone,
        language: userProfile.language || 'en',
      }));
      if (userProfile.notifications) setNotifications(userProfile.notifications);
      if (userProfile.appearance) setAppearance(userProfile.appearance);
    }
  }, [userProfile, user]);

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      await updateUserProfile(user.uid, {
        displayName: profile.displayName,
        phone: profile.phone,
        company: profile.company,
        location: profile.location,
        timezone: profile.timezone,
        language: profile.language,
      });
      toast.success('Profile updated');
    } catch (err) {
      toast.error('Failed to update profile');
    }
    setLoading(false);
  };

  const handleSaveNotifications = async () => {
    setLoading(true);
    try {
      await updateUserProfile(user.uid, { notifications });
      toast.success('Notification preferences saved');
    } catch (err) {
      toast.error('Failed to save preferences');
    }
    setLoading(false);
  };

  const handleSaveAppearance = async () => {
    setLoading(true);
    try {
      await updateUserProfile(user.uid, { appearance });
      toast.success('Appearance settings saved');
    } catch (err) {
      toast.error('Failed to save settings');
    }
    setLoading(false);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'account', label: 'Account', icon: Shield },
  ];

  const ToggleSwitch = ({ enabled, onToggle, label, description }) => (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-surface-700">{label}</p>
        {description && <p className="text-xs text-surface-400 mt-0.5">{description}</p>}
      </div>
      <button onClick={onToggle} className="flex-shrink-0">
        {enabled ? (
          <ToggleRight className="w-10 h-6 text-brand-600" />
        ) : (
          <ToggleLeft className="w-10 h-6 text-surface-300" />
        )}
      </button>
    </div>
  );

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-surface-900">Settings</h1>
        <p className="text-surface-500 mt-1">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Tab Navigation */}
        <div className="lg:col-span-1">
          <div className="card overflow-hidden">
            <nav className="divide-y divide-surface-100">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-3 w-full px-4 py-3.5 text-sm font-medium transition-colors',
                    activeTab === tab.id
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-surface-600 hover:bg-surface-50'
                  )}
                >
                  <tab.icon className={cn('w-4 h-4', activeTab === tab.id ? 'text-brand-500' : 'text-surface-400')} />
                  {tab.label}
                  <ChevronRight className={cn('w-4 h-4 ml-auto', activeTab === tab.id ? 'text-brand-400' : 'text-surface-300')} />
                </button>
              ))}
            </nav>
          </div>

          {/* Compact mobile tab bar */}
          <div className="flex lg:hidden gap-1 mt-4 p-1 bg-surface-100 rounded-xl overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 min-w-0 py-2 px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap',
                  activeTab === tab.id ? 'bg-white text-brand-700 shadow-sm' : 'text-surface-500'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="card overflow-hidden">
              <div className="px-6 py-5 border-b border-surface-100">
                <h2 className="text-lg font-display font-semibold text-surface-900">Profile Information</h2>
                <p className="text-sm text-surface-500 mt-0.5">Update your personal details</p>
              </div>
              <div className="p-6 space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white text-xl font-bold shadow-md',
                    generateAvatarColor(profile.displayName)
                  )}>
                    {getInitials(profile.displayName.split(' ')[0], profile.displayName.split(' ')[1])}
                  </div>
                  <div>
                    <p className="font-semibold text-surface-800">{profile.displayName || 'Your Name'}</p>
                    <p className="text-sm text-surface-500 capitalize">{role} · {profile.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Display Name
                    </label>
                    <input
                      value={profile.displayName}
                      onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> Email
                    </label>
                    <input value={profile.email} disabled className="input-field bg-surface-50 text-surface-400 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="label flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> Phone
                    </label>
                    <input
                      value={profile.phone}
                      onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                      className="input-field"
                      placeholder="+31 6 1234 5678"
                    />
                  </div>
                  <div>
                    <label className="label flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5" /> Company
                    </label>
                    <input
                      value={profile.company}
                      onChange={(e) => setProfile((p) => ({ ...p, company: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Location
                    </label>
                    <input
                      value={profile.location}
                      onChange={(e) => setProfile((p) => ({ ...p, location: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Timezone
                    </label>
                    <select
                      value={profile.timezone}
                      onChange={(e) => setProfile((p) => ({ ...p, timezone: e.target.value }))}
                      className="select-field"
                    >
                      <option value="Europe/Amsterdam">Europe/Amsterdam (CET)</option>
                      <option value="Europe/London">Europe/London (GMT)</option>
                      <option value="Europe/Berlin">Europe/Berlin (CET)</option>
                      <option value="Europe/Paris">Europe/Paris (CET)</option>
                      <option value="Europe/Rome">Europe/Rome (CET)</option>
                      <option value="America/New_York">America/New_York (EST)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button onClick={handleSaveProfile} disabled={loading} className="btn-primary flex items-center gap-2">
                    <Save className="w-4 h-4" /> {loading ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="card overflow-hidden">
              <div className="px-6 py-5 border-b border-surface-100">
                <h2 className="text-lg font-display font-semibold text-surface-900">Notification Preferences</h2>
                <p className="text-sm text-surface-500 mt-0.5">Choose how you want to be notified</p>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-surface-600 uppercase tracking-wide mb-2">Email Notifications</h3>
                  <div className="divide-y divide-surface-100">
                    <ToggleSwitch
                      enabled={notifications.emailShiftReminders}
                      onToggle={() => setNotifications((n) => ({ ...n, emailShiftReminders: !n.emailShiftReminders }))}
                      label="Shift Reminders"
                      description="Get email reminders before your shifts"
                    />
                    <ToggleSwitch
                      enabled={notifications.emailScheduleChanges}
                      onToggle={() => setNotifications((n) => ({ ...n, emailScheduleChanges: !n.emailScheduleChanges }))}
                      label="Schedule Changes"
                      description="Notifications when your schedule is updated"
                    />
                    <ToggleSwitch
                      enabled={notifications.emailPaymentReceipts}
                      onToggle={() => setNotifications((n) => ({ ...n, emailPaymentReceipts: !n.emailPaymentReceipts }))}
                      label="Payment Receipts"
                      description="Receive receipts for processed payments"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-surface-600 uppercase tracking-wide mb-2">Push Notifications</h3>
                  <div className="divide-y divide-surface-100">
                    <ToggleSwitch
                      enabled={notifications.pushNewShifts}
                      onToggle={() => setNotifications((n) => ({ ...n, pushNewShifts: !n.pushNewShifts }))}
                      label="New Shifts Assigned"
                      description="When a new shift is assigned to you"
                    />
                    <ToggleSwitch
                      enabled={notifications.pushScheduleUpdates}
                      onToggle={() => setNotifications((n) => ({ ...n, pushScheduleUpdates: !n.pushScheduleUpdates }))}
                      label="Schedule Updates"
                      description="Real-time updates to the weekly schedule"
                    />
                    <ToggleSwitch
                      enabled={notifications.pushTeamChanges}
                      onToggle={() => setNotifications((n) => ({ ...n, pushTeamChanges: !n.pushTeamChanges }))}
                      label="Team Changes"
                      description="New team members or role changes"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button onClick={handleSaveNotifications} disabled={loading} className="btn-primary flex items-center gap-2">
                    <Save className="w-4 h-4" /> {loading ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="card overflow-hidden">
              <div className="px-6 py-5 border-b border-surface-100">
                <h2 className="text-lg font-display font-semibold text-surface-900">Appearance & Display</h2>
                <p className="text-sm text-surface-500 mt-0.5">Customize your viewing experience</p>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="label">Theme</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['light', 'dark', 'auto'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setAppearance((a) => ({ ...a, theme: t }))}
                        className={cn(
                          'p-3 rounded-xl border-2 text-center text-sm font-medium capitalize transition-all',
                          appearance.theme === t
                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                            : 'border-surface-200 text-surface-600 hover:border-surface-300'
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-surface-400 mt-2">Dark mode is coming soon — currently only light is fully supported.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Start Week On</label>
                    <select
                      value={appearance.startWeekOn}
                      onChange={(e) => setAppearance((a) => ({ ...a, startWeekOn: e.target.value }))}
                      className="select-field"
                    >
                      <option value="monday">Monday</option>
                      <option value="sunday">Sunday</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Date Format</label>
                    <select
                      value={appearance.dateFormat}
                      onChange={(e) => setAppearance((a) => ({ ...a, dateFormat: e.target.value }))}
                      className="select-field"
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Time Format</label>
                    <select
                      value={appearance.timeFormat}
                      onChange={(e) => setAppearance((a) => ({ ...a, timeFormat: e.target.value }))}
                      className="select-field"
                    >
                      <option value="24h">24-hour</option>
                      <option value="12h">12-hour (AM/PM)</option>
                    </select>
                  </div>
                </div>

                <div className="divide-y divide-surface-100">
                  <ToggleSwitch
                    enabled={appearance.compactMode}
                    onToggle={() => setAppearance((a) => ({ ...a, compactMode: !a.compactMode }))}
                    label="Compact Mode"
                    description="Reduce spacing for denser information display"
                  />
                  <ToggleSwitch
                    enabled={appearance.showWeekNumbers}
                    onToggle={() => setAppearance((a) => ({ ...a, showWeekNumbers: !a.showWeekNumbers }))}
                    label="Show Week Numbers"
                    description="Display ISO week numbers in the calendar"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button onClick={handleSaveAppearance} disabled={loading} className="btn-primary flex items-center gap-2">
                    <Save className="w-4 h-4" /> {loading ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              {/* Account Info */}
              <div className="card">
                <div className="px-6 py-5 border-b border-surface-100">
                  <h2 className="text-lg font-display font-semibold text-surface-900">Account Information</h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-surface-400 mb-0.5">Account ID</p>
                      <p className="text-sm font-mono text-surface-600 truncate">{user?.uid}</p>
                    </div>
                    <div>
                      <p className="text-xs text-surface-400 mb-0.5">Email</p>
                      <p className="text-sm text-surface-700">{user?.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-surface-400 mb-0.5">Role</p>
                      <p className="text-sm text-surface-700 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-brand-500" />
                        {ROLE_LABELS[role] || role}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-surface-400 mb-0.5">Organization</p>
                      <p className="text-sm text-surface-700 flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-surface-400" />
                        {organization?.name || '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Google Account Linking */}
              <div className="card">
                <div className="px-6 py-5 border-b border-surface-100">
                  <h2 className="text-lg font-display font-semibold text-surface-900">Connected Accounts</h2>
                </div>
                <div className="p-6">
                  {userProfile?.googleLinked ? (
                    <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-emerald-800">Google Account Connected</p>
                        <p className="text-xs text-emerald-600 truncate">
                          {userProfile.googleEmail || 'Linked successfully'}
                        </p>
                      </div>
                      <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-4 bg-surface-50 border border-surface-200 rounded-xl">
                      <svg className="w-6 h-6 flex-shrink-0 mt-0.5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-surface-800">Link Google Account</p>
                        <p className="text-xs text-surface-500 mt-0.5">
                          Connect your Google account for faster sign-in. You'll be able to log in with one click using "Sign in with Google".
                        </p>
                        <button
                          onClick={async () => {
                            try {
                              await linkGoogleAccount();
                              toast.success('Google account linked!');
                            } catch (err) {
                              toast.error(err.message || 'Failed to link Google account');
                            }
                          }}
                          className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-white border border-surface-200 rounded-xl text-sm font-medium text-surface-700 hover:bg-surface-50 hover:border-surface-300 transition-all shadow-card"
                        >
                          <Link2 className="w-4 h-4" />
                          Connect Google Account
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Security */}
              <div className="card">
                <div className="px-6 py-5 border-b border-surface-100">
                  <h2 className="text-lg font-display font-semibold text-surface-900">Security</h2>
                </div>
                <div className="p-6 space-y-3">
                  <button className="flex items-center gap-3 w-full p-3 rounded-xl border border-surface-200 hover:bg-surface-50 transition-colors text-left">
                    <Key className="w-5 h-5 text-surface-400" />
                    <div>
                      <p className="text-sm font-medium text-surface-700">Change Password</p>
                      <p className="text-xs text-surface-400">Update your account password</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-surface-300 ml-auto" />
                  </button>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="card border-red-200">
                <div className="px-6 py-5 border-b border-red-100">
                  <h2 className="text-lg font-display font-semibold text-red-700">Danger Zone</h2>
                </div>
                <div className="p-6 space-y-3">
                  <button
                    onClick={signOut}
                    className="flex items-center gap-3 w-full p-3 rounded-xl border border-surface-200 hover:bg-red-50 hover:border-red-200 transition-colors text-left"
                  >
                    <LogOut className="w-5 h-5 text-red-500" />
                    <div>
                      <p className="text-sm font-medium text-red-700">Sign Out</p>
                      <p className="text-xs text-surface-400">Sign out of your StaffHub account</p>
                    </div>
                  </button>
                  <button className="flex items-center gap-3 w-full p-3 rounded-xl border border-red-200 hover:bg-red-50 transition-colors text-left">
                    <Trash2 className="w-5 h-5 text-red-500" />
                    <div>
                      <p className="text-sm font-medium text-red-700">Delete Account</p>
                      <p className="text-xs text-surface-400">Permanently delete your account and all data</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
