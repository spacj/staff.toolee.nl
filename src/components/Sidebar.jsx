'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/helpers';
import { LayoutDashboard, Users, Store, Calendar, Clock, FileCheck, CreditCard, Settings, LogOut, Shield, ClipboardList } from 'lucide-react';

export default function Sidebar({ mobile, onClose }) {
  const pathname = usePathname();
  const { signOut, isAdmin, isManager, organization } = useAuth();

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
    <div className={cn('flex flex-col h-full bg-white border-r border-surface-200', mobile ? 'w-72' : 'w-64')}>
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-surface-100 flex-shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={onClose}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-display font-bold text-surface-900 tracking-tight">Staff<span className="text-brand-600">Hub</span></span>
        </Link>
        {organization?.name && (
          <span className="text-[10px] font-medium text-surface-400 bg-surface-100 px-2 py-0.5 rounded-full truncate max-w-[90px]">{organization.name}</span>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + '/');
          return (
            <Link key={link.href} href={link.href} onClick={onClose}
              className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                active ? 'bg-brand-50 text-brand-700' : 'text-surface-600 hover:bg-surface-100 hover:text-surface-800'
              )}>
              <link.icon className={cn('w-[18px] h-[18px]', active ? 'text-brand-600' : 'text-surface-400')} />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-surface-100">
        <button onClick={signOut} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-surface-500 hover:bg-red-50 hover:text-red-600 w-full transition-all">
          <LogOut className="w-[18px] h-[18px]" /> Sign Out
        </button>
      </div>
    </div>
  );
}
