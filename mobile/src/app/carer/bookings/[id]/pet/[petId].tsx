import { useLocalSearchParams } from 'expo-router';

import { PetProfileView } from '@/components/features/pets/PetProfileView';

/** A carer's read-only view of the pet they're about to look after: routine, health, medications, history. */
export default function CarerPetProfile() {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  return <PetProfileView petId={petId} readOnly />;
}
