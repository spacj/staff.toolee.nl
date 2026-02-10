'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/helpers';
import { LayoutDashboard, Users, Calendar, Clock, Settings, Store } from 'lucide-react';

export default function MobileNav() {
  const pathname = usePathname();
  const { isManager } = useAuth();

  const adminItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { href: '/staff', icon: Users, label: 'Staff' },
    { href: '/shops', icon: Store, label: 'Shops' },
    { href: '/calendar', icon: Calendar, label: 'Calendar' },
    { href: '/attendance', icon: Clock, label: 'Attend.' },
  ];
  const workerItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { href: '/time', icon: Clock, label: 'My Time' },
    { href: '/calendar', icon: Calendar, label: 'Schedule' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ];
  const items = isManager ? adminItems : workerItems;

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-surface-200 z-30 safe-area-bottom">
      <div className="flex items-center justify-around py-2 px-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href} className={cn('mobile-nav-item', active ? 'text-brand-600' : 'text-surface-400')}>
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
