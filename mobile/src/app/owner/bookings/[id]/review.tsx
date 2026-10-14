import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FormScreen } from '@/components/features/FormScreen';
import { StarRating } from '@/components/features/StarRating';
import { Button, Text, TextField } from '@/components/ui';
import { visitsRepo } from '@/features/visits/repo';
import { space } from '@/theme/tokens';

export default function WriteReview() {
  const { t } = useTranslation('visits');
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!rating) return setError(t('review.pickRating'));
    setBusy(true);
    setError(null);
    try {
      await visitsRepo.submitReview(id, rating, comment);
      router.back();
    } catch {
      setError(t('review.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen title={t('review.title')} footer={<View style={{ gap: space.sm }}>{error ? <Text variant="caption" color="danger" align="center">{error}</Text> : null}<Button label={t('review.submit')} onPress={submit} loading={busy} /></View>}>
      <Text variant="overline" color="accent">{t('review.rating')}</Text>
      <StarRating value={rating} onChange={setRating} size={36} label={t('review.rating')} />
      <TextField label={`${t('review.comment')} (${t('review.optional')})`} value={comment} onChangeText={setComment} multiline />
    </FormScreen>
  );
}
