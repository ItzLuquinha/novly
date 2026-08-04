import { useEffect } from 'react';
import { api } from '../lib/api';

export function usePresence(location) {
  useEffect(() => {
    api.pingPresence(location || '').catch(() => {});
    const interval = setInterval(() => {
      api.pingPresence(location || '').catch(() => {});
    }, 45000);
    return () => clearInterval(interval);
  }, [location]);
}
