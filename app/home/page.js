'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '../../components/auth/AuthGuard';
import MainLayout from '../../components/layout/MainLayout';
import SummaryCard from '../../components/dashboard/SummaryCard';
import Table from '../../components/ui/Table';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { logout } from '../../lib/firebase/auth';
import { getUserFromLocalStorage } from '../../lib/auth';
import { 
  getStores,
  getSources,
  getProducts,
  getTodayTotalSales,
  getTodayTotalProfit,
  getTodayCustomerInvoices,
  getCustomer
} from '../../lib/firebase/firestore';
import { 
  HiCurrencyDollar, 
  HiCube, 
  HiOfficeBuilding, 
  HiTruck,
  HiEye,
  HiEyeOff,
  HiLogout,
  HiCog
} from 'react-icons/hi';
import styles from './page.module.css';

export default function HomePage() {
  const { user } = useAuth();
  const { themeMode, setTheme } = useTheme();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalSales: 0,
    totalProfit: 0,
    totalProducts: 0,
    totalStores: 0,
    totalSuppliers: 0,
  });
  const [todayInvoices, setTodayInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isNumbersHidden, setIsNumbersHidden] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const userData = getUserFromLocalStorage();
  const userName = userData?.name || user?.displayName || 'مستخدم';
  const userRole = userData?.role || 'user';
  
  // Get first two characters of user name
  const getInitials = (name) => {
    if (!name) return 'م';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return (words[0][0] || '') + (words[1][0] || '');
    }
    return name.substring(0, 2) || 'م';
  };

  const userInitials = getInitials(userName);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Fetch all data in parallel
        const [stores, sources, products, todaySales, todayProfit, invoices] = await Promise.all([
          getStores(),
          getSources(),
          getProducts(),
          getTodayTotalSales(),
          userRole === 'owner' ? getTodayTotalProfit() : Promise.resolve(0),
          getTodayCustomerInvoices()
        ]);
        
        // Fetch customer names for invoices (cache by customerId)
        const uniqueCustomerIds = Array.from(
          new Set((invoices || []).map((inv) => inv.customerId).filter(Boolean))
        );
        const customerNameById = {};
        await Promise.all(
          uniqueCustomerIds.map(async (customerId) => {
            try {
              const customer = await getCustomer(customerId);
              customerNameById[customerId] = customer?.name || 'غير معروف';
            } catch (error) {
              console.error('Error fetching customer:', error);
              customerNameById[customerId] = 'غير معروف';
            }
          })
        );
        const invoicesWithCustomers = (invoices || []).map((invoice) => ({
          ...invoice,
          customerName: customerNameById[invoice.customerId] || 'غير معروف',
        }));
        
        setStats({
          totalSales: todaySales || 0,
          totalProfit: todayProfit || 0,
          totalProducts: products.length || 0,
          totalStores: stores.length || 0,
          totalSuppliers: sources.length || 0,
        });
        
        setTodayInvoices(invoicesWithCustomers);
        setLoading(false); // Remove loading immediately after success
      } catch (error) {
        setLoading(false); // Remove loading on error
        console.error('Error loading data:', error);
      }
    };
    
    loadData();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserMenu && !event.target.closest('[data-user-menu]')) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };


  const formatValue = (value, isCurrency = false) => {
    if (isNumbersHidden) {
      return '•••••';
    }
    if (isCurrency) {
      return `$${value.toLocaleString()}`;
    }
    return value.toString();
  };

  return (
    <AuthGuard>
      <MainLayout>
        <div className={styles.container}>
          <div className={styles.header}>
            <div className={styles.userSection} data-user-menu>
              <div
                className={styles.avatar}
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
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
                  <button
                    className={`${styles.menuItem} ${themeMode === 'dark' ? styles.menuItemActive : ''}`}
                    onClick={() => {
                      setTheme('dark');
                      setShowUserMenu(false);
                    }}
                  >
                    <span>🌙</span>
                    الوضع الداكن
                  </button>
                  <button
                    className={`${styles.menuItem} ${themeMode === 'light' ? styles.menuItemActive : ''}`}
                    onClick={() => {
                      setTheme('light');
                      setShowUserMenu(false);
                    }}
                  >
                    <span>☀️</span>
                    الوضع الفاتح
                  </button>
                  <button
                    className={`${styles.menuItem} ${themeMode === 'system' ? styles.menuItemActive : ''}`}
                    onClick={() => {
                      setTheme('system');
                      setShowUserMenu(false);
                    }}
                  >
                    <span>💻</span>
                    حسب الجهاز
                  </button>
                  <div className={styles.divider}></div>
                  <button
                    className={`${styles.menuItem} ${styles.menuItemLogout}`}
                    onClick={handleLogout}
                  >
                    <HiLogout size={18} />
                    تسجيل الخروج
                  </button>
                </div>
              )}
            </div>

            <div className={styles.actionsContainer}>
              <button
                className={styles.actionButton}
                onClick={() => setIsNumbersHidden(!isNumbersHidden)}
              >
                {isNumbersHidden ? <HiEyeOff size={20} /> : <HiEye size={20} />}
              </button>
              <button
                className={styles.actionButton}
                onClick={() => router.push('/settings')}
              >
                <HiCog size={20} />
              </button>
            </div>
          </div>

          <div className={styles.cardsGrid}>
            <SummaryCard
              title="النقدي"
              value={formatValue(stats.totalSales, true)}
              icon={HiCurrencyDollar}
            />
            {userRole === 'owner' && (
              <SummaryCard
                title="الربح"
                value={formatValue(stats.totalProfit, true)}
                icon={HiCurrencyDollar}
              />
            )}
            <SummaryCard
              title="إجمالي المنتجات"
              value={formatValue(stats.totalProducts)}
              icon={HiCube}
            />
            <SummaryCard
              title="إجمالي المتاجر"
              value={formatValue(stats.totalStores)}
              icon={HiOfficeBuilding}
            />
            <SummaryCard
              title="إجمالي المصادر"
              value={formatValue(stats.totalSuppliers)}
              icon={HiTruck}
            />
          </div>

          <h2 className={styles.sectionTitle}>فواتير اليوم</h2>
          {loading ? (
            <div className={styles.loadingState}>
              <p>جاري التحميل...</p>
            </div>
          ) : todayInvoices.length === 0 ? (
            <div className={styles.emptyState}>
              <p>لا توجد فواتير اليوم</p>
            </div>
          ) : (
            <Table
              columns={[
                { key: 'date', label: 'التاريخ' },
                { key: 'customerName', label: 'العميل' },
                { key: 'totalCost', label: 'الإجمالي' },
                { key: 'paidAmount', label: 'المدفوع' },
                { key: 'remainingAmount', label: 'المتبقي' },
                { key: 'status', label: 'الحالة' },
              ]}
              data={todayInvoices.map((invoice) => ({
                  id: invoice.id,
                  date: invoice.date ? new Date(invoice.date).toLocaleDateString('ar-EG') : '-',
                  customerName: invoice.customerName || 'غير معروف',
                  totalCost: (invoice.totalCost || 0).toFixed(2),
                  paidAmount: (invoice.paidAmount || 0).toFixed(2),
                  remainingAmount: (invoice.remainingAmount || 0).toFixed(2),
                  status: invoice.status === 'pending' ? 'معلقة' : invoice.status === 'returned' ? 'مرتجعة' : 'نشطة',
                  originalInvoice: invoice,
                }))}
              actions={['عرض']}
              onAction={(action, row) => {
                if (action === 'عرض' && row.originalInvoice) {
                  router.push(`/customers/${row.originalInvoice.customerId}?invoiceId=${row.originalInvoice.id}`);
                }
              }}
              rowClassName={(row) => {
                if (row.originalInvoice?.status === 'pending') return styles.pendingRow;
                if (row.originalInvoice?.status === 'returned') return styles.returnedRow;
                return '';
              }}
            />
          )}
        </div>
      </MainLayout>
    </AuthGuard>
  );
}

