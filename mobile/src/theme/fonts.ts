import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';

/** Everything `useFonts` needs to load. */
export const fontAssets = {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
};

type Weight = '400' | '500' | '600';

const latin: Record<Weight, string> = {
  '400': 'IBMPlexSans_400Regular',
  '500': 'IBMPlexSans_500Medium',
  '600': 'IBMPlexSans_600SemiBold',
};
const arabic: Record<Weight, string> = {
  '400': 'IBMPlexSansArabic_400Regular',
  '500': 'IBMPlexSansArabic_500Medium',
  '600': 'IBMPlexSansArabic_600SemiBold',
};

/**
 * Pick the right font file for the current language and weight.
 * Chinese returns undefined so the OS CJK font is used (IBM Plex has no Chinese glyphs).
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
