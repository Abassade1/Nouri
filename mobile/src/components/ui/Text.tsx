import { forwardRef } from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { fontStyleFor } from '@/theme/fonts';
import { colors, typeScale, type ColorToken, type TypeVariant } from '@/theme/tokens';
import { useLocale } from '@/providers/LocaleProvider';

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  color?: ColorToken;
  /** 'center' is fine; use 'start'/'end' (never left/right) so Arabic mirrors correctly. */
  align?: 'start' | 'center' | 'end';
  /** For text people typed (names, notes): direction follows the text itself, not the app. */
  auto?: boolean;
};

/**
 * The only text component screens should use. It picks the right font for the
 * current script (Latin vs Arabic), adds line-height for Arabic, and avoids
 * letter-spacing/uppercase in Arabic where they would break the letterforms.
 */
export const Text = forwardRef<RNText, TextProps>(function Text(
  { variant = 'body', color = 'ink', align, auto, style, ...rest },
  ref,
) {
  const { language, isRTL } = useLocale();
  const spec = typeScale[variant];
  const arabic = language === 'ar';

  const base: TextStyle = {
    ...fontStyleFor(language, spec.weight as '400' | '500' | '600'),
    fontSize: spec.size,
    lineHeight: arabic ? Math.round(spec.line * 1.18) : spec.line,
    letterSpacing: arabic || language === 'zh' ? 0 : spec.tracking,
    color: colors[color],
    // Paragraph direction follows the app, not the first character, so a Latin name
    // inside Arabic UI still aligns to the start edge (and vice versa).
    ...(auto ? null : { writingDirection: isRTL ? ('rtl' as const) : ('ltr' as const) }),
    // `auto` text keeps its own reading order (dir=auto) but is aligned to the app's start edge.
    textAlign: align === 'center' ? 'center' : align === 'end' ? (isRTL ? 'left' : 'right') : auto ? (isRTL ? 'right' : 'left') : 'auto',
    ...(variant === 'overline' && !arabic ? { textTransform: 'uppercase' } : null),
  };

  return <RNText ref={ref} style={[base, style]} {...(auto ? { dir: 'auto' as const } : null)} {...rest} />;
});
