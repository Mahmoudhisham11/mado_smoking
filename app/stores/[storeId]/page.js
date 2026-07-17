'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AuthGuard from '../../../components/auth/AuthGuard';
import MainLayout from '../../../components/layout/MainLayout';
import SummaryCard from '../../../components/dashboard/SummaryCard';
import Card from '../../../components/ui/Card';
import Table from '../../../components/ui/Table';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { getStore, subscribeToStoreProducts, subscribeToProducts, updateStoreProductQuantity, subscribeAllSourceInvoices } from '../../../lib/firebase/firestore';
import { HiOfficeBuilding, HiCube, HiDatabase, HiArrowRight, HiUpload, HiCurrencyDollar } from 'react-icons/hi';
import * as XLSX from 'xlsx';
import styles from './page.module.css';

export default function StoreDetailPage() {
  const router = useRouter();
  const params = useParams();
  const storeId = params.storeId;

  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [sourceInvoices, setSourceInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelError, setExcelError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    const loadStore = async () => {
      const storeData = await getStore(storeId);
      setStore(storeData);
    };
    loadStore();
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    const unsubscribe = subscribeToStoreProducts(storeId, (data) => {
      setProducts(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [storeId]);

  useEffect(() => {
    const unsubscribe = subscribeToProducts((data) => {
      setAllProducts(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeAllSourceInvoices((data) => {
      setSourceInvoices(data);
    });
    return () => unsubscribe();
  }, []);

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (p.productName || '').toLowerCase().includes(q);
  });

  const totalProducts = products.length;
  const totalQuantity = products.reduce((sum, p) => sum + (Number(p.totalQuantity) || 0), 0);

  const lastWholesalePriceMap = {};
  for (const invoice of sourceInvoices) {
    for (const line of (invoice.products || [])) {
      if (!lastWholesalePriceMap[line.productId]) {
        lastWholesalePriceMap[line.productId] = Number(line.wholesalePrice) || 0;
      }
    }
  }

  const totalStockValue = products.reduce((sum, p) => {
    const price = lastWholesalePriceMap[p.productId] || 0;
    return sum + (price * (Number(p.totalQuantity) || 0));
  }, 0);

  const formatPrice = (val) => {
    const num = Number(val);
    return isNaN(num) ? '0' : num.toLocaleString();
  };

  const tableColumns = [
    { key: 'productName', label: 'اسم المنتج' },
    { key: 'totalQuantity', label: 'الكمية' },
  ];

  const tableData = filteredProducts.map((p) => ({
    id: p.id,
    productName: p.productName || 'بدون اسم',
    totalQuantity: p.totalQuantity || 0,
  }));

  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelLoading(true);
    setExcelError('');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (rows.length < 2) {
        setExcelError('الملف فارغ أو لا يحتوي على بيانات');
        setExcelLoading(false);
        return;
      }
      let headerRowIdx = 0;
      for (let ri = 0; ri < Math.min(5, rows.length); ri++) {
        const row = rows[ri];
        if (!row || !Array.isArray(row)) continue;
        const rowStr = row.map(h => String(h || '')).join(' ');
        if (rowStr.includes('الصنف') || rowStr.includes('اسم') || rowStr.includes('المنتج') || rowStr.includes('الكمية') || rowStr.includes('العدد')) {
          headerRowIdx = ri;
          break;
        }
      }
      const headers = rows[headerRowIdx];
      const normalizeArabicHeader = (str) => String(str).trim()
        .replace(/[إأآا]/g, 'ا').replace(/[ى]/g, 'ي').replace(/[ة]/g, 'ه').replace(/\s+/g, ' ');
      let nameCol = -1, qtyCol = -1;
      headers.forEach((h, i) => {
        const s = normalizeArabicHeader(h);
        if (s.includes('الصنف') || s.includes('اسم') || s.includes('المنتج') || s.includes('صنف')) {
          if (nameCol < 0) nameCol = i;
        }
        if (s.includes('الكمية') || s.includes('العدد') || s.includes('كميه') || s.includes('كمية') || s.includes('عدد')) {
          if (qtyCol < 0) qtyCol = i;
        }
      });
      if (nameCol < 0) nameCol = 0;
      if (qtyCol < 0) qtyCol = 1;
      let imported = 0;
      let skipped = 0;
      const errors = [];
      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !Array.isArray(r)) continue;
        const productName = String(r[nameCol] || '').trim();
        const qty = Number(r[qtyCol]) || 0;
        if (!productName) continue;
        if (qty <= 0) { skipped++; continue; }
        const product = allProducts.find(p => p.name === productName);
        if (!product) {
          errors.push(`المنتج "${productName}" غير موجود في قائمة الأصناف`);
          continue;
        }
        const result = await updateStoreProductQuantity(storeId, product.id, product.name, qty);
        if (result.success) imported++;
        else errors.push(`فشل تحديث كمية "${productName}": ${result.error}`);
      }
      setIsExcelModalOpen(false);
      const msg = `تم تحديث كمية ${imported} منتج بنجاح${skipped > 0 ? ` (تم تخطي ${skipped} صنف بكمية غير صحيحة)` : ''}`;
      const errMsg = errors.length ? `\nالأخطاء:\n${errors.slice(0, 10).join('\n')}` : '';
      alert(msg + errMsg);
    } catch (err) {
      console.error('Excel import error:', err);
      setExcelError('حدث خطأ أثناء قراءة الملف');
    } finally {
      setExcelLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <AuthGuard>
      <MainLayout>
        <div className={styles.container}>
          <div className={styles.header}>
            <button className={styles.backButton} onClick={() => router.push('/stores')}>
              <HiArrowRight size={18} />
              العودة إلى المخازن
            </button>
            <div className={styles.headerRow}>
              <h1 className={styles.storeTitle}>
                <HiOfficeBuilding style={{ color: 'var(--primary-color)' }} />
                {store?.name || 'المخزن'}
              </h1>
              <button className={styles.excelBtn} onClick={() => setIsExcelModalOpen(true)}>
                <HiUpload size={18} />
                إضافة Excel
              </button>
            </div>
          </div>

          {loading ? (
            <div className={styles.loading}>جاري التحميل...</div>
          ) : (
            <>
              <div className={styles.cardsGrid}>
                <SummaryCard
                  title="إجمالي عدد المنتجات"
                  value={totalProducts}
                  icon={HiCube}
                />
                <SummaryCard
                  title="إجمالي كمية المنتجات"
                  value={totalQuantity}
                  icon={HiDatabase}
                />
                <SummaryCard
                  title="إجمالي سعر الاصناف"
                  value={`${formatPrice(totalStockValue)} ج.م`}
                  icon={HiCurrencyDollar}
                />
              </div>

              {products.length === 0 ? (
                <Card>
                  <div className={styles.emptyState}>
                    <p>لا توجد منتجات في هذا المخزن.</p>
                  </div>
                </Card>
              ) : (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <input
                      type="text"
                      placeholder="ابحث عن منتج..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(var(--text-secondary-rgb), 0.25)',
                        backgroundColor: 'var(--background-color)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  {filteredProducts.length === 0 ? (
                    <Card>
                      <div className={styles.emptyState}>
                        <p>لا توجد نتائج للبحث.</p>
                      </div>
                    </Card>
                  ) : (
                    <Table columns={tableColumns} data={tableData} />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </MainLayout>

      {/* Excel Import Modal */}
      <Modal
        isOpen={isExcelModalOpen}
        onClose={() => { setIsExcelModalOpen(false); setExcelError(''); }}
        title="إضافة كمية من Excel"
        size="medium"
        footer={
          <div className={styles.formActions}>
            <Button variant="secondary" onClick={() => { setIsExcelModalOpen(false); setExcelError(''); }}>
              إلغاء
            </Button>
            <Button variant="primary" onClick={() => fileInputRef.current?.click()} loading={excelLoading}>
              {excelLoading ? 'جاري الاستيراد...' : 'اختيار ملف'}
            </Button>
          </div>
        }
      >
        <div className={styles.form}>
          {excelError && <div className={styles.errorMessage}>{excelError}</div>}
          <p style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
            قم باختيار ملف Excel يحتوي على المنتجات والكميات. يجب أن يحتوي الملف على عمودين على الأقل:
          </p>
          <ul style={{ marginBottom: '12px', paddingRight: '20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
            <li>اسم المنتج (الصنف / المنتج / الاسم)</li>
            <li>الكمية (الكمية / العدد)</li>
          </ul>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            سيتم زيادة الكمية المدخلة للمוצרים الموجودة في المخزن. يجب أن يكون المنتج موجوداً في قائمة الأصناف.
          </p>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleExcelUpload} />
        </div>
      </Modal>
    </AuthGuard>
  );
}
