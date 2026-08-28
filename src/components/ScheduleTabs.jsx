'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/helpers';
import { Calendar, CalendarCheck } from 'lucide-react';

/**
 * Unified sub-nav for the scheduling hub. Calendar (Schedule) and Availability
 * are two tabs of one section, so they no longer need separate menu entries.
 * The Availability target is role-aware: managers → staff availability,
 * workers → their own availability.
 */
export default function ScheduleTabs() {
  const pathname = usePathname();
  const { isManager } = useAuth();
  const availHref = isManager ? '/staff-availability' : '/availability';
  const tabs = [
    { href: '/calendar', label: isManager ? 'Schedule' : 'My Schedule', icon: Calendar },
    { href: availHref, label: 'Availability', icon: CalendarCheck },
  ];
  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="inline-flex gap-1 bg-surface-100 rounded-xl p-1">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href}
          className={cn(
            'flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-sm font-medium rounded-lg transition-all',
            isActive(t.href) ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700'
          )}>
          <t.icon className="w-4 h-4" /> {t.label}
        </Link>
      ))}
    </div>
  );
}
