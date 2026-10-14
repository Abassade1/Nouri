import { useLocalSearchParams } from 'expo-router';

import { PetForm } from '@/components/features/pets/PetForm';

export default function EditPet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PetForm petId={id} />;
}
