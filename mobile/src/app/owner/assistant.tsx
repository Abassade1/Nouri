import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '@/components/features/BackLink';
import { Button, Card, Icon, Text } from '@/components/ui';
import { assistantRepo, type AssistantMessage, type AssistantQuota } from '@/features/assistant/repo';
import { usePets } from '@/features/pets/hooks';
import { FunctionError } from '@/lib/functions';
import { useLocale } from '@/providers/LocaleProvider';
import { fontStyleFor } from '@/theme/fonts';
import { colors, layout, radius, shadow, space } from '@/theme/tokens';

const MAX_CHARS = 1500;

let localId = 0;
/** A message shown straight away, before the server has stored it. */
const localMessage = (role: AssistantMessage['role'], content: string): AssistantMessage => ({
  id: `local-${role}-${++localId}`, role, content, created_at: new Date().toISOString(),
});

/** Ask Nouri: a pet-care chat that knows the owner's pets. */
export default function Assistant() {
  const { t } = useTranslation('owner');
  const { language, isRTL } = useLocale();
  const router = useRouter();
  const pets = usePets();
  const scroll = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<AssistantMessage[] | null>(null);
  const [quota, setQuota] = useState<AssistantQuota | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    // Only fills an empty screen, so a slow load can't overwrite a question already sent.
    assistantRepo.history().then((h) => setMessages((m) => m ?? h)).catch(() => setMessages((m) => m ?? []));
    assistantRepo.quota().then(setQuota).catch(() => {});
  }, []);

  const outOfQuestions = !!quota && quota.daily_limit !== null && quota.used_today >= quota.daily_limit;
  const firstPet = pets?.[0]?.name;
  const suggestions = firstPet
    ? [t('assistant.suggestPet1', { pet: firstPet }), t('assistant.suggestPet2', { pet: firstPet }), t('assistant.suggestPet3', { pet: firstPet })]
    : [t('assistant.suggest1'), t('assistant.suggest2'), t('assistant.suggest3')];

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || sending || outOfQuestions) return;
    if (question.length > MAX_CHARS) return setNotice(t('assistant.tooLong'));
    setNotice(null);
    setDraft('');
    setSending(true);
    const pending = localMessage('user', question);
    setMessages((m) => [...(m ?? []), pending]);
    try {
      const res = await assistantRepo.ask(question, language);
      setQuota(res.quota);
      if (res.reply) {
        const answer = localMessage('assistant', res.reply);
        setMessages((m) => [...(m ?? []), answer]);
      } else {
        setNotice(t('assistant.declined'));
      }
    } catch (e) {
      const code = e instanceof FunctionError ? e.code : '';
      if (code === 'daily_limit_reached') {
        setMessages((m) => (m ?? []).filter((x) => x.id !== pending.id));
        setDraft(question);
        assistantRepo.quota().then(setQuota).catch(() => {});
      } else {
        setNotice(code === 'assistant_busy' ? t('assistant.busy') : code === 'message_too_long' ? t('assistant.tooLong') : t('assistant.error'));
      }
    } finally {
      setSending(false);
    }
  };

  const clear = () =>
    Alert.alert(t('assistant.clearTitle'), t('assistant.clearBody'), [
      { text: t('assistant.cancel'), style: 'cancel' },
      { text: t('assistant.clear'), style: 'destructive', onPress: () => void assistantRepo.clear().then(() => setMessages([])) },
    ]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <BackLink />
          {messages?.length ? (
            <Pressable onPress={clear} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('assistant.clear')}>
              <Icon name="trash-2" size={18} color="inkMuted" />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.thread}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.intro}>
            <View style={styles.badge}>
              <MaterialCommunityIcons name="creation" size={26} color={colors.onAccent} />
            </View>
            <Text variant="title">{t('assistant.title')}</Text>
            <Text color="inkMuted">{t('assistant.subtitle')}</Text>
            <Text variant="caption" color="inkFaint">{t('assistant.disclaimer')}</Text>
          </View>

          {messages && messages.length === 0 ? (
            <View style={styles.suggestions}>
              {suggestions.map((s) => (
                <Pressable key={s} onPress={() => void send(s)} accessibilityRole="button" style={styles.suggestion}>
                  <Text variant="bodyStrong" color="accent" style={{ flex: 1 }}>{s}</Text>
                  <Icon name="arrow-up-right" size={16} color="accent" directional />
                </Pressable>
              ))}
            </View>
          ) : null}

          {messages?.map((m) => (
            <View key={m.id} style={[styles.bubble, m.role === 'user' ? styles.mine : styles.theirs]}>
              <Text color={m.role === 'user' ? 'onAccent' : 'ink'} auto selectable>{m.content}</Text>
            </View>
          ))}

          {sending ? (
            <View style={[styles.bubble, styles.theirs, styles.thinking]}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text variant="caption" color="inkMuted">{t('assistant.thinking')}</Text>
            </View>
          ) : null}

          {notice ? <Text variant="caption" color="danger" style={styles.notice}>{notice}</Text> : null}

          {outOfQuestions ? (
            <Card style={styles.limit}>
              <Text variant="bodyStrong">{t('assistant.limitTitle')}</Text>
              <Text variant="caption" color="inkMuted">{t('assistant.limitBody')}</Text>
              <Button label={t('plus.learnMore')} icon="star" onPress={() => router.push('/owner/plus')} />
            </Card>
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          {quota ? (
            <Pressable onPress={quota.is_plus ? undefined : () => router.push('/owner/plus')} disabled={quota.is_plus}>
              <Text variant="caption" color={quota.is_plus ? 'highlight' : 'inkMuted'} align="center">
                {quota.daily_limit === null
                  ? t('assistant.quotaPlus')
                  : t('assistant.quotaLeft', { count: Math.max(0, quota.daily_limit - quota.used_today), limit: quota.daily_limit })}
              </Text>
            </Pressable>
          ) : null}
          <View style={styles.inputRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t('assistant.placeholder')}
              placeholderTextColor={colors.inkFaint}
              multiline
              maxLength={MAX_CHARS}
              editable={!outOfQuestions}
              accessibilityLabel={t('assistant.placeholder')}
              style={[styles.input, fontStyleFor(language, '400'), { textAlign: isRTL ? 'right' : 'left' }]}
            />
            <Pressable
              onPress={() => void send(draft)}
              disabled={!draft.trim() || sending || outOfQuestions}
              accessibilityRole="button"
              accessibilityLabel={t('assistant.send')}
              style={[styles.sendBtn, (!draft.trim() || sending || outOfQuestions) && styles.sendOff]}
            >
              <Icon name="arrow-up" size={20} color="onAccent" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: layout.gutter, paddingTop: space.md, paddingBottom: space.sm,
  },
  thread: { paddingHorizontal: layout.gutter, paddingBottom: space.xl, gap: space.md, width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
  intro: { gap: space.sm, marginBottom: space.md },
  badge: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  suggestions: { gap: space.sm },
  suggestion: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surface, ...shadow.card,
  },
  bubble: { maxWidth: '86%', paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.lg },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.accent, borderBottomEndRadius: radius.sm / 2 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomStartRadius: radius.sm / 2, ...shadow.card },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  notice: { alignSelf: 'center' },
  limit: { gap: space.sm },
  composer: {
    paddingHorizontal: layout.gutter, paddingTop: space.sm, paddingBottom: space.md, gap: space.sm,
    backgroundColor: colors.paper, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line,
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  input: {
    flex: 1, minHeight: layout.minTouch, maxHeight: 140, paddingHorizontal: space.lg, paddingTop: 13, paddingBottom: 13,
    fontSize: 15, color: colors.ink, backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.line,
  },
  sendBtn: { width: layout.minTouch, height: layout.minTouch, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: 0.35 },
});
