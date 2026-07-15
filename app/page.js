'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import styles from './page.module.css';

export default function LoadingPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // Check if user data is loaded
        // If userData is null, it means user doesn't exist in Firestore
        // Redirect to login page (account not activated)
        if (userData === null) {
          router.push('/login?error=account_disabled');
          return;
        }
        
        // Check if account is subscribed
        if (userData?.isSubscribe) {
          router.push('/home');
        } else {
          // Account is not subscribed, redirect to login
          router.push('/login?error=account_disabled');
        }
      } else {
        router.push('/login');
      }
    }
  }, [user, userData, loading, router]);

  return (
    <div className={styles.container}>
      <div className={styles.title}>
        نظام نقاط البيع - مادو للتدخين
      </div>
      <LoadingSpinner size={50} />
    </div>
  );
}
