import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { APP_NAME, LANGUAGE_NAMES, SUPPORTED_LANGUAGES, type LanguageCode } from '@/config/app';
import { useLocale } from '@/providers/LocaleProvider';
import { colors, layout, radius, space } from '@/theme/tokens';

import { Text } from '../ui';

/**
 * Segmented picker showing each language in its own script. Switching to or from
 * Arabic flips the reading direction, which on iOS/Android needs an app restart.
 */
export function LanguageSwitcher() {
  const { language, setLanguage, restart } = useLocale();
  const { t } = useTranslation('account');

  const choose = async (next: LanguageCode) => {
    if (next === language) return;
    const { restartRequired } = await setLanguage(next);
    if (!restartRequired) return;
    if (Platform.OS === 'web') return void restart();
    Alert.alert(t('restart.title'), t('restart.body', { appName: APP_NAME }), [
      { text: t('restart.confirm'), onPress: () => void restart() },
    ]);
  };

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {SUPPORTED_LANGUAGES.map((code) => {
        const selected = code === language;
        return (
          <Pressable
            key={code}
            onPress={() => void choose(code)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.item, selected && styles.selected]}
          >
            {/* Use the target language's own script/font regardless of the current UI language */}
            <Text variant="bodyStrong" color={selected ? 'onAccent' : 'ink'}>
              {LANGUAGE_NAMES[code]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.sunken,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  item: {
    flex: 1,
    minHeight: layout.minTouch - 4,
    borderRadius: radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  selected: { backgroundColor: colors.accent },
});
