'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import useStore from '@/lib/store';
import { cn } from '@/utils/helpers';
import { LayoutDashboard, Calendar, Clock, Settings, MessageCircle, Globe, Inbox, DollarSign, Building2, Menu } from 'lucide-react';

/**
 * Mobile bottom bar: a few high-traffic tabs + a "More" button that opens the
 * full menu drawer — instead of a long horizontally-scrolling strip of tabs.
 */
export default function MobileNav() {
  const pathname = usePathname();
  const { isManager, isAdmin, isWebmaster, isInventory } = useAuth();
  const { setSidebarOpen } = useStore();

  const managerItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { href: '/calendar', icon: Calendar, label: 'Schedule' },
    { href: '/attendance', icon: Clock, label: 'Attendance' },
    { href: '/chat', icon: MessageCircle, label: 'Chat' },
  ];
  const workerItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { href: '/time', icon: Clock, label: 'My Time' },
    { href: '/calendar', icon: Calendar, label: 'Schedule' },
    { href: '/chat', icon: MessageCircle, label: 'Chat' },
  ];
  const webmasterItems = [
    { href: '/webmaster', icon: Globe, label: 'Dashboard' },
    { href: '/webmaster/tickets', icon: Inbox, label: 'Tickets' },
    { href: '/webmaster/sales', icon: DollarSign, label: 'Sales' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ];
  const inventoryItems = [
    { href: '/inventory', icon: Building2, label: 'Orgs' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ];

  let items, showMore;
  if (isWebmaster) { items = webmasterItems; showMore = false; }
  else if (isInventory) { items = inventoryItems; showMore = false; }
  else if (isAdmin || isManager) { items = managerItems; showMore = true; }
  else { items = workerItems; showMore = true; }

  const cols = items.length + (showMore ? 1 : 0);
  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30">
      <div className="mx-2 sm:mx-3 mb-2 sm:mb-3 bg-white/90 backdrop-blur-xl border border-surface-200/60 rounded-2xl shadow-lg safe-area-bottom">
        <div className="grid py-1.5 px-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-medium transition-all',
                  active ? 'text-brand-600 bg-brand-50' : 'text-surface-400 hover:text-surface-600'
                )}>
                <item.icon className={cn('w-5 h-5', active && 'text-brand-600')} />
                {item.label}
              </Link>
            );
          })}
          {showMore && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-medium text-surface-400 hover:text-surface-600 transition-all"
            >
              <Menu className="w-5 h-5" />
              More
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
