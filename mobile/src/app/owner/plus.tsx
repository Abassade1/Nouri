import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, HeroBadge, HeroHeader, Icon, Reveal, Text } from '@/components/ui';
import { photos } from '@/features/media/serviceImages';
import { plusRepo, type PlusPrice } from '@/features/plus/repo';
import { usePlus } from '@/features/plus/usePlus';
import { formatCurrency, formatDate } from '@/lib/format';
import { useLocale } from '@/providers/LocaleProvider';
import { colors, layout, radius, space } from '@/theme/tokens';

const BENEFITS = [
  { icon: 'creation', title: 'plus.unlimitedTitle', body: 'plus.unlimitedBody' },
  { icon: 'lightning-bolt', title: 'plus.priorityTitle', body: 'plus.priorityBody' },
] as const;

/** Nouri Plus: what membership includes, the price, and subscribing or managing it. */
export default function Plus() {
  const { t } = useTranslation('owner');
  const { t: tc } = useTranslation('common');
  const router = useRouter();
  const { language } = useLocale();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { status, refresh } = usePlus();
  const [price, setPrice] = useState<PlusPrice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { plusRepo.price().then(setPrice).catch(() => setPrice(null)); }, []);

  const priceLabel = price
    ? t(price.interval === 'year' ? 'plus.perYear' : 'plus.perMonth', { price: formatCurrency(price.amount_cents, price.currency, language) })
    : null;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError(t('plus.error'));
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }} showsVerticalScrollIndicator={false}>
      {focused ? <StatusBar style="light" /> : null}
      <HeroHeader image={photos.welcomeHero}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/owner'))}
          accessibilityRole="button"
          accessibilityLabel={tc('back')}
          hitSlop={12}
          style={styles.back}
        >
          <Icon name="arrow-left" size={18} color="onAccent" directional />
          <Text variant="caption" color="onAccent">{tc('back')}</Text>
        </Pressable>
        <Reveal style={styles.hero}>
          {status?.active ? (
            <HeroBadge>
              <Text variant="caption" color="onAccent">{t('plus.member')}</Text>
            </HeroBadge>
          ) : null}
          <Text variant="display" color="onAccent">{t('plus.title')}</Text>
          <Text color="onAccentMuted">{t('plus.subtitle')}</Text>
          {priceLabel && !status?.active ? <Text variant="title" color="onAccent" style={styles.price}>{priceLabel}</Text> : null}
        </Reveal>
      </HeroHeader>

      <View style={styles.body}>
        {BENEFITS.map((b, i) => (
          <Reveal key={b.title} delay={120 + i * 60}>
            <Card style={styles.benefit}>
              <View style={styles.benefitIcon}>
                <MaterialCommunityIcons name={b.icon} size={22} color={colors.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{t(b.title)}</Text>
                <Text variant="caption" color="inkMuted">{t(b.body)}</Text>
              </View>
            </Card>
          </Reveal>
        ))}

        {status?.active ? (
          <Card soft style={styles.memberCard}>
            <Text variant="heading">{t('plus.active')}</Text>
            {status.renews_at ? (
              <Text color="inkMuted">
                {t(status.cancel_at_period_end ? 'plus.ends' : 'plus.renews', { date: formatDate(status.renews_at, language) })}
              </Text>
            ) : null}
            <Button variant="secondary" label={t('plus.manage')} loading={busy} onPress={() => void run(plusRepo.manage)} />
          </Card>
        ) : (
          <View style={styles.cta}>
            <Button label={t('plus.subscribe')} icon="star" loading={busy} disabled={!status} onPress={() => void run(plusRepo.subscribe)} />
            <Text variant="caption" color="inkFaint" align="center">{t('plus.terms')}</Text>
          </View>
        )}
        {error ? <Text variant="caption" color="danger" align="center">{error}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  back: {
    flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', marginBottom: space.xl,
    paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: colors.accentFill, borderWidth: 1, borderColor: colors.accentLine,
  },
  hero: { gap: space.md },
  price: { marginTop: space.sm },
  body: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: layout.gutter, marginTop: space.xl, gap: space.md },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  benefitIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.highlightSoft, alignItems: 'center', justifyContent: 'center' },
  memberCard: { gap: space.sm, marginTop: space.sm },
  cta: { gap: space.md, marginTop: space.md },
});
