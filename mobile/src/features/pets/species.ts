import type { PetSpecies } from '@/types/pets';

/** Every kind of companion, in the order they're offered. 'other' stays last. */
export const SPECIES: PetSpecies[] = ['dog', 'cat', 'horse', 'bird', 'rabbit', 'small_mammal', 'reptile', 'fish', 'other'];

/** MaterialCommunityIcons glyph for each species. */
export const SPECIES_ICON: Record<PetSpecies, 'dog' | 'cat' | 'horse-variant' | 'bird' | 'rabbit' | 'rodent' | 'turtle' | 'fish' | 'paw'> = {
  dog: 'dog',
  cat: 'cat',
  horse: 'horse-variant',
  bird: 'bird',
  rabbit: 'rabbit',
  small_mammal: 'rodent',
  reptile: 'turtle',
  fish: 'fish',
  other: 'paw',
};
