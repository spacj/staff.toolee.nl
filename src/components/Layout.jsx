'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import TopBar from './TopBar';
import useStore from '@/lib/store';

const PUBLIC_PATHS = ['/login', '/register', '/join', '/'];

export default function Layout({ children }) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useStore();

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  useEffect(() => {
    if (loading) return;

    // Not logged in → send to login
    if (!user && !isPublic) {
      router.push('/login');
      return;
    }

    // Logged in but profile missing → only redirect if not already on a public page
    // This prevents the loop: registerAdmin sets profile in state before navigating
    if (user && !userProfile && !isPublic) {
      // Double-check: give Firestore a moment, then redirect if still no profile
      const timer = setTimeout(() => {
        if (!userProfile) router.push('/login');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user, userProfile, loading, pathname, router, isPublic]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-surface-500 font-medium">Loading StaffHub...</p>
        </div>
      </div>
    );
  }

  // Still waiting for profile after auth — show loader instead of blank
  if (user && !userProfile && !isPublic) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-surface-500 font-medium">Setting up your account...</p>
        </div>
      </div>
    );
  }

  if (!user || !userProfile) return null;

  return (
    <div className="flex h-screen bg-surface-50 overflow-hidden">
      <aside className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar />
      </aside>

      {sidebarOpen && (
        <>
          <div className="overlay lg:hidden" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar mobile onClose={() => setSidebarOpen(false)} />
          </aside>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-6">
            {children}
          </div>
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
