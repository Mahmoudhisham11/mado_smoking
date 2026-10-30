'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '../../components/auth/AuthGuard';
import MainLayout from '../../components/layout/MainLayout';
import SummaryCard from '../../components/dashboard/SummaryCard';
import Card from '../../components/ui/Card';
import { useTheme } from '../../contexts/ThemeContext';
import { logout } from '../../lib/firebase/auth';
import { useSession } from '../../contexts/AuthContext';
import { sumMoney } from '../../lib/domain/accounting';
import { subscribeToStores, subscribeToCustomers, subscribeToSources, subscribeToProducts, subscribeToCustodies, subscribeTodayExpenses } from '../../lib/firebase/firestore';
import { HiEye, HiEyeOff, HiLogout, HiCog, HiCube, HiOfficeBuilding, HiUserGroup, HiTruck, HiClipboardList, HiCash, HiArrowLeft, HiChartBar } from 'react-icons/hi';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <AuthGuard>
      <MainLayout>
        <HomeContent />
      </MainLayout>
    </AuthGuard>
  );
}

function HomeContent() {
  const session = useSession();
  const { themeMode, setTheme } = useTheme();
  const router = useRouter();
  const [isNumbersHidden, setIsNumbersHidden] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const [stores, setStores] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sources, setSources] = useState([]);
  const [products, setProducts] = useState([]);
  const [custodies, setCustodies] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const userName = session.name || 'مستخدم';
  const userRole = session.role;

  useEffect(() => {
    const unsub1 = subscribeToStores((data) => { setStores(data); setLoading(false); });
    const unsub2 = subscribeToCustomers((data) => setCustomers(data));
    // الموردين للمالك فقط (القواعد بتمنعها عن المستخدم العادي)
    const unsub3 = session.isOwner ? subscribeToSources((data) => setSources(data)) : () => {};
    const unsub4 = subscribeToProducts((data) => setProducts(data));
    const unsub5 = subscribeToCustodies((data) => setCustodies(data));
    // مصاريف النهارده بس، مش كل المصاريف
    const unsub6 = subscribeTodayExpenses((data) => setExpenses(data));
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); };
  }, [session.isOwner]);

  const totalCustodyAmount = sumMoney(custodies, (c) => c.amount);
  const todayExpensesTotal = sumMoney(expenses, (e) => e.amount);

  const formatPrice = (val) => {
    const num = Number(val);
    return isNaN(num) ? '0' : num.toLocaleString();
  };

  const getInitials = (name) => {
    if (!name) return 'م';
    const words = name.trim().split(' ');
    if (words.length >= 2) return (words[0][0] || '') + (words[1][0] || '');
    return name.substring(0, 2) || 'م';
  };

  const userInitials = getInitials(userName);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserMenu && !event.target.closest('[data-user-menu]')) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const quickActions = [
    { label: 'التقارير', icon: HiChartBar, path: '/reports', color: '#c9a14a' },
    { label: 'الأصناف', icon: HiCube, path: '/items', color: '#3b82f6' },
    { label: 'المخازن', icon: HiOfficeBuilding, path: '/stores', color: '#10b981' },
    { label: 'العملاء', icon: HiUserGroup, path: '/customers', color: '#f59e0b' },
    { label: 'المصادر', icon: HiTruck, path: '/sources', color: '#8b5cf6' },
    { label: 'العهد', icon: HiClipboardList, path: '/custodies', color: '#ec4899' },
    { label: 'المصاريف', icon: HiCash, path: '/expenses', color: '#ef4444' },
  ];

  return (
    <>
        <div className={styles.container}>
          <div className={styles.header}>
            <div className={styles.userSection} data-user-menu>
              <div className={styles.avatar} onClick={() => setShowUserMenu(!showUserMenu)}>
                {userInitials}
              </div>
              <div className={styles.userInfo}>
                <div className={styles.userName}>{userName}</div>
                <div className={styles.userRole}>
                  {userRole === 'owner' ? 'مالك' : userRole === 'admin' ? 'مدير' : 'مستخدم'}
                </div>
              </div>
              {showUserMenu && (
                <div className={styles.dropdownMenu}>
                  <button className={`${styles.menuItem} ${themeMode === 'dark' ? styles.menuItemActive : ''}`} onClick={() => { setTheme('dark'); setShowUserMenu(false); }}>🌙 الوضع الداكن</button>
                  <button className={`${styles.menuItem} ${themeMode === 'light' ? styles.menuItemActive : ''}`} onClick={() => { setTheme('light'); setShowUserMenu(false); }}>☀️ الوضع الفاتح</button>
                  <div className={styles.divider}></div>
                  <button className={`${styles.menuItem} ${styles.menuItemLogout}`} onClick={handleLogout}><HiLogout size={18} /> تسجيل الخروج</button>
                </div>
              )}
            </div>
            <div className={styles.actionsContainer}>
              <button className={styles.actionButton} onClick={() => setIsNumbersHidden(!isNumbersHidden)}>
                {isNumbersHidden ? <HiEyeOff size={20} /> : <HiEye size={20} />}
              </button>
              <button className={styles.actionButton} onClick={() => router.push('/settings')}>
                <HiCog size={20} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className={styles.loadingState}>جاري التحميل...</div>
          ) : (
            <>
              <div className={styles.cardsGrid}>
                <SummaryCard title="الأصناف" value={isNumbersHidden ? '***' : products.length.toString()} icon={HiCube} />
                <SummaryCard title="المخازن" value={isNumbersHidden ? '***' : stores.length.toString()} icon={HiOfficeBuilding} />
                <SummaryCard title="العملاء" value={isNumbersHidden ? '***' : customers.length.toString()} icon={HiUserGroup} />
                <SummaryCard title="المصادر" value={isNumbersHidden ? '***' : sources.length.toString()} icon={HiTruck} />
                <SummaryCard title="إجمالي العهد" value={isNumbersHidden ? '***' : `${formatPrice(totalCustodyAmount)} ج.م`} icon={HiClipboardList} />
                <SummaryCard title="مصاريف اليوم" value={isNumbersHidden ? '***' : `${formatPrice(todayExpensesTotal)} ج.م`} icon={HiCash} />
              </div>

              <h2 className={styles.sectionTitle}>إجراءات سريعة</h2>
              <div className={styles.quickActions}>
                {quickActions.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.path} className={styles.quickActionBtn} onClick={() => router.push(item.path)} style={{ '--btn-color': item.color }}>
                      <Icon size={28} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
    </>
  );
}
