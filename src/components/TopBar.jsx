'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import useStore from '@/lib/store';
import { onNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/firestore';
import { Menu, Search, Bell, X, CheckCheck } from 'lucide-react';
import { cn } from '@/utils/helpers';
import Link from 'next/link';

export default function TopBar() {
  const { userProfile, role, user } = useAuth();
  const { setSidebarOpen, searchQuery, setSearchQuery } = useStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Real-time notification listener
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onNotifications(user.uid, (notifs) => {
      setNotifications(notifs);
    });
    return () => unsub();
  }, [user?.uid]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkAllRead = async () => {
    if (!user?.uid) return;
    await markAllNotificationsRead(user.uid);
  };

  const handleNotifClick = async (n) => {
    if (!n.read) await markNotificationRead(n.id);
    setShowNotifs(false);
  };

  const timeAgo = (iso) => {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-surface-200/60 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between h-16 max-w-7xl mx-auto">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="btn-icon lg:hidden"><Menu className="w-5 h-5" /></button>
          <div className={cn('relative transition-all duration-300', searchOpen ? 'w-64 sm:w-80' : 'w-48 sm:w-64')}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onFocus={() => setSearchOpen(true)} onBlur={() => !searchQuery && setSearchOpen(false)}
              placeholder="Search staff, shifts..." className="w-full pl-9 pr-8 py-2 bg-surface-50 border border-surface-200 rounded-xl text-sm placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 focus:bg-white transition-all" />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-surface-200 transition-colors"><X className="w-3.5 h-3.5 text-surface-400" /></button>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Notifications Bell */}
          <div className="relative" ref={notifRef}>
            <button onClick={() => setShowNotifs(!showNotifs)} className="btn-icon relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px] px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification dropdown */}
            {showNotifs && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-surface-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-surface-800">Notifications</h3>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"><CheckCheck className="w-3.5 h-3.5" /> Mark all read</button>
                  )}
                </div>
                <div className="max-h-[360px] overflow-y-auto divide-y divide-surface-100">
                  {notifications.length === 0 && <p className="p-6 text-sm text-surface-400 text-center">No notifications yet.</p>}
                  {notifications.map(n => (
                    <Link key={n.id} href={n.link || '/dashboard'} onClick={() => handleNotifClick(n)}
                      className={cn('block px-4 py-3 hover:bg-surface-50 transition-colors', !n.read ? 'bg-brand-50/40' : '')}>
                      <div className="flex items-start gap-3">
                        {!n.read && <span className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm', !n.read ? 'font-semibold text-surface-800' : 'text-surface-600')}>{n.title || 'Notification'}</p>
                          <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-surface-400 mt-1">{timeAgo(n.createdAt)}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User avatar */}
          <div className="hidden sm:flex items-center gap-3 ml-2 pl-3 border-l border-surface-200">
            <div className="text-right">
              <p className="text-sm font-medium text-surface-800 leading-tight">{userProfile?.displayName || 'User'}</p>
              <p className="text-[11px] text-surface-400 capitalize">{role}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm font-bold">
              {(userProfile?.displayName || 'U')[0].toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
