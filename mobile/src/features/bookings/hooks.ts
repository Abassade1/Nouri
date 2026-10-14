import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '@/providers/AuthProvider';

import { bookingsRepo } from './repo';
import type { BookingItem, Role } from './types';

export function useBookings(role: Role) {
  const { profile } = useAuth();
  const [items, setItems] = useState<BookingItem[] | null>(null);
  const refresh = useCallback(async () => {
    if (!profile) return;
    try {
      setItems(await bookingsRepo.list(profile.id, role));
    } catch {
      setItems([]);
    }
  }, [profile, role]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return { items, refresh };
}

export function useBooking(id: string | undefined) {
  const [booking, setBooking] = useState<BookingItem | null>(null);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      setBooking(await bookingsRepo.get(id));
    } catch {
      setBooking(null);
    }
    setLoaded(true);
  }, [id]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return { booking, loaded, refresh };
}
