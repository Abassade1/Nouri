import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useLocale } from '@/providers/LocaleProvider';
import { fontStyleFor } from '@/theme/fonts';
import { colors, layout, radius, space } from '@/theme/tokens';

import { Icon } from './Icon';
import { Text } from './Text';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  hint?: string;
  error?: string | null;
  /** Emails, passwords and codes are always typed left-to-right, even in Arabic. */
  ltr?: boolean;
};

export function TextField({ label, hint, error, ltr, secureTextEntry, ...rest }: Props) {
  const { language, isRTL } = useLocale();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);

  return (
    <View style={styles.wrap}>
      <Text variant="caption" color="inkMuted" style={styles.label}>
        {label}
      </Text>
      <View style={[styles.box, rest.multiline && styles.multiline, focused && styles.focused, !!error && styles.errored]}>
        <TextInput
          {...rest}
          secureTextEntry={hidden}
          accessibilityLabel={label}
          placeholderTextColor={colors.inkFaint}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[
            styles.input,
            rest.multiline ? { minHeight: 112, textAlignVertical: 'top' } : null,
            fontStyleFor(language, '400'),
            ltr ? { writingDirection: 'ltr', textAlign: isRTL ? 'right' : 'left' } : null,
          ]}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={12} accessibilityRole="button">
            <Icon name={hidden ? 'eye' : 'eye-off'} size={18} color="inkMuted" />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" color="danger" style={styles.below}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="inkFaint" style={styles.below}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  label: { marginBottom: 2 },
  box: {
    minHeight: layout.minTouch + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  multiline: { alignItems: 'flex-start' },
  focused: { borderColor: colors.accent },
  errored: { borderColor: colors.danger },
  input: { flex: 1, fontSize: 16, color: colors.ink, paddingVertical: space.md, outlineStyle: 'none' as never },
  below: { marginTop: 2 },
});
