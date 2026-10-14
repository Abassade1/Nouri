import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { FormScreen } from '@/components/features/FormScreen';
import { Button, Card, Chip, ChipSelect, Text, TextField } from '@/components/ui';
import { applicationRepo, type PickedFile } from '@/features/carer/repo';
import { useApplication } from '@/features/carer/useApplication';
import { formatDate } from '@/lib/format';
import { useLocale } from '@/providers/LocaleProvider';
import { space } from '@/theme/tokens';
import type { CredentialType } from '@/types/db';

const TYPES: CredentialType[] = ['vet_tech', 'trainer_cert', 'groomer_cert', 'first_aid', 'background_check', 'insurance', 'id_document', 'other'];
const MAX_BYTES = 10 * 1024 * 1024;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function CredentialsStep() {
  const { t } = useTranslation('application');
  const { language } = useLocale();
  const { data, userId, locked, refresh } = useApplication();

  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<CredentialType>('vet_tech');
  const [title, setTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [issued, setIssued] = useState('');
  const [expires, setExpires] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setAdding(false); setTitle(''); setIssuer(''); setIssued(''); setExpires(''); setFile(null); setErrors({}); setType('vet_tech');
  };

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    if (a.size && a.size > MAX_BYTES) return setErrors((e) => ({ ...e, file: t('errors.fileTooLarge') }));
    setErrors((e) => ({ ...e, file: undefined }));
    setFile({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/octet-stream', size: a.size });
  };

  const save = async () => {
    const next: typeof errors = {};
    if (!title.trim()) next.title = t('errors.required');
    if (issued && !DATE.test(issued)) next.issued = t('errors.invalidDate');
    if (expires && !DATE.test(expires)) next.expires = t('errors.invalidDate');
    if (!file) next.file = t('errors.noFile');
    setErrors(next);
    if (Object.keys(next).length || !file) return;
    setBusy(true);
    try {
      await applicationRepo.addCredential(userId, {
        type, title: title.trim(), issuer: issuer.trim() || null,
        issued_on: issued || null, expires_on: expires || null, file,
      });
      reset();
      await refresh();
    } catch {
      setErrors({ form: t('errors.locked') });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const c = data?.credentials.find((x) => x.id === id);
    if (!c) return;
    await applicationRepo.removeCredential(userId, c);
    await refresh();
  };

  return (
    <FormScreen title={t('credentials.title')} intro={t('credentials.intro')}>
      <Text variant="caption" color="inkFaint">{t('credentials.privacy')}</Text>

      {data?.credentials.length === 0 && !adding ? <Text color="inkMuted">{t('credentials.empty')}</Text> : null}

      {data?.credentials.map((c) => (
        <Card key={c.id}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{c.title}</Text>
              <Text variant="caption" color="inkMuted">{t(`credentials.types.${c.type}`)}{c.issuer ? ` · ${c.issuer}` : ''}</Text>
            </View>
            <Chip tone={c.status === 'verified' ? 'accent' : c.status === 'rejected' ? 'danger' : 'neutral'} label={t(`credentials.status.${c.status}`)} />
          </View>
          {c.expires_on ? <Text variant="caption" color="inkFaint">{t('credentials.expires', { date: formatDate(c.expires_on, language) })}</Text> : null}
          {c.review_notes ? (
            <>
              <Text variant="overline" color="inkFaint">{t('credentials.reviewNote')}</Text>
              <Text variant="caption">{c.review_notes}</Text>
            </>
          ) : null}
          {!locked && c.status !== 'verified' ? (
            <Button variant="ghost" label={t('credentials.remove')} onPress={() => void remove(c.id)} />
          ) : null}
        </Card>
      ))}

      {!locked && !adding ? <Button variant="secondary" icon="plus" label={t('credentials.add')} onPress={() => setAdding(true)} /> : null}

      {adding ? (
        <Card>
          <Text variant="overline" color="inkMuted">{t('credentials.type')}</Text>
          <ChipSelect options={TYPES.map((x) => ({ value: x, label: t(`credentials.types.${x}`) }))} selected={[type]} onChange={(v) => setType(v[0] as CredentialType)} />
          <TextField label={t('credentials.name')} placeholder={t('credentials.namePlaceholder')} value={title} onChangeText={setTitle} error={errors.title} />
          <TextField label={t('credentials.issuer')} value={issuer} onChangeText={setIssuer} />
          <TextField label={t('credentials.issuedOn')} hint={t('credentials.dateHint')} placeholder="2024-05-31" value={issued} onChangeText={setIssued} error={errors.issued} ltr keyboardType="numbers-and-punctuation" />
          <TextField label={t('credentials.expiresOn')} hint={t('credentials.dateHint')} placeholder="2027-05-31" value={expires} onChangeText={setExpires} error={errors.expires} ltr keyboardType="numbers-and-punctuation" />
          <Button variant="secondary" icon="paperclip" label={file ? `${t('credentials.fileChosen')}: ${file.name}` : t('credentials.chooseFile')} onPress={pick} />
          {errors.file ? <Text variant="caption" color="danger">{errors.file}</Text> : null}
          {errors.form ? <Text variant="caption" color="danger">{errors.form}</Text> : null}
          <View style={styles.actions}>
            <Button label={busy ? t('credentials.uploading') : t('credentials.save')} onPress={save} loading={busy} style={{ flex: 1 }} />
            <Button variant="ghost" label={t('credentials.remove')} onPress={reset} />
          </View>
        </Card>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  actions: { flexDirection: 'row', gap: space.md, alignItems: 'center', marginTop: space.sm },
});
