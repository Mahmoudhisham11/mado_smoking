// الجلسة الحالية في الذاكرة. بيملاها AuthContext بعد ما يقرأ مستند المستخدم من Firestore،
// فالـ ownerId والصلاحية مصدرهم السيرفر مش localStorage.

let current = null;

export const resolveOwnerId = (uid, userDoc) => {
  if (!uid) return null;
  if (userDoc?.role === 'owner') return uid;
  return userDoc?.ownerId || uid;
};

export const setSession = (session) => {
  current = session;
};

export const clearSession = () => {
  current = null;
};

export const getSession = () => current;
