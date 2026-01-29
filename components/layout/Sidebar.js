'use client';

import { useRouter, usePathname } from 'next/navigation';
import { 
  HiHome, 
  HiCreditCard, 
  HiUserGroup, 
  HiChartBar, 
  HiUsers,
  HiCurrencyDollar
} from 'react-icons/hi';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { path: '/home', icon: HiHome, label: 'الرئيسية' },
    { path: '/stores', icon: HiCreditCard, label: 'المخازن' },
    { path: '/sources', icon: HiUserGroup, label: 'المصادر' },
    { path: '/customers', icon: HiUsers, label: 'العملاء' },
    { path: '/cash', icon: HiCurrencyDollar, label: 'العهدة' },
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>نظام نقاط البيع</div>
      <nav>
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;
          const navItemClasses = [
            styles.navItem,
            isActive ? styles.navItemActive : '',
          ].filter(Boolean).join(' ');
          const iconClasses = [
            styles.icon,
            isActive ? styles.iconActive : '',
          ].filter(Boolean).join(' ');
          const labelClasses = [
            styles.label,
            isActive ? styles.labelActive : '',
          ].filter(Boolean).join(' ');
          return (
            <div
              key={item.path}
              className={navItemClasses}
              onClick={() => router.push(item.path)}
            >
              <Icon className={iconClasses} />
              <span className={labelClasses}>{item.label}</span>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

