import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { FormScreen } from '@/components/features/FormScreen';
import { Button, Card, Text, TextField } from '@/components/ui';
import { applicationRepo } from '@/features/carer/repo';
import { useApplication } from '@/features/carer/useApplication';
import { isValidEmail } from '@/lib/validation';
import { space } from '@/theme/tokens';

export default function ReferencesStep() {
  const { t } = useTranslation('application');
  const { data, userId, locked, refresh } = useApplication();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);

  const reset = () => { setAdding(false); setName(''); setRelationship(''); setEmail(''); setPhone(''); setErrors({}); };

  const save = async () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('errors.required');
    if (!email.trim() && !phone.trim()) next.contact = t('errors.contactRequired');
    if (email.trim() && !isValidEmail(email)) next.email = t('errors.contactRequired');
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await applicationRepo.addReference(userId, {
        name: name.trim(), relationship: relationship.trim() || null, email: email.trim() || null, phone: phone.trim() || null,
      });
      reset();
      await refresh();
    } catch {
      setErrors({ form: t('errors.locked') });
    } finally {
      setBusy(false);
    }
  };

  const count = data?.references.length ?? 0;

  return (
    <FormScreen title={t('references.title')} intro={t('references.intro')}>
      <Text variant="caption" color={count >= 2 ? 'accent' : 'inkMuted'}>{t('references.count', { count })}</Text>
      {count === 0 && !adding ? <Text color="inkMuted">{t('references.empty')}</Text> : null}

      {data?.references.map((r) => (
        <Card key={r.id}>
          <Text variant="bodyStrong">{r.name}</Text>
          {r.relationship ? <Text variant="caption" color="inkMuted">{r.relationship}</Text> : null}
          {r.email ? <Text variant="caption" color="inkMuted">{r.email}</Text> : null}
          {r.phone ? <Text variant="caption" color="inkMuted">{r.phone}</Text> : null}
          {!locked ? (
            <Button variant="ghost" label={t('references.remove')} onPress={async () => { await applicationRepo.removeReference(userId, r.id); await refresh(); }} />
          ) : null}
        </Card>
      ))}

      {!locked && !adding ? <Button variant="secondary" icon="plus" label={t('references.add')} onPress={() => setAdding(true)} /> : null}

      {adding ? (
        <Card>
          <TextField label={t('references.name')} value={name} onChangeText={setName} error={errors.name} autoComplete="name" />
          <TextField label={t('references.relationship')} hint={t('references.relationshipHint')} value={relationship} onChangeText={setRelationship} />
          <TextField label={t('references.email')} value={email} onChangeText={setEmail} error={errors.email} ltr autoCapitalize="none" keyboardType="email-address" />
          <TextField label={t('references.phone')} value={phone} onChangeText={setPhone} ltr keyboardType="phone-pad" />
          {errors.contact ? <Text variant="caption" color="danger">{errors.contact}</Text> : <Text variant="caption" color="inkFaint">{t('references.contactHint')}</Text>}
          {errors.form ? <Text variant="caption" color="danger">{errors.form}</Text> : null}
          <View style={styles.actions}>
            <Button label={t('references.save')} onPress={save} loading={busy} style={{ flex: 1 }} />
            <Button variant="ghost" label={t('references.remove')} onPress={reset} />
          </View>
        </Card>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({ actions: { flexDirection: 'row', gap: space.md, alignItems: 'center', marginTop: space.sm } });
