import { getDocs, onSnapshot } from 'firebase/firestore';
import { AppError } from '../../domain/accounting';
import { getSession } from '../../session';

// المستخدم الحالي والمالك من الجلسة (اللي اتقرت من Firestore)
export const getUserIds = () => {
  const session = getSession();
  if (!session?.uid) return { userId: null, ownerId: null };
  return { userId: session.uid, ownerId: session.ownerId };
};

// زي getUserIds بس بترمي خطأ لو مفيش جلسة، بدل ما تعمل query بـ ownerId = null
export const requireSession = () => {
  const session = getSession();
  if (!session?.uid || !session?.ownerId) {
    throw new AppError('انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.');
  }
  return session;
};

export const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

// رسالة خطأ مفهومة للمستخدم
export const errorMessage = (error) => {
  if (error instanceof AppError) return error.message;
  if (error?.code === 'permission-denied') return 'ليس لديك صلاحية لتنفيذ هذه العملية';
  if (error?.code === 'unavailable') return 'لا يوجد اتصال بالإنترنت. يرجى المحاولة مرة أخرى.';
  if (error?.code === 'failed-precondition' && String(error.message).includes('index')) {
    return 'قاعدة البيانات تحتاج إنشاء فهارس (indexes). يرجى التواصل مع الدعم الفني.';
  }
  if (error?.code === 'aborted') return 'تعارض مع عملية أخرى في نفس الوقت. يرجى المحاولة مرة أخرى.';
  return error?.message || 'حدث خطأ غير متوقع';
};

// تغليف موحد: أي service بترجع { success, ... } أو { success: false, error }
export const run = async (label, fn) => {
  try {
    const result = await fn();
    return { success: true, ...(result || {}) };
  } catch (error) {
    if (!(error instanceof AppError)) console.error(`Error ${label}:`, error);
    return { success: false, error: errorMessage(error) };
  }
};

// معالجة أخطاء الاشتراكات اللحظية: بنبلغ الصفحة بالخطأ بدل ما نديها قايمة فاضية كأنها بيانات حقيقية
export const onSubscribeError = (label, onError) => (error) => {
  console.error(`Error subscribing to ${label}:`, error);
  if (onError) onError(errorMessage(error));
};

// ---------- بديل مؤقت لو الفهارس (indexes) لسه مانتشرتش على Firebase ----------
// الاستعلام الأساسي (بالترتيب والفترة من السيرفر) محتاج فهرس مركب. لو مش موجود،
// بنستخدم استعلام أبسط (بالمالك والطرف بس) ونفلتر ونرتب في المتصفح، فالتطبيق يفضل شغال.

const isMissingIndex = (error) => error?.code === 'failed-precondition';
const warnedIndexes = new Set();
const warnMissingIndex = (label, error) => {
  if (warnedIndexes.has(label)) return;
  warnedIndexes.add(label);
  console.warn(`[${label}] فهرس Firestore غير منشور، تم استخدام استعلام بديل أبطأ. انشر الفهارس: firebase deploy --only firestore:indexes`, error?.message);
};

// فلترة وترتيب في المتصفح بنفس شروط الاستعلام الأساسي
export const refineByDate = (field, { from = null, to = null, max = null } = {}) => (items) => {
  const f = from ? from.getTime() : -Infinity;
  const t = to ? to.getTime() : Infinity;
  const out = items
    .filter((item) => {
      const v = toDate(item[field])?.getTime() ?? 0;
      return v >= f && v <= t;
    })
    .sort((a, b) => (toDate(b[field])?.getTime() || 0) - (toDate(a[field])?.getTime() || 0));
  return max ? out.slice(0, max) : out;
};

export const subscribeWithIndexFallback = ({ label, primary, fallback, refine, map }, callback, onError) => {
  let unsubscribe = () => {};
  let stopped = false;
  const listen = (q, isFallback) => {
    unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(map);
      callback(isFallback ? refine(items) : items);
    }, (error) => {
      if (!isFallback && isMissingIndex(error)) {
        warnMissingIndex(label, error);
        if (!stopped) listen(fallback, true);
        return;
      }
      onSubscribeError(label, onError)(error);
    });
  };
  listen(primary, false);
  return () => {
    stopped = true;
    unsubscribe();
  };
};

export const getDocsWithIndexFallback = async ({ label, primary, fallback, refine, map }) => {
  try {
    return (await getDocs(primary)).docs.map(map);
  } catch (error) {
    if (!isMissingIndex(error)) throw error;
    warnMissingIndex(label, error);
    return refine((await getDocs(fallback)).docs.map(map));
  }
};
