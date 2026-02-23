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
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30">
      <div className="mx-2 sm:mx-3 mb-2 sm:mb-3 bg-white/90 backdrop-blur-xl border border-surface-200/60 rounded-2xl shadow-lg safe-area-bottom">
        <div className="flex items-center justify-around py-1.5 sm:py-2 px-1">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl text-[10px] font-medium transition-all',
                  active ? 'text-brand-600 bg-brand-50' : 'text-surface-400 hover:text-surface-600'
                )}>
                <item.icon className={cn('w-5 h-5', active && 'text-brand-600')} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
