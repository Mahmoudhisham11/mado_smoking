'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthChange } from '../lib/firebase/auth';
import { clearUserFromLocalStorage } from '../lib/auth';
import { getUser, subscribeToUser, subscribeToMigrationStatus } from '../lib/firebase/firestore';
import { setSession, clearSession, resolveOwnerId } from '../lib/session';

const AuthContext = createContext(null);

const buildSession = (firebaseUser, userDoc) => {
  if (!firebaseUser || !userDoc?.isSubscribe) return null;
  return {
    uid: firebaseUser.uid,
    ownerId: resolveOwnerId(firebaseUser.uid, userDoc),
    role: userDoc.role || 'user',
    name: userDoc.name || firebaseUser.displayName || '',
    email: firebaseUser.email || userDoc.email || '',
  };
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [session, setSessionState] = useState(null);
  const [migration, setMigration] = useState({ ownerId: null, version: null });
  const [loading, setLoading] = useState(true);

  // الجلسة بتتحدث في الذاكرة (للـ services) وفي الـ state (للصفحات) مع بعض
  const applyUserDoc = (firebaseUser, userDoc) => {
    const next = buildSession(firebaseUser, userDoc);
    if (next) setSession(next);
    else clearSession();
    setUserData(userDoc);
    setSessionState(next);
  };

  useEffect(() => {
    // بيانات الهوية القديمة في localStorage مبقتش مستخدمة
    clearUserFromLocalStorage();

    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const userDoc = await getUser(firebaseUser.uid);
        applyUserDoc(firebaseUser, userDoc);
      } else {
        setUser(null);
        applyUserDoc(null, null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // متابعة التفعيل والصلاحية لحظياً
  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeToUser(user.uid, (userDoc) => {
      if (userDoc) applyUserDoc(user, userDoc);
    });
    return () => unsubscribe();
  }, [user]);

  // حالة ترحيل البيانات للمالك
  const ownerId = session?.ownerId;
  useEffect(() => {
    if (!ownerId) return;
    const unsubscribe = subscribeToMigrationStatus(ownerId, (version) => setMigration({ ownerId, version }));
    return () => unsubscribe();
  }, [ownerId]);
  // null = لسه بيتحمل (أو الحالة تخص مالك تاني من جلسة سابقة)
  const migrationVersion = ownerId && migration.ownerId === ownerId ? migration.version : null;

  return (
    <AuthContext.Provider value={{ user, userData, session, migrationVersion, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// الجلسة الحالية: { uid, ownerId, role, name, email, isOwner }. مضمونة جوه AuthGuard
export function useSession() {
  const { session } = useAuth();
  return session ? { ...session, isOwner: session.role === 'owner' } : { uid: null, ownerId: null, role: 'user', name: '', email: '', isOwner: false };
}
