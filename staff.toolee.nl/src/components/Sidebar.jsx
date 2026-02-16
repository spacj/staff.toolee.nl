'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/helpers';
import { LayoutDashboard, Users, Store, Calendar, Clock, FileCheck, CreditCard, Settings, LogOut, Shield, ClipboardList, Sparkles } from 'lucide-react';

export default function Sidebar({ mobile, onClose }) {
  const pathname = usePathname();
  const { signOut, isAdmin, isManager, organization, userProfile } = useAuth();

  const adminLinks = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/staff', icon: Users, label: 'Staff' },
    { href: '/shops', icon: Store, label: 'Shops' },
    { href: '/shifts', icon: ClipboardList, label: 'Shift Templates' },
    { href: '/calendar', icon: Calendar, label: 'Calendar' },
    { href: '/attendance', icon: Clock, label: 'Attendance' },
    { href: '/costs', icon: CreditCard, label: 'Costs & Billing' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ];

  const workerLinks = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/time', icon: Clock, label: 'My Time' },
    { href: '/calendar', icon: Calendar, label: 'My Schedule' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ];

  const links = isManager ? adminLinks : workerLinks;

  return (
    <div className={cn(
      'flex flex-col h-full bg-gradient-to-b from-surface-900 to-surface-950 text-white',
      mobile ? 'w-72' : 'w-64'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10 flex-shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Shield className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="text-lg font-display font-bold tracking-tight">Staff<span className="text-brand-400">Hub</span></span>
        </Link>
      </div>

      {/* Org name */}
      {organization?.name && (
        <div className="px-5 py-3 border-b border-white/5">
          <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Organization</p>
          <p className="text-sm font-medium text-white/80 truncate mt-0.5">{organization.name}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + '/');
          return (
            <Link key={link.href} href={link.href} onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-white/10 text-white shadow-sm backdrop-blur-sm'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/90'
              )}>
              <link.icon className={cn('w-[18px] h-[18px]', active ? 'text-brand-400' : 'text-white/40')} />
              {link.label}
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400" />}
            </Link>
          );
        })}
      </nav>

      {/* User + Sign Out */}
      <div className="p-3 border-t border-white/10 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {(userProfile?.displayName || 'U')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/90 truncate">{userProfile?.displayName || 'User'}</p>
            <p className="text-[11px] text-white/40 capitalize">{userProfile?.role || 'worker'}</p>
          </div>
        </div>
        <button onClick={signOut} className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-white/50 hover:bg-white/5 hover:text-red-400 w-full transition-all">
          <LogOut className="w-[18px] h-[18px]" /> Sign Out
        </button>
      </div>
    </div>
  );
}
