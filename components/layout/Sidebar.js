'use client';

import { useRouter, usePathname } from 'next/navigation';
import { HiHome, HiCube, HiOfficeBuilding, HiTruck, HiUserGroup, HiClipboardList, HiCash } from 'react-icons/hi';
import styles from './Sidebar.module.css';

const navItems = [
  { path: '/home', icon: HiHome, label: 'الرئيسية' },
  { path: '/items', icon: HiCube, label: 'الأصناف' },
  { path: '/stores', icon: HiOfficeBuilding, label: 'المخازن' },
  { path: '/customers', icon: HiUserGroup, label: 'العملاء' },
  { path: '/custodies', icon: HiClipboardList, label: 'العهد' },
  { path: '/expenses', icon: HiCash, label: 'المصاريف' },
  { path: '/sources', icon: HiTruck, label: 'المصادر' },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

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
          return (
            <button
              key={item.path}
              className={navItemClasses}
              onClick={() => router.push(item.path)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
            >
              <Icon className={iconClasses} />
              <span className={styles.label}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
