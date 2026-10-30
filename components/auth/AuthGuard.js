'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { MIGRATION_VERSION } from '../../lib/firebase/firestore';
import LoadingSpinner from '../ui/LoadingSpinner';
import MigrationGate from '../maintenance/MigrationGate';
import styles from './AuthGuard.module.css';

// الصفحات بتحط محتواها كـ children، فالمحتوى (واشتراكاته) مايشتغلش غير بعد ما الجلسة تجهز
export default function AuthGuard({ children }) {
  const { user, userData, session, migrationVersion, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (userData !== null && !userData.isSubscribe) {
        router.push('/login?error=account_disabled');
      }
    }
  }, [user, userData, loading, router]);

  const spinner = (
    <div className={styles.loadingContainer}>
      <LoadingSpinner />
    </div>
  );

  if (loading) return spinner;
  if (!user) return null;
  if (userData === null || !userData.isSubscribe || !session) return spinner;
  if (migrationVersion === null) return spinner;
  if (migrationVersion < MIGRATION_VERSION) return <MigrationGate />;

  return <>{children}</>;
}
