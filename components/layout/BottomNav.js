'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { 
  HiHome, 
  HiCreditCard, 
  HiUserGroup, 
  HiChartBar, 
  HiUsers,
  HiCurrencyDollar
} from 'react-icons/hi';
import styles from './BottomNav.module.css';

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [clickedItem, setClickedItem] = useState(null);

  const navItems = [
    { path: '/home', icon: HiHome, label: 'الرئيسية' },
    { path: '/stores', icon: HiCreditCard, label: 'المخازن' },
    { path: '/sources', icon: HiUserGroup, label: 'المصادر' },
    { path: '/customers', icon: HiUsers, label: 'العملاء' },
    { path: '/cash', icon: HiCurrencyDollar, label: 'العهدة' },
  ];

  const handleClick = (itemPath) => {
    setClickedItem(itemPath);
    setTimeout(() => {
      router.push(itemPath);
      setTimeout(() => {
        setClickedItem(null);
      }, 300);
    }, 100);
  };

  return (
    <nav className={styles.nav} role="navigation">
      {navItems.map((item) => {
        const isActive = pathname === item.path;
        const isClicked = clickedItem === item.path;
        const Icon = item.icon;
        return (
          <div
            key={item.path}
            className={`${styles.navItem} ${isActive ? styles.navItemActive : ''} ${isClicked ? styles.navItemClicked : ''}`}
            onClick={() => handleClick(item.path)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick(item.path);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <div className={`${styles.iconWrapper} ${isActive ? styles.iconWrapperActive : ''}`}>
              <Icon className={styles.icon} />
            </div>
            {isActive && (
              <span className={styles.label}>{item.label}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}

