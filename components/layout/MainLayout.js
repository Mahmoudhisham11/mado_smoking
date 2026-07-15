'use client';

import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import styles from './MainLayout.module.css';

export default function MainLayout({ children }) {
  return (
    <div className={styles.container}>
      <div className={styles.sidebarWrapper}>
        <Sidebar />
      </div>
      <main className={styles.mainContent}>
        {children}
      </main>
      <div className={styles.bottomNavWrapper}>
        <BottomNav />
      </div>
    </div>
  );
}
