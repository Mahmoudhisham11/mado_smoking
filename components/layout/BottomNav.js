'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { HiHome, HiCube, HiOfficeBuilding, HiPlus, HiUserGroup, HiClipboardList, HiCash, HiTruck } from 'react-icons/hi';
import styles from './BottomNav.module.css';

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [clickedItem, setClickedItem] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const mainItems = [
    { path: '/home', icon: HiHome, label: 'الرئيسية' },
    { path: '/items', icon: HiCube, label: 'الأصناف' },
    { path: '/stores', icon: HiOfficeBuilding, label: 'المخازن' },
  ];

  const menuItems = [
    { path: '/customers', icon: HiUserGroup, label: 'العملاء' },
    { path: '/custodies', icon: HiClipboardList, label: 'العهد' },
    { path: '/expenses', icon: HiCash, label: 'المصاريف' },
    { path: '/sources', icon: HiTruck, label: 'المصادر' },
  ];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !e.target.closest(`.${styles.plusButton}`)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleClick = (itemPath) => {
    setClickedItem(itemPath);
    setTimeout(() => {
      router.push(itemPath);
      setMenuOpen(false);
      setTimeout(() => setClickedItem(null), 300);
    }, 100);
  };

  return (
    <>
      {menuOpen && <div className={styles.overlay} onClick={() => setMenuOpen(false)} />}
      <nav className={styles.nav} role="navigation">
        {mainItems.map((item) => {
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
              {isActive && <span className={styles.label}>{item.label}</span>}
            </div>
          );
        })}

        <div className={styles.plusContainer}>
          <div
            className={`${styles.navItem} ${styles.plusButton} ${menuOpen ? styles.plusActive : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setMenuOpen(!menuOpen);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label="المزيد"
            aria-expanded={menuOpen}
          >
            <div className={styles.iconWrapper}>
              <HiPlus className={`${styles.icon} ${styles.plusIcon} ${menuOpen ? styles.plusIconRotated : ''}`} />
            </div>
          </div>

          {menuOpen && (
            <div className={styles.menu} ref={menuRef}>
              {menuItems.map((item, index) => {
                const isActive = pathname === item.path;
                const Icon = item.icon;
                return (
                  <div
                    key={item.path}
                    className={`${styles.menuItem} ${isActive ? styles.menuItemActive : ''}`}
                    style={{ animationDelay: `${index * 0.05}s` }}
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
                  >
                    <Icon className={styles.menuItemIcon} />
                    <span className={styles.menuItemLabel}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
