'use client';

import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import styles from './MainLayout.module.css';

export default function MainLayout({ children }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Check on mount
    if (typeof window !== 'undefined') {
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }
  }, []);

  return (
    <div className={styles.container}>
      {!isMobile && <Sidebar />}
      <main className={`${styles.mainContent} ${isMobile ? 'mobile-content' : 'desktop-content'}`}>
        {children}
      </main>
      {isMobile && <BottomNav />}
    </div>
  );
}
