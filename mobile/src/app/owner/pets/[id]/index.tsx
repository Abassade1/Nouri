import { useLocalSearchParams } from 'expo-router';

import { PetProfileView } from '@/components/features/pets/PetProfileView';

export default function PetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PetProfileView petId={id} />;
}
