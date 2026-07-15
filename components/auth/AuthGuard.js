'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';
import styles from './AuthGuard.module.css';

export default function AuthGuard({ children }) {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (userData !== null && !userData.isSubscribe) {
        // Account is not subscribed, redirect to login
        router.push('/login?error=account_disabled');
      }
    }
  }, [user, userData, loading, router]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Wait for userData to be loaded before checking subscription
  if (userData === null) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner />
      </div>
    );
  }

  // Check if account is subscribed
  if (!userData.isSubscribe) {
    // Redirecting to login, show loading while redirecting
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner />
      </div>
    );
  }

  return <>{children}</>;
}

