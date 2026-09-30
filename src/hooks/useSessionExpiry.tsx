import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export function useSessionExpiry(timeoutMinutes: number = 15) {
  const { user, signOut } = useAuth();

  useEffect(() => {
    if (!user) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimeout = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        toast.error("Session expired due to inactivity. Please log in again.", { duration: 5000 });
        signOut();
      }, timeoutMinutes * 60 * 1000);
    };

    // Listen for activity events
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, resetTimeout, { passive: true });
    });

    // Initialize the timeout
    resetTimeout();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => {
        document.removeEventListener(event, resetTimeout);
      });
    };
  }, [user, signOut, timeoutMinutes]);
}
