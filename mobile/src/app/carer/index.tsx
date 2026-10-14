import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Reveal, Screen, ScreenTitle, Text } from '@/components/ui';
import { useConnectAccount } from '@/features/payments/useConnectAccount';
import { useCarerApplication } from '@/features/useCarerApplication';
import { space } from '@/theme/tokens';

export default function CarerToday() {
  const { t } = useTranslation('carer');
  const status = useCarerApplication();
  const router = useRouter();
  const { t: tb } = useTranslation('bookings');
  const { t: tp } = useTranslation('payments');
  const { t: tv } = useTranslation('visits');
  const account = useConnectAccount(status === 'approved');

  return (
    <Screen edges={['top']}>
      <ScreenTitle title={t('today.title')} />
      <Reveal delay={100}>
        <Card>
          <Text variant="overline" color="inkFaint">
            {t('today.applicationTitle')}
          </Text>
          {status ? (
            <>
              <View style={styles.row}>
                <Chip
                  tone={status === 'approved' ? 'accent' : status === 'rejected' || status === 'suspended' ? 'danger' : 'neutral'}
                  label={t(`today.status.${status}`)}
                />
              </View>
              <Text color="inkMuted">{t(`today.statusBody.${status}`)}</Text>
              {status !== 'approved' ? (
                <View style={styles.cta}>
                  <Button
                    variant={status === 'pending' ? 'secondary' : 'primary'}
                    label={status === 'none' ? t('today.startApplication') : status === 'pending' || status === 'suspended' ? t('today.viewApplication') : t('today.continueApplication')}
                    onPress={() => router.push('/carer/application')}
                  />
                </View>
              ) : null}
            </>
          ) : null}
        </Card>
      </Reveal>

      {status === 'approved' && account.state !== 'ready' && account.state !== 'loading' ? (
        <Reveal delay={120}>
          <Card style={{ marginTop: space.lg }}>
            <Text>{tp('setup.todayNudge')}</Text>
            <View style={styles.cta}>
              <Button label={tp('setup.start')} icon="credit-card" onPress={() => router.push('/carer/earnings')} />
            </View>
          </Card>
        </Reveal>
      ) : null}
      <Reveal delay={180}>
        <Card style={{ marginTop: space.lg }}>
          <Text variant="overline" color="inkFaint">{tb('availability.cardTitle')}</Text>
          <Text color="inkMuted">{tb('availability.cardBody')}</Text>
          <View style={styles.cta}>
            <Button variant="secondary" icon="clock" label={tb('availability.cardAction')} onPress={() => router.push('/carer/availability')} />
          </View>
        </Card>
      </Reveal>
      <Reveal delay={210}>
        <Card style={{ marginTop: space.lg }}>
          <Text variant="overline" color="inkFaint">{t('photos.cardTitle')}</Text>
          <Text color="inkMuted">{t('photos.cardBody')}</Text>
          <View style={styles.cta}>
            <Button variant="secondary" icon="image" label={t('photos.open')} onPress={() => router.push('/carer/photos')} />
          </View>
        </Card>
      </Reveal>
      <Reveal delay={240}>
        <Card style={{ marginTop: space.lg }}>
          <Text variant="overline" color="inkFaint">{tv('carerReviews.title')}</Text>
          <View style={styles.cta}>
            <Button variant="secondary" icon="star" label={tv('carerReviews.open')} onPress={() => router.push('/carer/reviews')} />
          </View>
        </Card>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: space.xs, marginBottom: space.xs },
  cta: { marginTop: space.lg, gap: space.sm },
});
