'use client';
import { useState, useEffect, useCallback } from 'react';
import { getPushToken, onPushMessage, messaging } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';

export function usePushNotifications(user) {
  const [permission, setPermission] = useState('default');
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      setLoading(false);
      return;
    }
    setPermission(Notification.permission);
    setLoading(false);
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Push notifications are not supported in this browser');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        const pushToken = await getPushToken();
        if (pushToken) {
          setToken(pushToken);
          
          if (user?.uid) {
            await updateDoc(doc(db, 'users', user.uid), {
              pushToken,
              pushEnabled: true,
            });
          }
          
          toast.success('Push notifications enabled!');
          return true;
        }
      } else if (result === 'denied') {
        toast.error('Notifications blocked. Please enable them in your browser settings.');
      }
    } catch (e) {
      console.error('Error requesting notification permission:', e);
      toast.error('Failed to enable notifications');
    }
    
    return false;
  }, [user]);

  const disableNotifications = useCallback(async () => {
    if (user?.uid) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          pushEnabled: false,
        });
        setToken(null);
        toast.success('Push notifications disabled');
      } catch (e) {
        console.error('Error disabling notifications:', e);
      }
    }
  }, [user]);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  useEffect(() => {
    if (permission === 'granted' && user) {
      getPushToken().then(t => {
        if (t) setToken(t);
      });
    }
  }, [permission, user]);

  useEffect(() => {
    if (!messaging) return;
    
    const unsubscribe = onPushMessage((payload) => {
      const { title, body, icon, data } = payload.notification || {};
      
      if (title) {
        const notification = new Notification(title, {
          body,
          icon: icon || '/icons/icon.svg',
          badge: '/favicon.svg',
          data,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
          if (data?.url) {
            window.location.href = data.url;
          }
        };
      }
    });

    return () => unsubscribe();
  }, []);

  return {
    permission,
    token,
    loading,
    isEnabled: permission === 'granted' && !!token,
    requestPermission,
    disableNotifications,
  };
}
