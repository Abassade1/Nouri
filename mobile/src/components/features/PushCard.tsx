import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getPushStatus, registerForPush, type PushStatus } from '@/features/notifications/push';
import { useAuth } from '@/providers/AuthProvider';
import { useLocale } from '@/providers/LocaleProvider';

import { Button, Card, Chip, Text } from '../ui';

/** Account screen: are notifications on, and a button to turn them on. Hidden where they aren't supported (web). */
export function PushCard() {
  const { t } = useTranslation('visits');
  const { profile, isPreview } = useAuth();
  const { language } = useLocale();
  const [status, setStatus] = useState<PushStatus>('unsupported');

  useEffect(() => { void getPushStatus().then(setStatus).catch(() => setStatus('unsupported')); }, []);
  if (status === 'unsupported' || isPreview || !profile) return null;

  return (
    <Card>
      <Text variant="heading">{t('push.title')}</Text>
      <Text variant="caption" color="inkMuted">{t('push.body')}</Text>
      {status === 'granted' ? <Chip tone="accent" label={t('push.on')} /> : null}
      {status === 'denied' ? <Text variant="caption" color="inkFaint">{t('push.blocked')}</Text> : null}
      {status === 'undetermined' ? <Button variant="secondary" icon="bell" label={t('push.enable')} onPress={async () => setStatus(await registerForPush(profile.id, language, true))} /> : null}
    </Card>
  );
}
