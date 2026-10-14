/**
 * Push notification wording, in every supported language. Kept free of sensitive details:
 * a lock screen should never reveal health information, only that something needs attention.
 * Placeholders: {pet}, {title}, {rating}.
 *
 * !! First drafts: French, Arabic and Chinese need native-speaker review.
 */
export type Lang = 'en' | 'fr' | 'ar' | 'zh';
export type Template = { title: string; body: string };

export const MESSAGES: Record<string, Record<Lang, Template>> = {
  booking_requested: {
    en: { title: 'New booking request', body: 'Someone would like to book you. Open to accept or decline.' },
    fr: { title: 'Nouvelle demande de réservation', body: 'Quelqu\'un souhaite vous réserver. Ouvrez pour accepter ou refuser.' },
    ar: { title: 'طلب حجز جديد', body: 'يرغب أحدهم في حجزك. افتح التطبيق للقبول أو الرفض.' },
    zh: { title: '新的预约申请', body: '有人想预约您。打开查看并接受或拒绝。' },
  },
  booking_accepted: {
    en: { title: 'Booking accepted', body: 'Your carer accepted. Confirm and pay to secure it.' },
    fr: { title: 'Réservation acceptée', body: 'Votre intervenant a accepté. Confirmez et payez pour réserver.' },
    ar: { title: 'تم قبول الحجز', body: 'قبل مقدّم الرعاية طلبك. أكّد وادفع لتثبيت الحجز.' },
    zh: { title: '预约已被接受', body: '照护者已接受。请确认并付款以保留预约。' },
  },
  booking_declined: {
    en: { title: 'Booking declined', body: 'Your carer couldn\'t take this one. You haven\'t been charged.' },
    fr: { title: 'Réservation refusée', body: 'Votre intervenant n\'a pas pu accepter. Vous n\'avez pas été facturé.' },
    ar: { title: 'تم رفض الحجز', body: 'لم يتمكن مقدّم الرعاية من قبول هذا الطلب. لم يتم خصم أي مبلغ منك.' },
    zh: { title: '预约被拒绝', body: '照护者无法接受此次预约。您未被收费。' },
  },
  booking_confirmed: {
    en: { title: 'Booking confirmed', body: 'The owner has paid. This visit is confirmed.' },
    fr: { title: 'Réservation confirmée', body: 'Le propriétaire a payé. Cette visite est confirmée.' },
    ar: { title: 'تم تأكيد الحجز', body: 'دفع المالك. تم تأكيد هذه الزيارة.' },
    zh: { title: '预约已确认', body: '主人已付款，此次服务已确认。' },
  },
  booking_cancelled: {
    en: { title: 'Booking cancelled', body: 'A booking was cancelled. Open for details.' },
    fr: { title: 'Réservation annulée', body: 'Une réservation a été annulée. Ouvrez pour les détails.' },
    ar: { title: 'تم إلغاء الحجز', body: 'تم إلغاء أحد الحجوزات. افتح التطبيق للتفاصيل.' },
    zh: { title: '预约已取消', body: '有一个预约被取消。打开查看详情。' },
  },
  visit_report: {
    en: { title: 'Visit report', body: 'Your carer shared an update from today\'s visit.' },
    fr: { title: 'Rapport de visite', body: 'Votre intervenant a partagé un compte rendu de la visite.' },
    ar: { title: 'تقرير الزيارة', body: 'شارك مقدّم الرعاية تحديثًا عن زيارة اليوم.' },
    zh: { title: '服务报告', body: '照护者分享了今天服务的情况。' },
  },
  visit_completed: {
    en: { title: 'Visit completed', body: 'How did it go? Leave a review for your carer.' },
    fr: { title: 'Visite terminée', body: 'Comment cela s\'est-il passé ? Laissez un avis sur votre intervenant.' },
    ar: { title: 'اكتملت الزيارة', body: 'كيف سارت الأمور؟ اترك تقييمًا لمقدّم الرعاية.' },
    zh: { title: '服务已完成', body: '感觉如何？请为照护者留下评价。' },
  },
  concern_flag: {
    en: { title: 'Your carer raised a concern', body: 'Something about {pet} needs your attention. Tap to see what to do.' },
    fr: { title: 'Votre intervenant signale une préoccupation', body: 'Quelque chose concernant {pet} requiert votre attention. Touchez pour voir quoi faire.' },
    ar: { title: 'أثار مقدّم الرعاية قلقًا', body: 'هناك أمر يخص {pet} يحتاج إلى انتباهك. اضغط لمعرفة ما يجب فعله.' },
    zh: { title: '照护者提出了关注', body: '关于 {pet} 有事需要您留意。点按查看如何处理。' },
  },
  review_received: {
    en: { title: 'New review', body: 'An owner left you a {rating}-star review.' },
    fr: { title: 'Nouvel avis', body: 'Un propriétaire vous a laissé un avis de {rating} étoiles.' },
    ar: { title: 'تقييم جديد', body: 'ترك لك أحد المالكين تقييمًا بـ {rating} نجوم.' },
    zh: { title: '新评价', body: '一位主人给您留下了 {rating} 星评价。' },
  },
  booking_disputed: {
    en: { title: 'A problem was reported', body: 'An owner reported a problem with a visit. Your payout is paused while our team reviews it.' },
    fr: { title: 'Un problème a été signalé', body: 'Un propriétaire a signalé un problème lors d\'une visite. Votre versement est suspendu pendant l\'examen par notre équipe.' },
    ar: { title: 'تم الإبلاغ عن مشكلة', body: 'أبلغ أحد المالكين عن مشكلة في زيارة. تم إيقاف تحويل مستحقاتك مؤقتًا بينما يراجع فريقنا الأمر.' },
    zh: { title: '有问题被报告', body: '一位主人报告了某次服务的问题。在我们团队审核期间，您的款项已暂停发放。' },
  },
  dispute_resolved: {
    en: { title: 'Your dispute has been decided', body: 'Our team has reviewed the visit. Open to see the outcome.' },
    fr: { title: 'Le litige a été tranché', body: 'Notre équipe a examiné la visite. Ouvrez pour voir le résultat.' },
    ar: { title: 'تم البتّ في النزاع', body: 'راجع فريقنا الزيارة. افتح التطبيق لمعرفة النتيجة.' },
    zh: { title: '纠纷已有结论', body: '我们的团队已审核此次服务。打开查看结果。' },
  },
  application_approved: {
    en: { title: 'You\'re approved', body: 'Welcome aboard. Set up payouts to appear to owners.' },
    fr: { title: 'Vous êtes approuvé', body: 'Bienvenue. Configurez les versements pour apparaître aux propriétaires.' },
    ar: { title: 'تم اعتمادك', body: 'أهلاً بك. أعدّ التحويلات لتظهر للمالكين.' },
    zh: { title: '您已获批', body: '欢迎加入。设置收款后才会向宠物主人展示。' },
  },
  application_rejected: {
    en: { title: 'Your application needs changes', body: 'Please review our notes and resubmit.' },
    fr: { title: 'Votre candidature nécessite des modifications', body: 'Veuillez consulter nos commentaires et soumettre de nouveau.' },
    ar: { title: 'يتطلب طلبك تعديلات', body: 'يرجى الاطلاع على ملاحظاتنا وإعادة الإرسال.' },
    zh: { title: '您的申请需要修改', body: '请查看我们的意见并重新提交。' },
  },
  credential_expiring: {
    en: { title: 'A credential is expiring', body: '{title} expires soon. Upload a renewal to stay listed.' },
    fr: { title: 'Une qualification expire bientôt', body: '{title} expire bientôt. Téléversez un renouvellement pour rester visible.' },
    ar: { title: 'أحد المؤهلات على وشك الانتهاء', body: 'ينتهي {title} قريبًا. ارفع نسخة مجددة لتبقى ظاهرًا.' },
    zh: { title: '有资质即将到期', body: '{title} 即将到期。请上传更新后的文件以保持展示。' },
  },
};

const FALLBACK: Lang = 'en';

export function normalizeLang(code: string | null | undefined): Lang {
  return code === 'fr' || code === 'ar' || code === 'zh' ? code : FALLBACK;
}

/** Fills {placeholders} from the notification's data. Unknown kinds return null (nothing is sent). */
export function renderMessage(kind: string, language: string | null | undefined, data: Record<string, unknown>): Template | null {
  const set = MESSAGES[kind];
  if (!set) return null;
  const t = set[normalizeLang(language)];
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (_, k) => String(data[k] ?? ''));
  return { title: fill(t.title), body: fill(t.body) };
}
