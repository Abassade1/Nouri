import { useLocalSearchParams } from 'expo-router';

import { BookingDetailView } from '@/components/features/bookings/BookingDetailView';

export default function OwnerBookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BookingDetailView id={id} role="owner" />;
}
