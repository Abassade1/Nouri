import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useBooking } from '@/features/bookings/hooks';
import { bookingsRepo } from '@/features/bookings/repo';
import type { Role } from '@/features/bookings/types';
import { cancelBooking } from '@/features/payments/api';
import { useConnectAccount } from '@/features/payments/useConnectAccount';
import { usePayForBooking } from '@/features/payments/usePayForBooking';
import { formatCurrency, formatDate, formatDateTime, localized } from '@/lib/format';
import { refundCents, refundPercent } from '@/lib/refunds';
import { visitsRepo, type ReviewItem } from '@/features/visits/repo';
import { useLocale } from '@/providers/LocaleProvider';
import { space } from '@/theme/tokens';

import { Button, Card, Chip, Divider, Reveal, Screen, Text, TextField } from '../../ui';
import { StarRating } from '../StarRating';
import { ReportFeed } from './ReportFeed';
import { BackLink } from '../BackLink';
import { statusTone } from './BookingRow';

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Text variant={strong ? 'bodyStrong' : 'body'} color={strong ? 'ink' : 'inkMuted'}>{label}</Text>
      <Text variant={strong ? 'bodyStrong' : 'body'}>{value}</Text>
    </View>
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function BookingDetailView({ id, role }: { id: string; role: Role }) {
  const { t } = useTranslation('bookings');
  const { t: tp } = useTranslation('payments');
  const { t: tv } = useTranslation('visits');
  const { language } = useLocale();
  const router = useRouter();
  const { booking, loaded, refresh } = useBooking(id);
  const payForBooking = usePayForBooking();
  const account = useConnectAccount(role === 'carer');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [review, setReview] = useState<ReviewItem | null>(null);
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState('');
  const [feedVersion, setFeedVersion] = useState(0);

  useEffect(() => {
    if (role === 'owner' && booking?.status === 'completed') void visitsRepo.getReview(id).then(setReview).catch(() => setReview(null));
  }, [role, booking?.status, id]);

  if (!booking) return <Screen><BackLink />{loaded ? <Text color="inkMuted">{t('detail.notFound')}</Text> : null}</Screen>;

  const money = (c: number) => formatCurrency(c, booking.currency, language);
  const s = booking.status;
  const partner = (role === 'owner' ? booking.carer_name : booking.owner_name) ?? '';

  const simpleAction = async (status: 'accepted' | 'declined' | 'cancelled') => {
    setBusy(true); setError(null);
    try {
      await bookingsRepo.setStatus(id, status, status === 'cancelled' ? `${role}_cancelled` : undefined);
      await refresh();
    } catch {
      setError(t('detail.actionError'));
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await payForBooking(id);
      if (result === 'unsupported') return setError(tp('pay.unsupported'));
      if (result === 'failed') return setError(tp('pay.failed'));
      if (result === 'cancelled') return;
      // The server confirms the booking when Stripe tells it the payment succeeded; wait for that.
      setMessage(tp('pay.processing'));
      for (let i = 0; i < 8; i++) {
        const latest = await bookingsRepo.get(id);
        if (latest?.status === 'confirmed') break;
        await wait(1500);
      }
      await refresh();
      setMessage(tp('pay.paid'));
    } catch {
      setError(tp('pay.failed'));
    } finally {
      setBusy(false);
    }
  };

  const cancelPaid = async () => {
    setBusy(true); setError(null);
    try {
      const r = await cancelBooking(id, role);
      setConfirmCancel(false);
      setMessage(tp('cancel.done', { amount: money(r.refunded_cents) }));
      await refresh();
    } catch {
      setError(tp('cancel.error'));
    } finally {
      setBusy(false);
    }
  };

  const visitStatus = async (status: 'in_progress' | 'completed') => {
    setBusy(true); setError(null);
    try {
      await bookingsRepo.setStatus(id, status);
      await refresh();
      setFeedVersion((v) => v + 1);
    } catch {
      setError(tv('visit.actionError'));
    } finally {
      setBusy(false);
    }
  };

  const sendDispute = async () => {
    if (!reason.trim()) return setError(tv('dispute.required'));
    setBusy(true); setError(null);
    try {
      await visitsRepo.disputeBooking(id, reason);
      setDisputing(false);
      setMessage(tv('dispute.sent'));
      await refresh();
    } catch {
      setError(tv('visit.actionError'));
    } finally {
      setBusy(false);
    }
  };

  // What the owner will get back if they cancel a paid booking now (same rule the server applies).
  const pct = refundPercent({ actor: role, startAt: new Date(booking.start_at), now: new Date(), policy: booking.policy });
  const refundAmount = refundCents(booking.total_cents, pct);

  const startMs = new Date(booking.start_at).getTime();
  const visitLive = ['confirmed', 'in_progress', 'completed'].includes(s);
  const canStart = role === 'carer' && s === 'confirmed' && Date.now() >= startMs - 3_600_000;
  const canFinish = role === 'carer' && ['confirmed', 'in_progress'].includes(s) && Date.now() >= startMs;
  const canReport = role === 'carer' && ['confirmed', 'in_progress'].includes(s);
  const canRaise = role === 'carer' && ['confirmed', 'in_progress', 'completed'].includes(s);
  const canDispute = role === 'owner' && s === 'completed' && !booking.transferred_at && booking.completed_at != null && Date.now() - new Date(booking.completed_at).getTime() < 7 * 86_400_000;
  const petNames = Object.fromEntries(booking.pets.map((p) => [p.id, p.name]));

  const canPay = role === 'owner' && (s === 'accepted' || s === 'payment_failed');
  const canCancelUnpaid = role === 'owner' && ['requested', 'accepted', 'payment_failed'].includes(s);
  const canCancelPaid = s === 'confirmed';
  const canRespond = role === 'carer' && s === 'requested';
  const payoutsBlock = canRespond && account.state !== 'ready' && account.state !== 'loading';

  const note =
    role === 'owner'
      ? s === 'requested' ? t('detail.requestedNote') : s === 'accepted' ? tp('pay.needsPayment') : s === 'payment_failed' ? tp('pay.failed')
        : s === 'declined' ? t('detail.declinedNote') : s === 'cancelled' ? t('detail.cancelledNote') : null
      : s === 'accepted' ? t('detail.carerAcceptedNote') : s === 'cancelled' ? t('detail.cancelledNote') : null;

  return (
    <Screen>
      <BackLink />
      <Reveal>
        <Text variant="title">{localized(booking.service.name_i18n, language)}</Text>
        <View style={{ marginTop: space.sm }}><Chip tone={statusTone(s)} label={t(`status.${s}`)} /></View>
        {note ? <Text color="inkMuted" style={{ marginTop: space.md }}>{note}</Text> : null}
        {message ? <Text color="accent" style={{ marginTop: space.md }}>{message}</Text> : null}
      </Reveal>

      <View style={styles.sections}>
        <Card>
          <Line label={t('detail.when')} value={formatDateTime(booking.start_at, language, booking.timezone)} />
          <Line label={role === 'owner' ? t('detail.carer') : t('detail.owner')} value={partner || '—'} />
          {booking.service.rate_unit === 'per_night' ? <Line label={t('detail.nights', { count: booking.quantity })} value="" /> : null}
        </Card>

        <View style={{ gap: space.sm }}>
          <Text variant="heading">{t('detail.pets')}</Text>
          {booking.pets.map((p) => (
            <Card key={p.id}>
              <Text variant="bodyStrong" auto>{p.name}</Text>
              {p.breed ? <Text variant="caption" color="inkMuted" auto>{p.breed}</Text> : null}
              {role === 'carer' && p.behaviour_notes ? <Text variant="caption" color="inkMuted" auto>{t('detail.behaviour')}: {p.behaviour_notes}</Text> : null}
              {role === 'carer' && visitLive ? <Button variant="secondary" icon="user" label={tv('visit.viewPet')} onPress={() => router.push({ pathname: '/carer/bookings/[id]/pet/[petId]', params: { id, petId: p.id } })} /> : null}
            </Card>
          ))}
        </View>

        {booking.notes ? (
          <View style={{ gap: space.sm }}>
            <Text variant="heading">{role === 'carer' ? t('detail.ownerNotes') : t('detail.notes')}</Text>
            <Card><Text auto>{booking.notes}</Text></Card>
          </View>
        ) : null}

        <View style={{ gap: space.sm }}>
          <Text variant="heading">{t('detail.price')}</Text>
          <Card>
            <Line label={t('detail.subtotal')} value={money(booking.subtotal_cents)} />
            {role === 'owner' ? (
              <>
                {booking.tax_breakdown.map((x) => <Line key={x.code} label={x.code} value={money(x.cents)} />)}
                <Divider />
                <Line strong label={t('detail.total')} value={money(booking.total_cents)} />
                {booking.paid_at ? <Line label={tp('pay.paidOn', { date: formatDate(booking.paid_at, language) })} value="" /> : null}
                {booking.refunded_cents > 0 ? <Line label={tp('pay.refunded', { amount: money(booking.refunded_cents) })} value="" /> : null}
              </>
            ) : (
              <>
                <Line label={t('detail.commission')} value={`− ${money(booking.commission_cents)}`} />
                <Divider />
                <Line strong label={t('detail.payout')} value={money(booking.carer_payout_cents)} />
              </>
            )}
          </Card>
        </View>

        {visitLive ? <ReportFeed bookingId={id} petNames={petNames} version={feedVersion} /> : null}

        {role === 'carer' && (canStart || canReport || canRaise || canFinish) ? (
          <View style={{ gap: space.sm }}>
            {canStart ? <Button label={tv('visit.start')} icon="play" onPress={() => visitStatus('in_progress')} loading={busy} /> : null}
            {canReport ? <Button variant={canStart ? 'secondary' : 'primary'} icon="clipboard" label={tv('visit.submitReport')} onPress={() => router.push({ pathname: '/carer/bookings/[id]/report', params: { id } })} /> : null}
            {canRaise ? <Button variant="secondary" icon="alert-triangle" label={tv('visit.raiseConcern')} onPress={() => router.push({ pathname: '/carer/bookings/[id]/concern', params: { id } })} /> : null}
            {canFinish ? <Button variant="secondary" icon="check-circle" label={tv('visit.complete')} onPress={() => visitStatus('completed')} disabled={busy} /> : null}
          </View>
        ) : null}

        {role === 'owner' && s === 'completed' ? (
          review ? (
            <View style={{ gap: space.sm }}>
              <Text variant="heading">{tv('review.yours')}</Text>
              <Card><StarRating value={review.rating} size={20} label={`${review.rating}`} />{review.comment ? <Text auto>{review.comment}</Text> : null}</Card>
            </View>
          ) : (
            <Button icon="star" label={tv('review.leave')} onPress={() => router.push({ pathname: '/owner/bookings/[id]/review', params: { id } })} />
          )
        ) : null}

        {canDispute && !disputing ? <Button variant="ghost" label={tv('dispute.open')} onPress={() => setDisputing(true)} /> : null}
        {canDispute && disputing ? (
          <Card>
            <Text variant="heading">{tv('dispute.title')}</Text>
            <TextField label={tv('dispute.reason')} value={reason} onChangeText={setReason} multiline />
            <View style={styles.actions}>
              <Button variant="secondary" label={tp('cancel.keep')} onPress={() => setDisputing(false)} style={{ flex: 1 }} disabled={busy} />
              <Button label={tv('dispute.submit')} onPress={sendDispute} loading={busy} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : null}

        {error ? <Text variant="caption" color="danger">{error}</Text> : null}

        {canPay ? (
          <View style={{ gap: space.sm }}>
            <Button label={s === 'payment_failed' ? tp('pay.retry') : tp('pay.confirm', { amount: money(booking.total_cents) })} icon="lock" onPress={pay} loading={busy} />
            <Text variant="caption" color="inkMuted" align="center">{tp('pay.note', { amount: money(booking.total_cents), name: partner })}</Text>
            <Text variant="caption" color="inkFaint" align="center">{tp('pay.secure')}</Text>
          </View>
        ) : null}

        {payoutsBlock ? (
          <Card soft>
            <Text>{tp('setup.needBefore')}</Text>
            <Button variant="secondary" label={tp('setup.goSetup')} onPress={() => router.push('/carer/earnings')} />
          </Card>
        ) : null}
        {canRespond ? (
          <View style={styles.actions}>
            <Button label={t('detail.accept')} onPress={() => simpleAction('accepted')} loading={busy} disabled={payoutsBlock || account.state === 'loading'} style={{ flex: 1 }} />
            <Button variant="secondary" label={t('detail.decline')} onPress={() => simpleAction('declined')} disabled={busy} style={{ flex: 1 }} />
          </View>
        ) : null}

        {canCancelUnpaid && !canCancelPaid ? (
          <Button variant="secondary" label={s === 'requested' ? t('detail.cancel') : t('detail.cancelBooking')} onPress={() => simpleAction('cancelled')} loading={busy} />
        ) : null}

        {canCancelPaid && !confirmCancel ? <Button variant="secondary" label={t('detail.cancelBooking')} onPress={() => setConfirmCancel(true)} /> : null}
        {canCancelPaid && confirmCancel ? (
          <Card>
            <Text variant="heading">{tp('cancel.title')}</Text>
            <Text color="inkMuted">
              {role === 'carer' ? tp('cancel.carerBody')
                : pct === 100 ? tp('cancel.refundFull', { amount: money(refundAmount) })
                : pct === 0 ? tp('cancel.refundNone')
                : tp('cancel.refundPartial', { percent: pct, amount: money(refundAmount), hours: booking.policy.full_refund_hours })}
            </Text>
            <View style={styles.actions}>
              <Button variant="secondary" label={tp('cancel.keep')} onPress={() => setConfirmCancel(false)} style={{ flex: 1 }} disabled={busy} />
              <Button label={tp('cancel.confirm')} onPress={cancelPaid} loading={busy} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: { gap: space.xl, marginTop: space.xl },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  actions: { flexDirection: 'row', gap: space.md },
});
