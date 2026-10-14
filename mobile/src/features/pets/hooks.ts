import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '@/providers/AuthProvider';
import type { Pet, PetDetail } from '@/types/pets';

import { petsRepo } from './repo';

/** The owner's pets; reloads whenever the screen regains focus (e.g. after saving). */
export function usePets() {
  const { profile } = useAuth();
  const [pets, setPets] = useState<Pet[] | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      void petsRepo.listPets(profile.id).then(setPets).catch(() => setPets([]));
    }, [profile]),
  );
  return pets;
}

export function usePetDetail(petId: string | undefined) {
  const [detail, setDetail] = useState<PetDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    if (!petId) return;
    try {
      setDetail(await petsRepo.getPet(petId));
    } catch {
      setDetail(null);
    }
    setLoaded(true);
  }, [petId]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  return { detail, loaded, refresh };
}
