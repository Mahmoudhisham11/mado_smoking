'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AuthGuard from '../../../components/auth/AuthGuard';
import MainLayout from '../../../components/layout/MainLayout';
import SummaryCard from '../../../components/dashboard/SummaryCard';
import Card from '../../../components/ui/Card';
import Table from '../../../components/ui/Table';
import styles from './page.module.css';
import { getProduct, subscribeAllSourceInvoices, subscribeAllCustomerInvoices, subscribeToAllStoreProducts, subscribeToSources, subscribeToCustomers } from '../../../lib/firebase/firestore';
import { HiArrowRight, HiCube, HiOfficeBuilding, HiTruck, HiUserGroup } from 'react-icons/hi';

export default function ItemDetailPage() {
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

  useEffect(() => {
    const unsub = subscribeAllSourceInvoices((data) => setSourceInvoices(data));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeAllCustomerInvoices((data) => setCustomerInvoices(data));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToAllStoreProducts((data) => setStoreProducts(data));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToSources((data) => setSources(data));
    return () => unsub();
  }, []);

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
    const line = inv.products.find((p) => p.productId === itemId);
    return sum + (line?.quantity || 0);
  }, 0);

  const totalPurchased = relatedSourceInvoices.reduce((sum, inv) => {
    const line = inv.products.find((p) => p.productId === itemId);
    return sum + (line?.quantity || 0);
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

  const last3SupplyPrices = relatedSourceInvoices.slice(0, 3).map((inv) => {
    const line = inv.products.find((p) => p.productId === itemId);
    return {
      price: line?.wholesalePrice || 0,
      source: getSourceName(inv.sourceId),
      date: formatDate(inv.date),
    };
  });

  const supplyColumns = [
    { key: 'date', label: 'التاريخ' },
    { key: 'source', label: 'المورد' },
    { key: 'price', label: 'سعر التوريد' },
    { key: 'qty', label: 'الكمية' },
  ];

  const supplyTableData = relatedSourceInvoices.map((inv) => {
    const line = inv.products.find((p) => p.productId === itemId);
    return {
      id: inv.id,
      date: formatDate(inv.date),
      source: getSourceName(inv.sourceId),
      price: formatCurrency(line?.wholesalePrice || 0),
      qty: line?.quantity || 0,
    };
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

  const salesTableData = relatedCustomerInvoices.map((inv) => {
    const line = inv.products.find((p) => p.productId === itemId);
    return {
      id: inv.id,
      date: formatDate(inv.date),
      customer: getCustomerName(inv.customerId),
      price: formatCurrency(line?.sellingPrice || 0),
      qty: line?.quantity || 0,
    };
  });

  return (
    <AuthGuard>
      <MainLayout>
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
            </>
          )}
        </div>
      </MainLayout>
    </AuthGuard>
  );
}
