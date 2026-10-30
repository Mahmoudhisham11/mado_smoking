// كانت بيانات المستخدم بتتخزن في localStorage وتتقري منها الصلاحيات.
// دلوقتي الجلسة بتتبني من Firestore (lib/session.js)، وده بس لمسح البيانات القديمة.
const LEGACY_KEYS = ['uid', 'name', 'email', 'role', 'isSubscribe', 'ownerId'];

export const clearUserFromLocalStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // localStorage ممكن يكون مقفول (private mode)
  }
};
