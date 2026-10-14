import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, type LanguageCode } from '@/config/app';
import { colors, layout, radius, shadow, space } from '@/theme/tokens';

import { Icon, Text } from '../ui';
import { useChooseLanguage } from './LanguageSwitcher';

/**
 * Compact language picker: a small pill showing the current language that opens a short
 * menu (each language in its own script). `light` is for the deep-forest hero.
 */
export function LanguageMenu({ light = false }: { light?: boolean }) {
  const { t } = useTranslation('account');
  const { language, choose } = useChooseLanguage();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const tone = light ? 'onAccent' : 'ink';

  const pick = (code: LanguageCode) => {
    setOpen(false);
    void choose(code);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${t('language')}: ${LANGUAGE_NAMES[language]}`}
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        style={[styles.trigger, light ? styles.triggerLight : styles.triggerDark]}
      >
        <Icon name="globe" size={14} color={tone} />
        <Text variant="caption" color={tone}>{LANGUAGE_NAMES[language]}</Text>
        <Icon name="chevron-down" size={14} color={tone} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel={t('language')}>
          <View style={[styles.menu, { top: insets.top + space.xxxl + space.lg }]} accessibilityRole="radiogroup">
            {SUPPORTED_LANGUAGES.map((code) => {
              const on = code === language;
              return (
                <Pressable
                  key={code}
                  onPress={() => pick(code)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                >
                  <Text variant={on ? 'bodyStrong' : 'body'} style={styles.itemLabel}>{LANGUAGE_NAMES[code]}</Text>
                  {on ? <Icon name="check" size={16} color="highlight" /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  triggerLight: { backgroundColor: colors.accentFill, borderColor: colors.accentLine },
  triggerDark: { backgroundColor: colors.surface, borderColor: colors.line },
  backdrop: { flex: 1 },
  menu: {
    position: 'absolute',
    end: layout.gutter,
    minWidth: 180,
    paddingVertical: space.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow.raised,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  itemPressed: { backgroundColor: colors.sunken },
  itemLabel: { flex: 1 },
});
