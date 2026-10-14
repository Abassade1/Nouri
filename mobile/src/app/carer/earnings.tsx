import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Divider, EmptyState, Reveal, Screen, ScreenTitle, Text } from '@/components/ui';
import { useBookings } from '@/features/bookings/hooks';
import { listPayouts, type PayoutRow } from '@/features/payments/repo';
import { useConnectAccount } from '@/features/payments/useConnectAccount';
import { formatCurrency, formatDate, localized } from '@/lib/format';
import { releaseAt, releaseState, summarizeEarnings } from '@/lib/earnings';
import { useAuth } from '@/providers/AuthProvider';
import { useLocale } from '@/providers/LocaleProvider';
import { space } from '@/theme/tokens';

export default function CarerEarnings() {
  const { t } = useTranslation('carer');
  const { t: tp } = useTranslation('payments');
  const { language } = useLocale();
  const { profile } = useAuth();
  const account = useConnectAccount();
  const { items } = useBookings('carer');
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);

  useEffect(() => {
    if (profile) void listPayouts(profile.id).then(setPayouts).catch(() => setPayouts([]));
  }, [profile]);

  const bookings = items ?? [];
  const summary = summarizeEarnings(bookings);
  const currency = bookings[0]?.currency ?? 'CAD';
  const holdHours = bookings[0]?.policy.payout_hold_hours ?? 24;
  const money = (c: number) => formatCurrency(c, currency, language);
  const history = bookings.filter((b) => releaseState(b) !== 'none').sort((a, b) => b.start_at.localeCompare(a.start_at)).slice(0, 15);

  return (
    <Screen edges={['top']}>
      <ScreenTitle title={t('earnings.title')} />

      {account.state !== 'ready' && account.state !== 'loading' ? (
        <Reveal>
          <Card style={{ marginBottom: space.lg }}>
            <Text variant="heading">{tp('setup.title')}</Text>
            <Text color="inkMuted">{account.state === 'in_progress' ? tp('setup.pendingBody') : tp('setup.body')}</Text>
            {account.error ? <Text variant="caption" color="danger">{tp('setup.error')}</Text> : null}
            <Button label={account.state === 'in_progress' ? tp('setup.continue') : tp('setup.start')} icon="credit-card" onPress={account.setup} loading={account.busy} />
          </Card>
        </Reveal>
      ) : null}

      <Reveal delay={80}>
        <Card>
          <Text variant="overline" color="inkFaint">{t('earnings.thisMonth')}</Text>
          <Text variant="display" style={styles.amount}>{money(summary.thisMonth)}</Text>
          <Divider />
          <View style={styles.row}><Text color="inkMuted">{tp('earnings.released')}</Text><Text variant="bodyStrong">{money(summary.released)}</Text></View>
          <View style={styles.row}><Text color="inkMuted">{tp('earnings.pending')}</Text><Text variant="bodyStrong">{money(summary.pending)}</Text></View>
          <View style={styles.row}><Text color="inkMuted">{tp('earnings.upcoming')}</Text><Text variant="bodyStrong">{money(summary.upcoming)}</Text></View>
          <Text variant="caption" color="inkFaint">{tp('earnings.holdNote', { hours: holdHours })}</Text>
          {account.state === 'ready' ? (
            <View style={{ gap: space.sm, marginTop: space.sm }}>
              <Chip tone="accent" label={tp('setup.ready')} />
              <Button variant="secondary" label={tp('setup.manage')} onPress={account.manage} loading={account.busy} />
            </View>
          ) : null}
        </Card>
      </Reveal>

      <View style={styles.section}>
        <Text variant="heading">{tp('earnings.history')}</Text>
        {history.length === 0 ? <EmptyState icon="credit-card" title={t('earnings.emptyTitle')} body={tp('earnings.noHistory')} /> : history.map((b) => {
          const state = releaseState(b);
          const when = releaseAt(b, b.policy.payout_hold_hours);
          return (
            <Card key={b.id}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{localized(b.service.name_i18n, language)}</Text>
                  <Text variant="caption" color="inkMuted" auto>{b.owner_name} · {formatDate(b.start_at, language, b.timezone)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text variant="bodyStrong">{money(b.carer_payout_cents)}</Text>
                  <Chip tone={state === 'released' ? 'accent' : 'neutral'} label={tp(`earnings.state.${state as 'released' | 'pending' | 'upcoming'}`, { date: when ? formatDate(when, language) : '' })} />
                </View>
              </View>
            </Card>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text variant="heading">{tp('earnings.bankPayouts')}</Text>
        {payouts.length === 0 ? <Text variant="caption" color="inkMuted">{tp('earnings.noPayouts')}</Text> : payouts.map((p) => (
          <Card key={p.id}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{formatCurrency(p.amount_cents, p.currency, language)}</Text>
                <Text variant="caption" color="inkFaint">{formatDate(p.paid_at ?? p.created_at, language)}</Text>
              </View>
              <Chip tone={p.status === 'paid' ? 'accent' : p.status === 'failed' ? 'danger' : 'neutral'} label={tp(`earnings.payoutStatus.${p.status}`)} />
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  amount: { marginTop: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  section: { gap: space.md, marginTop: space.xxl },
});
