import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';

/** Everything `useFonts` needs to load. */
export const fontAssets = {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
};

type Weight = '400' | '500' | '600';

const latin: Record<Weight, string> = {
  '400': 'Poppins_400Regular',
  '500': 'Poppins_500Medium',
  '600': 'Poppins_600SemiBold',
};
const arabic: Record<Weight, string> = {
  '400': 'IBMPlexSansArabic_400Regular',
  '500': 'IBMPlexSansArabic_500Medium',
  '600': 'IBMPlexSansArabic_600SemiBold',
};

/**
 * Pick the right font file for the current language and weight.
 * Chinese returns undefined so the OS CJK font is used (Poppins and IBM Plex have no Chinese glyphs).
 */
export function fontFamilyFor(language: string, weight: Weight): string | undefined {
  if (language === 'zh') return undefined;
  return (language === 'ar' ? arabic : latin)[weight];
}

/** Style fragment for a font: system fonts need an explicit fontWeight, bundled ones encode it in the file. */
export function fontStyleFor(language: string, weight: Weight): { fontFamily?: string; fontWeight?: Weight } {
  const family = fontFamilyFor(language, weight);
  return family ? { fontFamily: family } : { fontWeight: weight };
}
