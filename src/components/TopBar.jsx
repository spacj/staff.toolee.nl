'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import useStore from '@/lib/store';
import { onNotifications, markAllNotificationsRead, markNotificationRead, getWorkers, getShops, getShiftTemplates } from '@/lib/firestore';
import { Menu, Search, Bell, X, CheckCheck, Users, Store, Clock, Calendar, ArrowRight } from 'lucide-react';
import { cn } from '@/utils/helpers';
import Link from 'next/link';

export default function TopBar() {
  const { userProfile, role, user, orgId, isManager } = useAuth();
  const { setSidebarOpen, searchQuery, setSearchQuery } = useStore();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef(null);
  const searchRef = useRef(null);

  // Search data (loaded once, cached)
  const [searchData, setSearchData] = useState({ workers: [], shops: [], templates: [] });
  const [dataLoaded, setDataLoaded] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Notification listener
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onNotifications(user.uid, setNotifications);
    return () => unsub();
  }, [user?.uid]);

  // Load search data when search is focused
  useEffect(() => {
    if (!searchFocused || dataLoaded || !orgId) return;
    Promise.all([
      getWorkers({ orgId }),
      getShops(orgId),
      getShiftTemplates(orgId),
    ]).then(([workers, shops, templates]) => {
      setSearchData({ workers, shops, templates });
      setDataLoaded(true);
    });
  }, [searchFocused, dataLoaded, orgId]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchFocused(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Search results
  const results = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q || q.length < 2) return null;

    const workers = searchData.workers.filter(w =>
      `${w.firstName} ${w.lastName}`.toLowerCase().includes(q) ||
      w.email?.toLowerCase().includes(q) ||
      w.position?.toLowerCase().includes(q) ||
      w.phone?.includes(q)
    ).slice(0, 5);

    const shops = searchData.shops.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.address?.toLowerCase().includes(q)
    ).slice(0, 3);

    const templates = searchData.templates.filter(t =>
      t.name?.toLowerCase().includes(q) ||
      t.type?.toLowerCase().includes(q)
    ).slice(0, 3);

    // Quick nav shortcuts
    const pages = [
      { name: 'Dashboard', path: '/dashboard', keywords: 'dashboard home overview' },
      { name: 'Staff', path: '/staff', keywords: 'staff workers employees team' },
      { name: 'Calendar', path: '/calendar', keywords: 'calendar schedule shifts week month' },
      { name: 'Shift Templates', path: '/shifts', keywords: 'shift templates planning' },
      { name: 'Attendance', path: '/attendance', keywords: 'attendance clock time tracking' },
      { name: 'Shops', path: '/shops', keywords: 'shops locations stores' },
      { name: 'Costs & Billing', path: '/costs', keywords: 'costs billing payments subscription pricing' },
      { name: 'Settings', path: '/settings', keywords: 'settings preferences account' },
      { name: 'Time Tracking', path: '/time', keywords: 'time tracking clock punch' },
    ].filter(p => p.name.toLowerCase().includes(q) || p.keywords.includes(q)).slice(0, 3);

    const total = workers.length + shops.length + templates.length + pages.length;
    return { workers, shops, templates, pages, total };
  }, [searchQuery, searchData]);

  const navigate = (path) => {
    setSearchQuery('');
    setSearchFocused(false);
    router.push(path);
  };

  const handleMarkAllRead = async () => { if (user?.uid) await markAllNotificationsRead(user.uid); };
  const handleNotifClick = async (n) => { if (!n.read) await markNotificationRead(n.id); setShowNotifs(false); };
  const timeAgo = (iso) => {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-surface-200/50 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between h-16 max-w-7xl mx-auto">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="btn-icon lg:hidden"><Menu className="w-5 h-5" /></button>
          {isManager && (
          <div ref={searchRef} className={cn('relative transition-all duration-300', searchFocused ? 'w-72 sm:w-96' : 'w-48 sm:w-64')}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input type="text" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => { setSearchOpen(true); setSearchFocused(true); }}
              placeholder="Search staff, shops, pages..."
              className="w-full pl-9 pr-8 py-2 bg-surface-50 border border-surface-200 rounded-xl text-sm placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 focus:bg-white transition-all" />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-surface-200 transition-colors"><X className="w-3.5 h-3.5 text-surface-400" /></button>
            )}

            {/* Search Results Dropdown */}
            {searchFocused && results && results.total > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-surface-200 rounded-2xl shadow-xl z-50 overflow-hidden max-h-[420px] overflow-y-auto">
                {/* Pages */}
                {results.pages.length > 0 && (
                  <div>
                    <div className="px-3 py-2 bg-surface-50 text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Pages</div>
                    {results.pages.map(p => (
                      <button key={p.path} onClick={() => navigate(p.path)}
                        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-surface-50 transition-colors text-left">
                        <ArrowRight className="w-4 h-4 text-surface-400" />
                        <span className="text-sm font-medium text-surface-700">{p.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {/* Workers */}
                {results.workers.length > 0 && (
                  <div>
                    <div className="px-3 py-2 bg-surface-50 text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Staff</div>
                    {results.workers.map(w => (
                      <button key={w.id} onClick={() => navigate(`/staff/${w.id}`)}
                        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-surface-50 transition-colors text-left">
                        <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 text-xs font-bold flex-shrink-0">
                          {w.firstName?.[0]}{w.lastName?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-surface-800 truncate">{w.firstName} {w.lastName}</p>
                          <p className="text-xs text-surface-400 truncate">{w.position || w.email} · {w.status}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {/* Shops */}
                {results.shops.length > 0 && (
                  <div>
                    <div className="px-3 py-2 bg-surface-50 text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Shops</div>
                    {results.shops.map(s => (
                      <button key={s.id} onClick={() => navigate('/shops')}
                        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-surface-50 transition-colors text-left">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (s.color || '#4c6ef5') + '22' }}>
                          <Store className="w-3.5 h-3.5" style={{ color: s.color || '#4c6ef5' }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-surface-800 truncate">{s.name}</p>
                          {s.address && <p className="text-xs text-surface-400 truncate">{s.address}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {/* Templates */}
                {results.templates.length > 0 && (
                  <div>
                    <div className="px-3 py-2 bg-surface-50 text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Shift Templates</div>
                    {results.templates.map(t => (
                      <button key={t.id} onClick={() => navigate('/shifts')}
                        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-surface-50 transition-colors text-left">
                        <Clock className="w-4 h-4 text-surface-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-surface-800 truncate">{t.name}</p>
                          <p className="text-xs text-surface-400">{t.startTime}–{t.endTime} · {t.type}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* No results */}
            {searchFocused && results && results.total === 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-surface-200 rounded-2xl shadow-xl z-50 p-6 text-center">
                <p className="text-sm text-surface-400">No results for &quot;{searchQuery}&quot;</p>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <div className="relative" ref={notifRef}>
            <button onClick={() => setShowNotifs(!showNotifs)} className="btn-icon relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px] px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
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
