'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AuthGuard from '../../../components/auth/AuthGuard';
import MainLayout from '../../../components/layout/MainLayout';
import SummaryCard from '../../../components/dashboard/SummaryCard';
import Card from '../../../components/ui/Card';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Table from '../../../components/ui/Table';
import { getCustomer, subscribeToCustomerInvoices, addCustomerInvoice, updateCustomerInvoice, deleteCustomerInvoice, subscribeToCustomerPayments, addCustomerPayment, deleteCustomerPayment, subscribeToProducts, subscribeToStores, subscribeToAllStoreProducts, updateStoreProductQuantity, subscribeToCustodies } from '../../../lib/firebase/firestore';
import { getUserFromLocalStorage } from '../../../lib/auth';
import { HiUser, HiCurrencyDollar, HiCash, HiDocumentReport, HiArrowRight, HiPlus, HiTrash, HiX, HiPencil, HiEye, HiDotsVertical, HiClipboardList } from 'react-icons/hi';
import styles from './page.module.css';

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params.customerId;

  const [customer, setCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [storeProducts, setStoreProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Invoice modal state
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceLines, setInvoiceLines] = useState([{ storeId: '', productId: '', productSearchText: '', sellingPrice: '', quantity: '' }]);
  const [invoiceError, setInvoiceError] = useState('');
  const [savingInvoice, setSavingInvoice] = useState(false);

  // Invoice payment fields
  const [invoicePaidAmount, setInvoicePaidAmount] = useState('');
  const [invoicePaymentCustodyId, setInvoicePaymentCustodyId] = useState('');
  const [creditLimitError, setCreditLimitError] = useState('');

  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState('');

  // Custody selector
  const [custodies, setCustodies] = useState([]);
  const [paymentCustodyId, setPaymentCustodyId] = useState('');

  const userData = getUserFromLocalStorage();
  const userRole = userData?.role || 'user';
  const isOwner = userRole === 'owner';

  // Date filter
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Invoice detail / edit / delete
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isInvoiceDetailOpen, setIsInvoiceDetailOpen] = useState(false);
  const [isEditingInvoice, setIsEditingInvoice] = useState(false);
  const [editInvoiceLines, setEditInvoiceLines] = useState([]);
  const [editInvoiceError, setEditInvoiceError] = useState('');
  const [savingEditInvoice, setSavingEditInvoice] = useState(false);
  const [confirmDeleteInvoice, setConfirmDeleteInvoice] = useState(null);
  const [deletingInvoice, setDeletingInvoice] = useState(false);

  // Payment reports
  const [isPaymentReportOpen, setIsPaymentReportOpen] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState(null);

  // Mobile menu
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Selection
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);

  useEffect(() => {
    const loadCustomer = async () => {
      const data = await getCustomer(customerId);
      setCustomer(data);
    };
    loadCustomer();
  }, [customerId]);

  useEffect(() => {
    if (!customerId) return;
    const unsubInvoices = subscribeToCustomerInvoices(customerId, (data) => {
      setInvoices(data);
      setLoading(false);
    });
    const unsubPayments = subscribeToCustomerPayments(customerId, (data) => {
      setPayments(data);
    });
    const unsubProducts = subscribeToProducts((data) => {
      setProducts(data);
    });
    const unsubStores = subscribeToStores((data) => {
      setStores(data);
    });
    const unsubStoreProducts = subscribeToAllStoreProducts((data) => {
      setStoreProducts(data);
    });
    const unsubCustodies = subscribeToCustodies((data) => {
      setCustodies(data);
    });
    return () => {
      unsubInvoices();
      unsubPayments();
      unsubProducts();
      unsubStores();
      unsubStoreProducts();
      unsubCustodies();
    };
  }, [customerId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMenuOpen]);

  const formatPrice = (val) => {
    const num = Number(val);
    return isNaN(num) ? '0' : num.toLocaleString();
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('ar-EG');
  };

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

  const filteredInvoices = invoices.filter((inv) => isDateInRange(inv.date));
  const filteredPayments = payments.filter((p) => isDateInRange(p.date));

  const totalCost = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.totalCost) || 0), 0);
  const totalPaid = filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remaining = totalCost - totalPaid;

  // Invoice helpers
  const openInvoiceModal = () => {
    setInvoiceLines([{ storeId: '', productId: '', productSearchText: '', sellingPrice: '', quantity: '' }]);
    setInvoiceError('');
    setCreditLimitError('');
    setInvoicePaidAmount('');
    setInvoicePaymentCustodyId(custodies.length > 0 ? custodies[0].id : '');
    setIsInvoiceModalOpen(true);
  };

  const addInvoiceLine = () => {
    setInvoiceLines((prev) => [...prev, { storeId: '', productId: '', productSearchText: '', sellingPrice: '', quantity: '' }]);
  };

  const removeInvoiceLine = (index) => {
    setInvoiceLines((prev) => prev.filter((_, i) => i !== index));
  };

  const updateInvoiceLine = (index, field, value) => {
    setInvoiceLines((prev) => {
      const updated = [...prev];
      if (field === 'storeId') {
        updated[index] = { storeId: value, productId: '', productSearchText: '', sellingPrice: '', quantity: '' };
      } else if (field === 'productId') {
        const p = products.find((pr) => pr.id === value);
        updated[index] = { ...updated[index], productId: value, sellingPrice: p ? String(p.price) : '' };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const getProductsInStore = (storeId) => {
    return storeProducts.filter((sp) => sp.storeId === storeId && (Number(sp.totalQuantity) || 0) > 0);
  };

  const invoiceTotal = invoiceLines.reduce((sum, line) => {
    return sum + ((Number(line.sellingPrice) || 0) * (Number(line.quantity) || 0));
  }, 0);

  const handleSaveInvoice = async () => {
    for (let i = 0; i < invoiceLines.length; i++) {
      const line = invoiceLines[i];
      if (!line.storeId) {
        setInvoiceError(`المخزن للصنف رقم ${i + 1} لم يتم اختياره`);
        return;
      }
      if (!line.productId) {
        setInvoiceError(`الصنف رقم ${i + 1} لم يتم اختياره`);
        return;
      }
      if (!line.quantity || Number(line.quantity) <= 0) {
        setInvoiceError(`الكمية للصنف رقم ${i + 1} غير صحيحة`);
        return;
      }
      const sp = storeProducts.find((sp) => sp.storeId === line.storeId && sp.productId === line.productId);
      if (sp && Number(line.quantity) > Number(sp.totalQuantity)) {
        setInvoiceError(`الكمية المطلوبة للصنف "${sp.productName}" تتجاوز المتوفر (${sp.totalQuantity})`);
        return;
      }
    }

    // Validate paid amount against credit limit
    const creditLimit = Number(customer?.creditLimit) || 0;
    const paidAmount = Number(invoicePaidAmount) || 0;
    if (creditLimit > 0 && paidAmount < creditLimit) {
      setCreditLimitError(`المبلغ المدفوع (${paidAmount.toLocaleString()}) أقل من حد الائتمان للعميل (${creditLimit.toLocaleString()})`);
      return;
    }

    setSavingInvoice(true);
    setInvoiceError('');
    setCreditLimitError('');

    try {
      const productsData = invoiceLines.map((line) => {
        const product = products.find((p) => p.id === line.productId);
        const store = stores.find((s) => s.id === line.storeId);
        return {
          storeId: line.storeId,
          storeName: store?.name || 'غير معروف',
          productId: line.productId,
          productName: product?.name || 'غير معروف',
          sellingPrice: Number(line.sellingPrice) || 0,
          quantity: Number(line.quantity) || 0,
        };
      });

      const invoiceData = {
        customerId,
        products: productsData,
        totalCost: invoiceTotal,
        totalItems: productsData.reduce((sum, p) => sum + p.quantity, 0),
        date: new Date(),
      };

      const result = await addCustomerInvoice(invoiceData);
      if (!result.success) {
        setInvoiceError(result.error || 'فشل في إضافة الفاتورة');
        setSavingInvoice(false);
        return;
      }

      // Decrease inventory
      for (const line of productsData) {
        await updateStoreProductQuantity(line.storeId, line.productId, line.productName, -line.quantity);
      }

      // Create payment for the paid amount if > 0
      if (paidAmount > 0 && invoicePaymentCustodyId) {
        await addCustomerPayment({
          customerId,
          amount: paidAmount,
          date: new Date(),
          custodyId: invoicePaymentCustodyId,
          invoiceId: result.id,
        });
      }

      setIsInvoiceModalOpen(false);
    } catch (err) {
      setInvoiceError('حدث خطأ. يرجى المحاولة مرة أخرى.');
    } finally {
      setSavingInvoice(false);
    }
  };

  // Payment helpers
  const openPaymentModal = () => {
    setPaymentAmount('');
    setPaymentInvoiceId('');
    setPaymentCustodyId(custodies.length > 0 ? custodies[0].id : '');
    setPaymentError('');
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = async () => {
    if (!paymentAmount || isNaN(Number(paymentAmount)) || Number(paymentAmount) === 0) {
      setPaymentError('يرجى إدخال مبلغ صحيح (موجب أو سالب)');
      return;
    }
    if (!paymentCustodyId) {
      setPaymentError('يرجى اختيار العهدة');
      return;
    }
    setSavingPayment(true);
    setPaymentError('');
    try {
      const result = await addCustomerPayment({
        customerId,
        amount: Number(paymentAmount),
        date: new Date(),
        custodyId: paymentCustodyId,
      });
      if (!result.success) {
        setPaymentError(result.error || 'فشل في إضافة السداد');
        setSavingPayment(false);
        return;
      }
      setIsPaymentModalOpen(false);
    } catch (err) {
      setPaymentError('حدث خطأ. يرجى المحاولة مرة أخرى.');
    } finally {
      setSavingPayment(false);
    }
  };

  // Payment reports
  const openPaymentReport = () => {
    setIsPaymentReportOpen(true);
  };

  const handleDeletePayment = async (paymentId) => {
    setDeletingPaymentId(paymentId);
    try {
      await deleteCustomerPayment(paymentId);
    } catch (err) {
      console.error('Error deleting payment:', err);
    } finally {
      setDeletingPaymentId(null);
    }
  };

  // Invoice detail / edit / delete
  const openInvoiceDetail = (invoice) => {
    setSelectedInvoice(invoice);
    setEditInvoiceLines(invoice.products.map((p) => ({ ...p, productSearchText: p.productName || '' })));
    setIsEditingInvoice(false);
    setEditInvoiceError('');
    setIsInvoiceDetailOpen(true);
  };

  const startEditInvoice = () => {
    setIsEditingInvoice(true);
    setEditInvoiceLines(selectedInvoice.products.map((p) => ({ ...p, productSearchText: p.productName || '' })));
    setEditInvoiceError('');
  };

  const cancelEditInvoice = () => {
    setIsEditingInvoice(false);
    setEditInvoiceLines(selectedInvoice.products.map((p) => ({ ...p, productSearchText: p.productName || '' })));
    setEditInvoiceError('');
  };

  const updateEditLine = (index, field, value) => {
    setEditInvoiceLines((prev) => {
      const updated = [...prev];
      if (field === 'storeId') {
        updated[index] = { ...updated[index], storeId: value, productId: '', productSearchText: '', sellingPrice: '', quantity: '' };
      } else if (field === 'productId') {
        const p = products.find((pr) => pr.id === value);
        updated[index] = { ...updated[index], productId: value, sellingPrice: p ? String(p.price) : '' };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const addEditLine = () => {
    setEditInvoiceLines((prev) => [...prev, { storeId: '', productId: '', productSearchText: '', sellingPrice: '', quantity: '' }]);
  };

  const removeEditLine = (index) => {
    setEditInvoiceLines((prev) => prev.filter((_, i) => i !== index));
  };

  const editInvoiceTotal = editInvoiceLines.reduce((sum, line) => {
    return sum + ((Number(line.sellingPrice) || 0) * (Number(line.quantity) || 0));
  }, 0);

  const handleSaveEditedInvoice = async () => {
    for (let i = 0; i < editInvoiceLines.length; i++) {
      const line = editInvoiceLines[i];
      if (!line.storeId) {
        setEditInvoiceError(`المخزن للصنف رقم ${i + 1} لم يتم اختياره`);
        return;
      }
      if (!line.productId) {
        setEditInvoiceError(`الصنف رقم ${i + 1} لم يتم اختياره`);
        return;
      }
      if (!line.quantity || Number(line.quantity) <= 0) {
        setEditInvoiceError(`الكمية للصنف رقم ${i + 1} غير صحيحة`);
        return;
      }
    }
    setSavingEditInvoice(true);
    setEditInvoiceError('');
    try {
      const oldProducts = selectedInvoice.products.map((p) => ({ ...p }));
      const newProducts = editInvoiceLines.map((line) => {
        const product = products.find((p) => p.id === line.productId);
        const store = stores.find((s) => s.id === line.storeId);
        return {
          storeId: line.storeId,
          storeName: store?.name || line.storeName || 'غير معروف',
          productId: line.productId,
          productName: product?.name || line.productName || 'غير معروف',
          sellingPrice: Number(line.sellingPrice) || 0,
          quantity: Number(line.quantity) || 0,
        };
      });

      const result = await updateCustomerInvoice(selectedInvoice.id, {
        products: newProducts,
        totalCost: editInvoiceTotal,
        totalItems: newProducts.reduce((sum, p) => sum + p.quantity, 0),
      });
      if (!result.success) {
        setEditInvoiceError(result.error || 'فشل في تحديث الفاتورة');
        setSavingEditInvoice(false);
        return;
      }

      // Revert old inventory, apply new
      for (const line of oldProducts) {
        await updateStoreProductQuantity(line.storeId, line.productId, line.productName, line.quantity);
      }
      for (const line of newProducts) {
        await updateStoreProductQuantity(line.storeId, line.productId, line.productName, -line.quantity);
      }

      setIsEditingInvoice(false);
      setIsInvoiceDetailOpen(false);
      setSelectedInvoice(null);
    } catch (err) {
      setEditInvoiceError('حدث خطأ. يرجى المحاولة مرة أخرى.');
    } finally {
      setSavingEditInvoice(false);
    }
  };

  const handleDeleteInvoice = async (invoice) => {
    setConfirmDeleteInvoice(invoice);
  };

  const confirmDeleteInvoiceAction = async () => {
    if (!confirmDeleteInvoice) return;
    setDeletingInvoice(true);
    try {
      const oldProducts = confirmDeleteInvoice.products.map((p) => ({ ...p }));
      const result = await deleteCustomerInvoice(confirmDeleteInvoice.id);
      if (result.success) {
        // Revert inventory (add back)
        for (const line of oldProducts) {
          await updateStoreProductQuantity(line.storeId, line.productId, line.productName, line.quantity);
        }
      }
      setIsInvoiceDetailOpen(false);
      setSelectedInvoice(null);
      setConfirmDeleteInvoice(null);
    } catch (err) {
      console.error('Error deleting invoice:', err);
    } finally {
      setDeletingInvoice(false);
    }
  };

  const getInvoiceRef = (invoiceId) => {
    if (!invoiceId) return null;
    const inv = invoices.find((i) => i.id === invoiceId);
    return inv ? `${formatDate(inv.date)} - ${formatPrice(inv.totalCost)} ج.م` : null;
  };

  const payTableData = [...filteredPayments]
    .sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date);
      const dateB = b.date instanceof Date ? b.date : new Date(b.date);
      return dateB - dateA;
    })
    .map((p) => ({
      id: p.id,
      date: formatDate(p.date),
      amount: `${formatPrice(p.amount)} ج.م`,
      invoiceRef: p.invoiceId ? getInvoiceRef(p.invoiceId) : null,
    }));

  const invColumns = [
    {
      key: 'select',
      label: (
        <input
          type="checkbox"
          checked={filteredInvoices.length > 0 && selectedInvoiceIds.length === filteredInvoices.length}
          onChange={() => {
            if (selectedInvoiceIds.length === filteredInvoices.length) {
              setSelectedInvoiceIds([]);
            } else {
              setSelectedInvoiceIds(filteredInvoices.map((inv) => inv.id));
            }
          }}
        />
      ),
    },
    { key: 'date', label: 'التاريخ' },
    { key: 'items', label: 'عدد الأصناف' },
    { key: 'total', label: 'الإجمالي' },
    { key: 'actions', label: '' },
  ];

  const invTableData = filteredInvoices.map((inv) => ({
    id: inv.id,
    select: (
      <input
        type="checkbox"
        checked={selectedInvoiceIds.includes(inv.id)}
        onChange={() => {
          setSelectedInvoiceIds((prev) =>
            prev.includes(inv.id) ? prev.filter((id) => id !== inv.id) : [...prev, inv.id]
          );
        }}
      />
    ),
    date: formatDate(inv.date),
    items: inv.totalItems || 0,
    total: `${formatPrice(inv.totalCost)} ج.م`,
    actions: (
      <button className={styles.viewBtn} onClick={(e) => { e.stopPropagation(); openInvoiceDetail(inv); }} title="عرض الفاتورة">
        <HiEye size={16} />
      </button>
    ),
  }));

  const handleDeleteSelected = async () => {
    if (selectedInvoiceIds.length === 0) return;
    if (!confirm(`هل أنت متأكد من حذف ${selectedInvoiceIds.length} فاتورة؟`)) return;

    setIsDeletingSelected(true);
    let deleted = 0;
    for (const id of selectedInvoiceIds) {
      const inv = invoices.find((i) => i.id === id);
      if (!inv) continue;
      const oldProducts = inv.products.map((p) => ({ ...p }));
      const result = await deleteCustomerInvoice(id);
      if (result.success) {
        for (const line of oldProducts) {
          await updateStoreProductQuantity(line.storeId, line.productId, line.productName, line.quantity);
        }
        deleted++;
      }
    }
    setIsDeletingSelected(false);
    setSelectedInvoiceIds([]);
    alert(`تم حذف ${deleted} فاتورة بنجاح`);
  };

  return (
    <AuthGuard>
      <MainLayout>
        <div className={styles.container}>
          <div className={styles.header}>
            <button className={styles.backButton} onClick={() => router.push('/customers')}>
              <HiArrowRight size={18} />
              العودة إلى العملاء
            </button>
            <div className={styles.headerRow}>
              <h1 className={styles.customerTitle}>
                <HiUser style={{ color: 'var(--primary-color)' }} />
                {customer?.name || 'العميل'}
              </h1>
              <div className={styles.headerActionsDesktop}>
                <button className={`${styles.actionBtn} ${styles.primaryBtn}`} onClick={openInvoiceModal}>
                  <HiPlus size={18} />
                  إضافة فاتورة
                </button>
                <button className={`${styles.actionBtn} ${styles.secondaryBtn}`} onClick={openPaymentModal}>
                  <HiCash size={18} />
                  سداد
                </button>
                <button className={`${styles.actionBtn} ${styles.warningBtn}`} onClick={openPaymentReport}>
                  <HiDocumentReport size={18} />
                  تقارير السداد
                </button>
              </div>
              <div className={styles.headerActionsMobile} ref={menuRef}>
                <button className={styles.menuDotsBtn} onClick={() => setIsMenuOpen(!isMenuOpen)}>
                  <HiDotsVertical size={20} />
                </button>
                {isMenuOpen && (
                  <div className={styles.dropdownMenu}>
                    <button className={styles.dropdownItem} onClick={() => { setIsMenuOpen(false); openInvoiceModal(); }}>
                      <HiPlus size={16} /> إضافة فاتورة
                    </button>
                    <button className={styles.dropdownItem} onClick={() => { setIsMenuOpen(false); openPaymentModal(); }}>
                      <HiCash size={16} /> سداد
                    </button>
                    <button className={styles.dropdownItem} onClick={() => { setIsMenuOpen(false); openPaymentReport(); }}>
                      <HiDocumentReport size={16} /> تقارير السداد
                    </button>
                  </div>
                )}
              </div>
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
                <SummaryCard title="عدد الفواتير" value={`${filteredInvoices.length}`} icon={HiClipboardList} />
                <SummaryCard title="إجمالي الفواتير" value={`${formatPrice(totalCost)} ج.م`} icon={HiCurrencyDollar} />
                <SummaryCard title="إجمالي المدفوع" value={`${formatPrice(totalPaid)} ج.م`} icon={HiCash} />
                <SummaryCard title="المتبقي" value={`${formatPrice(remaining)} ج.م`} icon={HiDocumentReport} />
              </div>

              {filteredInvoices.length === 0 ? (
                <Card>
                  <div className={styles.emptyState}>
                    <p>لا توجد فواتير{filterDateFrom || filterDateTo ? ' في هذا النطاق' : ' لهذا العميل'}.</p>
                  </div>
                </Card>
              ) : (
                <>
                  {selectedInvoiceIds.length > 0 && (
                    <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        تم اختيار {selectedInvoiceIds.length} فاتورة
                      </span>
                      <Button variant="danger" onClick={handleDeleteSelected} loading={isDeletingSelected}>
                        حذف المحدد
                      </Button>
                    </div>
                  )}
                  <Table columns={invColumns} data={invTableData} />
                </>
              )}
            </>
          )}
        </div>

        {/* Add Invoice Modal */}
        <Modal
          isOpen={isInvoiceModalOpen}
          onClose={() => setIsInvoiceModalOpen(false)}
          title="إضافة فاتورة جديدة"
          size="large"
          footer={
            <div className={styles.formActions}>
              <Button variant="secondary" onClick={() => setIsInvoiceModalOpen(false)} disabled={savingInvoice}>إلغاء</Button>
              <Button variant="primary" onClick={handleSaveInvoice} loading={savingInvoice}>حفظ الفاتورة</Button>
            </div>
          }
        >
          {invoiceError && <div className={styles.errorMessage}>{invoiceError}</div>}
          <div className={styles.form}>
            {invoiceLines.map((line, index) => (
              <div key={index} className={styles.productLine}>
                <div>
                  <label className={styles.formLabel}>المخزن</label>
                  <select className={styles.formSelect} value={line.storeId} onChange={(e) => updateInvoiceLine(index, 'storeId', e.target.value)}>
                    <option value="">اختر مخزن</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={styles.formLabel}>الصنف</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder={line.storeId ? 'ابحث عن صنف...' : 'اختر مخزن أولاً'}
                    value={line.productSearchText || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const matched = line.storeId ? getProductsInStore(line.storeId).find(sp => sp.productName === val) : null;
                      updateInvoiceLine(index, 'productSearchText', val);
                      updateInvoiceLine(index, 'productId', matched ? matched.productId : '');
                      if (matched) {
                        const p = products.find(pr => pr.id === matched.productId);
                        updateInvoiceLine(index, 'sellingPrice', p ? String(p.price) : '');
                      }
                    }}
                    list={line.storeId ? `customer-products-${index}` : undefined}
                    disabled={!line.storeId}
                  />
                  {line.storeId && (
                    <datalist id={`customer-products-${index}`}>
                      {getProductsInStore(line.storeId).map(sp => (
                        <option key={sp.productId} value={sp.productName} />
                      ))}
                    </datalist>
                  )}
                </div>
                <div>
                  <label className={styles.formLabel}>سعر البيع</label>
                  <input type="number" className={styles.formInput} placeholder="0" value={line.sellingPrice} onChange={(e) => updateInvoiceLine(index, 'sellingPrice', e.target.value)} />
                </div>
                <div>
                  <label className={styles.formLabel}>الكمية</label>
                  <input type="number" className={styles.formInput} placeholder="0" value={line.quantity} onChange={(e) => updateInvoiceLine(index, 'quantity', e.target.value)} />
                </div>
                <button className={styles.removeBtn} onClick={() => removeInvoiceLine(index)} title="حذف الصنف">
                  <HiX size={18} />
                </button>
              </div>
            ))}
            <button className={styles.addLineBtn} onClick={addInvoiceLine}>
              <HiPlus size={16} /> إضافة صنف آخر
            </button>
            <div className={styles.invoiceTotal}>
              الإجمالي: {formatPrice(invoiceTotal)} ج.م
            </div>
            <hr className={styles.separator} />
            <div>
              <label className={styles.formLabel}>المدفوع</label>
              <input
                type="number"
                className={styles.formInput}
                placeholder="المبلغ المدفوع"
                value={invoicePaidAmount}
                onChange={(e) => setInvoicePaidAmount(e.target.value)}
              />
            </div>
            <div>
              <label className={styles.formLabel}>
                <HiClipboardList size={14} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
                السداد من العهدة
              </label>
              <select
                className={styles.formSelect}
                value={invoicePaymentCustodyId}
                onChange={(e) => setInvoicePaymentCustodyId(e.target.value)}
              >
                {custodies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({Number(c.amount).toLocaleString()} ج.م)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Modal>

        {/* Payment Modal */}
        <Modal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          title="سداد للعميل"
          footer={
            <div className={styles.formActions}>
              <Button variant="secondary" onClick={() => setIsPaymentModalOpen(false)} disabled={savingPayment}>إلغاء</Button>
              <Button variant="primary" onClick={handleSavePayment} loading={savingPayment}>إضافة السداد</Button>
            </div>
          }
        >
          {paymentError && <div className={styles.errorMessage}>{paymentError}</div>}
          <div className={styles.form}>
            <div>
              <label className={styles.formLabel}>
                <HiClipboardList size={14} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
                السداد من العهدة
              </label>
              <select className={styles.formSelect} value={paymentCustodyId} onChange={(e) => setPaymentCustodyId(e.target.value)}>
                {custodies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({Number(c.amount).toLocaleString()} ج.م)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={styles.formLabel}>المبلغ</label>
              <input type="number" className={styles.formInput} placeholder="أدخل المبلغ" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            </div>
          </div>
        </Modal>

        {/* Invoice Detail Modal */}
        <Modal
          isOpen={isInvoiceDetailOpen}
          onClose={() => { setIsInvoiceDetailOpen(false); setSelectedInvoice(null); setConfirmDeleteInvoice(null); }}
          title={isEditingInvoice ? 'تعديل الفاتورة' : 'بيانات الفاتورة'}
          size="large"
          footer={
            !isEditingInvoice ? (
              <div className={styles.formActions}>
                <Button variant="secondary" onClick={() => { setIsInvoiceDetailOpen(false); setSelectedInvoice(null); setConfirmDeleteInvoice(null); }}>إغلاق</Button>
                <Button variant="primary" onClick={startEditInvoice}><HiPencil size={16} style={{ marginLeft: '4px' }} /> تعديل</Button>
                <Button variant="danger" onClick={() => handleDeleteInvoice(selectedInvoice)}><HiTrash size={16} style={{ marginLeft: '4px' }} /> حذف</Button>
              </div>
            ) : (
              <div className={styles.formActions}>
                <Button variant="secondary" onClick={cancelEditInvoice} disabled={savingEditInvoice}>إلغاء التعديل</Button>
                <Button variant="primary" onClick={handleSaveEditedInvoice} loading={savingEditInvoice}>حفظ التعديلات</Button>
              </div>
            )
          }
        >
          {selectedInvoice && !isEditingInvoice && (
            <div>
              <div style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>التاريخ: {formatDate(selectedInvoice.date)}</div>
              {selectedInvoice.products.map((line, idx) => (
                <div key={idx} className={styles.detailProductRow}>
                  <span className={styles.detailProductName}>{line.productName}</span>
                  <span className={styles.detailProductInfo}>
                    {formatPrice(line.sellingPrice)} ج.م × {line.quantity} | {line.storeName}
                  </span>
                </div>
              ))}
              <div className={styles.invoiceTotal}>الإجمالي: {formatPrice(selectedInvoice.totalCost)} ج.م</div>
            </div>
          )}

          {selectedInvoice && isEditingInvoice && (
            <div className={styles.form}>
              {editInvoiceError && <div className={styles.errorMessage}>{editInvoiceError}</div>}
              {editInvoiceLines.map((line, index) => (
                <div key={index} className={styles.productLine}>
                  <div>
                    <label className={styles.formLabel}>المخزن</label>
                    <select className={styles.formSelect} value={line.storeId} onChange={(e) => updateEditLine(index, 'storeId', e.target.value)}>
                      <option value="">اختر مخزن</option>
                      {stores.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className={styles.formLabel}>الصنف</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder={line.storeId ? 'ابحث عن صنف...' : 'اختر مخزن أولاً'}
                      value={line.productSearchText || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const matched = line.storeId ? getProductsInStore(line.storeId).find(sp => sp.productName === val) : null;
                        updateEditLine(index, 'productSearchText', val);
                        updateEditLine(index, 'productId', matched ? matched.productId : '');
                        if (matched) {
                          const p = products.find(pr => pr.id === matched.productId);
                          updateEditLine(index, 'sellingPrice', p ? String(p.price) : '');
                        }
                      }}
                      list={line.storeId ? `edit-customer-products-${index}` : undefined}
                      disabled={!line.storeId}
                    />
                    {line.storeId && (
                      <datalist id={`edit-customer-products-${index}`}>
                        {getProductsInStore(line.storeId).map(sp => (
                          <option key={sp.productId} value={sp.productName} />
                        ))}
                      </datalist>
                    )}
                  </div>
                  <div>
                    <label className={styles.formLabel}>سعر البيع</label>
                    <input type="number" className={styles.formInput} placeholder="0" value={line.sellingPrice} onChange={(e) => updateEditLine(index, 'sellingPrice', e.target.value)} />
                  </div>
                  <div>
                    <label className={styles.formLabel}>الكمية</label>
                    <input type="number" className={styles.formInput} placeholder="0" value={line.quantity} onChange={(e) => updateEditLine(index, 'quantity', e.target.value)} />
                  </div>
                  <button className={styles.removeBtn} onClick={() => removeEditLine(index)} title="حذف الصنف"><HiX size={18} /></button>
                </div>
              ))}
              <button className={styles.addLineBtn} onClick={addEditLine}><HiPlus size={16} /> إضافة صنف آخر</button>
              <div className={styles.invoiceTotal}>الإجمالي: {formatPrice(editInvoiceTotal)} ج.م</div>
            </div>
          )}
        </Modal>

        {/* Delete invoice confirmation */}
        <Modal
          isOpen={!!confirmDeleteInvoice}
          onClose={() => setConfirmDeleteInvoice(null)}
          title="تأكيد الحذف"
          size="small"
          footer={
            <div className={styles.formActions}>
              <Button variant="secondary" onClick={() => setConfirmDeleteInvoice(null)} disabled={deletingInvoice}>إلغاء</Button>
              <Button variant="danger" onClick={confirmDeleteInvoiceAction} loading={deletingInvoice}>تأكيد الحذف</Button>
            </div>
          }
        >
          <p style={{ textAlign: 'center', color: 'var(--text-primary)' }}>
            هل أنت متأكد من حذف هذه الفاتورة؟ سيتم أيضاً حذف كل عمليات السداد المرتبطة بها.
          </p>
        </Modal>

        {/* Credit Limit Error Modal */}
        <Modal
          isOpen={!!creditLimitError}
          onClose={() => setCreditLimitError('')}
          title="خطأ في حد الائتمان"
          size="small"
          footer={
            <div className={styles.formActions}>
              <Button variant="primary" onClick={() => setCreditLimitError('')}>حسناً</Button>
            </div>
          }
        >
          <p style={{ textAlign: 'center', color: '#ef4444', fontWeight: 500 }}>{creditLimitError}</p>
        </Modal>

        {/* Payment Reports Popup */}
        <Modal
          isOpen={isPaymentReportOpen}
          onClose={() => setIsPaymentReportOpen(false)}
          title="تقارير السداد"
          size="large"
          footer={null}
        >
          {filteredPayments.length === 0 ? (
            <div className={styles.emptyState}>
              <p>لا توجد عمليات سداد{filterDateFrom || filterDateTo ? ' في هذا النطاق' : ''}.</p>
            </div>
          ) : (
            <>
              {payTableData.map((p) => (
                <div key={p.id} className={styles.paymentRow}>
                  <div>
                    <div className={styles.paymentAmount}>{p.amount}</div>
                    <div className={styles.paymentDate}>{p.date}</div>
                    {p.invoiceRef && <div className={styles.paymentInvoiceRef}>الفاتورة: {p.invoiceRef}</div>}
                  </div>
                  <button className={styles.removeBtn} onClick={() => handleDeletePayment(p.id)} disabled={deletingPaymentId === p.id} title="حذف">
                    <HiTrash size={16} />
                  </button>
                </div>
              ))}
              <div style={{ marginTop: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-primary)' }}>
                إجمالي السداد: {formatPrice(filteredPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0))} ج.م
              </div>
            </>
          )}
        </Modal>
      </MainLayout>
    </AuthGuard>
  );
}
