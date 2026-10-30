'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AuthGuard from '../../../components/auth/AuthGuard';
import MainLayout from '../../../components/layout/MainLayout';
import SummaryCard from '../../../components/dashboard/SummaryCard';
import Card from '../../../components/ui/Card';
import Table from '../../../components/ui/Table';
import styles from './page.module.css';
import { getProduct, subscribeProductSourceInvoices, subscribeProductCustomerInvoices, subscribeToProductStock, subscribeToSources, subscribeToCustomers } from '../../../lib/firebase/firestore';
import { useSession } from '../../../contexts/AuthContext';
import { HiArrowRight, HiCube, HiOfficeBuilding, HiTruck, HiUserGroup } from 'react-icons/hi';

export default function ItemDetailPage() {
  return (
    <AuthGuard>
      <MainLayout>
        <ItemDetailContent />
      </MainLayout>
    </AuthGuard>
  );
}

function ItemDetailContent() {
  const router = useRouter();
  const params = useParams();
  const itemId = params.itemId;

  const [product, setProduct] = useState(null);
  const [sourceInvoices, setSourceInvoices] = useState([]);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [storeProducts, setStoreProducts] = useState([]);
  const [sources, setSources] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const { isOwner } = useSession();
  const [historySize, setHistorySize] = useState(200);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  useEffect(() => {
    const load = async () => {
      const p = await getProduct(itemId);
      setProduct(p);
      setLoading(false);
    };
    load();
  }, [itemId]);

  // فواتير الصنف ده بس (بدل تحميل كل الفواتير وفلترتها في المتصفح)
  useEffect(() => {
    if (!isOwner) return;
    const unsub = subscribeProductSourceInvoices(itemId, historySize, setSourceInvoices);
    return () => unsub();
  }, [itemId, historySize, isOwner]);

  useEffect(() => {
    const unsub = subscribeProductCustomerInvoices(itemId, historySize, setCustomerInvoices);
    return () => unsub();
  }, [itemId, historySize]);

  useEffect(() => {
    const unsub = subscribeToProductStock(itemId, setStoreProducts);
    return () => unsub();
  }, [itemId]);

  // الموردين للمالك فقط
  useEffect(() => {
    if (!isOwner) return;
    const unsub = subscribeToSources(setSources);
    return () => unsub();
  }, [isOwner]);

  useEffect(() => {
    const unsub = subscribeToCustomers((data) => setCustomers(data));
    return () => unsub();
  }, []);

  const toDateOnly = (d) => {
    const dt = d instanceof Date ? d : new Date(d);
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  };

  const isDateInRange = (itemDate) => {
    if (!filterDateFrom && !filterDateTo) return true;
    const d = toDateOnly(itemDate);
    if (filterDateFrom && d < toDateOnly(new Date(filterDateFrom))) return false;
    if (filterDateTo && d > toDateOnly(new Date(filterDateTo))) return false;
    return true;
  };

  const relatedSourceInvoices = sourceInvoices.filter((inv) =>
    inv.products?.some((p) => p.productId === itemId) && isDateInRange(inv.date)
  );

  const relatedCustomerInvoices = customerInvoices.filter((inv) =>
    inv.products?.some((p) => p.productId === itemId) && isDateInRange(inv.date)
  );

  const getSourceName = (sourceId) => {
    const s = sources.find((src) => src.id === sourceId);
    return s?.name || 'غير معروف';
  };

  const storesWithProduct = storeProducts.filter(
    (sp) => sp.productId === itemId && (Number(sp.totalQuantity) || 0) > 0
  );

  const totalSold = relatedCustomerInvoices.reduce((sum, inv) => {
    const lines = (inv.products || []).filter((p) => p.productId === itemId);
    return sum + lines.reduce((lineSum, line) => lineSum + (Number(line.quantity) || 0), 0);
  }, 0);

  const totalPurchased = relatedSourceInvoices.reduce((sum, inv) => {
    const lines = (inv.products || []).filter((p) => p.productId === itemId);
    return sum + lines.reduce((lineSum, line) => lineSum + (Number(line.quantity) || 0), 0);
  }, 0);

  const totalInStores = storesWithProduct.reduce((sum, sp) => sum + (Number(sp.totalQuantity) || 0), 0);

  const formatPrice = (val) => {
    const num = Number(val);
    return isNaN(num) ? '0' : num.toLocaleString();
  };

  const formatDate = (d) => {
    if (!d) return '';
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString('ar-EG');
  };

  const formatCurrency = (val) => `${formatPrice(val)} ج.م`;

  const last3SupplyPrices = relatedSourceInvoices.flatMap((inv) => {
    const lines = (inv.products || []).filter((p) => p.productId === itemId);
    return lines.map((line) => ({
      price: line.wholesalePrice || 0,
      source: getSourceName(inv.sourceId),
      date: formatDate(inv.date),
    }));
  }).slice(0, 3);

  const supplyColumns = [
    { key: 'date', label: 'التاريخ' },
    { key: 'source', label: 'المورد' },
    { key: 'price', label: 'سعر التوريد' },
    { key: 'qty', label: 'الكمية' },
  ];

  const supplyTableData = relatedSourceInvoices.flatMap((inv) => {
    const lines = (inv.products || []).filter((p) => p.productId === itemId);
    return lines.map((line, idx) => ({
      id: `${inv.id}-${idx}`,
      date: formatDate(inv.date),
      source: getSourceName(inv.sourceId),
      price: formatCurrency(line?.wholesalePrice || 0),
      qty: line?.quantity || 0,
    }));
  });

  const salesColumns = [
    { key: 'date', label: 'التاريخ' },
    { key: 'customer', label: 'العميل' },
    { key: 'price', label: 'سعر البيع' },
    { key: 'qty', label: 'الكمية' },
  ];

  const getCustomerName = (customerId) => {
    const c = customers.find((cust) => cust.id === customerId);
    return c?.name || '—';
  };

  const salesTableData = relatedCustomerInvoices.flatMap((inv) => {
    const lines = (inv.products || []).filter((p) => p.productId === itemId);
    return lines.map((line, idx) => ({
      id: `${inv.id}-${idx}`,
      date: formatDate(inv.date),
      customer: getCustomerName(inv.customerId),
      price: formatCurrency(line?.sellingPrice || 0),
      qty: line?.quantity || 0,
    }));
  });

  return (
    <>
        <div className={styles.container}>
          <div className={styles.header}>
            <button className={styles.backButton} onClick={() => router.push('/items')}>
              <HiArrowRight size={18} />
              العودة إلى الأصناف
            </button>
          </div>

          <div className={styles.titleRow}>
            <div className={styles.titleInfo}>
              <HiCube size={28} style={{ color: 'var(--primary-color)' }} />
              <h1 className={styles.title}>{product?.name || 'الصنف'}</h1>
              {product && <span className={styles.priceBadge}>{formatCurrency(product.price)}</span>}
            </div>
          </div>

          <div className={styles.dateFilterRow}>
            <div className={styles.dateFilterGroup}>
              <label className={styles.formLabel}>من تاريخ</label>
              <input type="date" className={styles.formInput} value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
            </div>
            <div className={styles.dateFilterGroup}>
              <label className={styles.formLabel}>إلى تاريخ</label>
              <input type="date" className={styles.formInput} value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
            </div>
            {(filterDateFrom || filterDateTo) && (
              <button className={styles.clearFilterBtn} onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}>
                إلغاء الفلتر
              </button>
            )}
          </div>

          {loading ? (
            <div className={styles.loading}>جاري التحميل...</div>
          ) : (
            <>
              <div className={styles.cardsGrid}>
                <SummaryCard title="في المخازن" value={formatPrice(totalInStores)} icon={HiOfficeBuilding} />
                <SummaryCard title="إجمالي المبيعات" value={formatPrice(totalSold)} icon={HiUserGroup} />
                <SummaryCard title="إجمالي المشتريات" value={formatPrice(totalPurchased)} icon={HiTruck} />
              </div>

              {last3SupplyPrices.length > 0 && (
                <div className={styles.supplyPricesSection}>
                  <h2 className={styles.sectionTitle}>
                    <HiTruck size={18} style={{ marginLeft: '6px', verticalAlign: 'middle' }} />
                    آخر 3 أسعار توريد
                  </h2>
                  <div className={styles.supplyPricesGrid}>
                    {last3SupplyPrices.map((item, idx) => (
                      <div key={idx} className={styles.supplyPriceCard}>
                        <div className={styles.supplyPriceValue}>{formatCurrency(item.price)}</div>
                        <div className={styles.supplyPriceSource}>{item.source}</div>
                        <div className={styles.supplyPriceDate}>{item.date}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stores */}
              <Card>
                <h2 className={styles.sectionTitle}>
                  <HiOfficeBuilding size={18} style={{ marginLeft: '6px', verticalAlign: 'middle' }} />
                  التواجد في المخازن
                </h2>
                {storesWithProduct.length === 0 ? (
                  <p className={styles.emptyText}>غير موجود في أي مخزن.</p>
                ) : (
                  <div className={styles.storeGrid}>
                    {storesWithProduct.map((sp) => (
                      <div key={sp.id} className={styles.storeCard}>
                        <div className={styles.storeCardName}>{sp.storeName || 'مخزن'}</div>
                        <div className={styles.storeCardQty}>{formatPrice(sp.totalQuantity)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Sales */}
              <Card>
                <h2 className={styles.sectionTitle}>
                  <HiUserGroup size={18} style={{ marginLeft: '6px', verticalAlign: 'middle' }} />
                  المبيعات ({relatedCustomerInvoices.length})
                </h2>
                {salesTableData.length === 0 ? (
                  <p className={styles.emptyText}>لا توجد مبيعات لهذا الصنف.</p>
                ) : (
                  <Table columns={salesColumns} data={salesTableData} />
                )}
              </Card>
              {(customerInvoices.length >= historySize || sourceInvoices.length >= historySize) && (
                <div style={{ textAlign: 'center', marginTop: '12px' }}>
                  <button className={styles.emptyText} style={{ cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }} onClick={() => setHistorySize((n) => n + 200)}>
                    تحميل حركات أقدم
                  </button>
                </div>
              )}
            </>
          )}
        </div>
    </>
  );
}
