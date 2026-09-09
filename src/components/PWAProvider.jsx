'use client';
import { useEffect } from 'react';

export default function PWAProvider({ children }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let refreshing = false;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        // When a new SW takes over, reload once so the fresh assets are used.
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });

        // If an updated SW is waiting, activate it immediately.
        const promoteWaiting = () => {
          if (registration.waiting) {
            registration.waiting.postMessage('SKIP_WAITING');
          }
        };
        promoteWaiting();
        registration.addEventListener('updatefound', () => {
          const next = registration.installing;
          if (!next) return;
          next.addEventListener('statechange', () => {
            if (next.state === 'installed' && navigator.serviceWorker.controller) {
              promoteWaiting();
            }
          });
        });

        // Check for updates on focus so long-lived tabs don't go stale.
        window.addEventListener('focus', () => registration.update());
      } catch (error) {
        console.log('SW registration failed:', error);
      }
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
  }, []);

  return children;
}
