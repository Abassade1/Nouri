import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FormScreen } from '@/components/features/FormScreen';
import { Button, Checkbox } from '@/components/ui';
import { APP_NAME, CONSENT_VERSION } from '@/config/app';
import { applicationRepo } from '@/features/carer/repo';
import { useApplication } from '@/features/carer/useApplication';

export default function ConsentStep() {
  const { t } = useTranslation('application');
  const router = useRouter();
  const { data, userId, locked } = useApplication();
  const [background, setBackground] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    if (!data || filled) return;
    setBackground(!!data.profile?.background_check_consent_at);
    setTerms(!!data.profile?.terms_accepted_at);
    setFilled(true);
  }, [data, filled]);

  const save = async () => {
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await applicationRepo.saveProfile(userId, {
        background_check_consent_at: background ? (data?.profile?.background_check_consent_at ?? now) : null,
        terms_accepted_at: terms ? (data?.profile?.terms_accepted_at ?? now) : null,
        // consent version is recorded server-side from the app's CONSENT_VERSION in a later phase
      });
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen
      title={t('consent.title')}
      intro={t('consent.intro')}
      footer={!locked ? <Button label={t('consent.save')} onPress={save} loading={busy} /> : undefined}
    >
      <Checkbox checked={background} onToggle={() => !locked && setBackground((v) => !v)} label={t('consent.backgroundCheck', { appName: APP_NAME })} />
      <Checkbox checked={terms} onToggle={() => !locked && setTerms((v) => !v)} label={t('consent.terms')} />
    </FormScreen>
  );
}

void CONSENT_VERSION;
