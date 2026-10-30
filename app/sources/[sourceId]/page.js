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
import OwnerOnly from '../../../components/auth/OwnerOnly';
import InvoiceLinesEditor, { emptyLine, linesTotal, linesFromInvoice } from '../../../components/invoices/InvoiceLinesEditor';
import {
  subscribeToSource,
  subscribeToSourceInvoices,
  addSourceInvoice,
  updateSourceInvoice,
  deleteSourceInvoice,
  subscribeToSourcePayments,
  addSourcePayment,
  deleteSourcePayment,
  subscribeToProducts,
  subscribeToStores,
  subscribeToCustodies,
  fetchSourceInvoicePayments,
} from '../../../lib/firebase/firestore';
import { safeMoney, sumMoney, summarizePayments } from '../../../lib/domain/accounting';
import { parseDateInput } from '../../../lib/dates';
import { invoiceLabel } from '../../../lib/domain/reports';
import { fmtCurrency, fmtDate } from '../../../lib/format';
import InvoiceDocument from '../../../components/pdf/InvoiceDocument';
import SharePdfDialog from '../../../components/pdf/SharePdfDialog';
import usePdfShare from '../../../components/pdf/usePdfShare';
import PartyStatement from '../../../components/statements/PartyStatement';
import { FaWhatsapp } from 'react-icons/fa';
import { HiTruck, HiCurrencyDollar, HiCash, HiDocumentReport, HiArrowRight, HiPlus, HiTrash, HiPencil, HiEye, HiDotsVertical, HiClipboardList, HiDownload, HiDocumentText } from 'react-icons/hi';
import styles from './page.module.css';

const PAGE_SIZE = 50;

export default function SourceDetailPage() {
  return (
    <AuthGuard>
      <MainLayout>
        <OwnerOnly>
          <SourceDetail />
        </OwnerOnly>
      </MainLayout>
    </AuthGuard>
  );
}

function SourceDetail() {
  const router = useRouter();
  const params = useParams();
  const sourceId = params.sourceId;

  const [source, setSource] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [custodies, setCustodies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Date filter
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const fromDate = parseDateInput(filterDateFrom);
  const toDate = parseDateInput(filterDateTo);
  const isFiltered = Boolean(fromDate || toDate);

  // Invoice modal state
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceLines, setInvoiceLines] = useState([emptyLine('wholesalePrice')]);
  const [invoiceError, setInvoiceError] = useState('');
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [invoicePaid, setInvoicePaid] = useState('');
  const [invoiceCustodyId, setInvoiceCustodyId] = useState('');

  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentDirection, setPaymentDirection] = useState('out');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentCustodyId, setPaymentCustodyId] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // Invoice detail / edit / delete
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isEditingInvoice, setIsEditingInvoice] = useState(false);
  const [editInvoiceLines, setEditInvoiceLines] = useState([]);
  const [editInvoiceError, setEditInvoiceError] = useState('');
  const [savingEditInvoice, setSavingEditInvoice] = useState(false);
  const [confirmDeleteInvoice, setConfirmDeleteInvoice] = useState(null);
  const [deletingInvoice, setDeletingInvoice] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Payment reports
  const [isPaymentReportOpen, setIsPaymentReportOpen] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState(null);
  const [paymentReportError, setPaymentReportError] = useState('');

  // Selection
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);

  // كشف الحساب ومشاركة الفواتير PDF
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const share = usePdfShare();

  // Mobile menu
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

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

  useEffect(() => {
    const unsubSource = subscribeToSource(sourceId, setSource, setLoadError);
    const unsubProducts = subscribeToProducts(setProducts, setLoadError);
    const unsubStores = subscribeToStores(setStores, setLoadError);
    const unsubCustodies = subscribeToCustodies(setCustodies, setLoadError);
    return () => {
      unsubSource();
      unsubProducts();
      unsubStores();
      unsubCustodies();
    };
  }, [sourceId]);

  const fromKey = fromDate?.getTime();
  const toKey = toDate?.getTime();
  useEffect(() => {
    const range = { from: fromKey ? new Date(fromKey) : null, to: toKey ? new Date(toKey) : null, pageSize };
    const unsubInvoices = subscribeToSourceInvoices(sourceId, range, (data) => {
      setInvoices(data);
      setLoading(false);
    }, (msg) => {
      setLoadError(msg);
      setLoading(false);
    });
    const unsubPayments = subscribeToSourcePayments(sourceId, range, setPayments, setLoadError);
    return () => {
      unsubInvoices();
      unsubPayments();
    };
  }, [sourceId, fromKey, toKey, pageSize]);

  const formatPrice = (val) => {
    const num = Number(val);
    return isNaN(num) ? '0' : num.toLocaleString();
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('ar-EG');
  };

  // الرصيد الكلي من مستند المورد (بيتحدث جوه نفس الـ transaction مع كل عملية)
  const allTimeRemaining = safeMoney(source?.balance);
  const periodInvoicesTotal = sumMoney(invoices, (inv) => inv.totalCost);
  const periodPayments = summarizePayments(payments);

  // Invoice helpers
  const openInvoiceModal = () => {
    setInvoiceLines([emptyLine('wholesalePrice')]);
    setInvoiceError('');
    setInvoicePaid('');
    setInvoiceCustodyId(custodies.length > 0 ? custodies[0].id : '');
    setIsInvoiceModalOpen(true);
  };

  const invoiceTotal = linesTotal(invoiceLines, 'wholesalePrice');

  const handleSaveInvoice = async () => {
    setSavingInvoice(true);
    setInvoiceError('');
    const result = await addSourceInvoice({
      sourceId,
      lines: invoiceLines,
      paidAmount: invoicePaid,
      custodyId: invoiceCustodyId,
    });
    setSavingInvoice(false);
    if (!result.success) {
      setInvoiceError(result.error);
      return;
    }
    setIsInvoiceModalOpen(false);
  };

  // Payment helpers
  const openPaymentModal = () => {
    setPaymentDirection('out');
    setPaymentAmount('');
    setPaymentNotes('');
    setPaymentCustodyId(custodies.length > 0 ? custodies[0].id : '');
    setPaymentError('');
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = async () => {
    const value = Number(paymentAmount);
    if (!paymentAmount || !Number.isFinite(value) || value <= 0) {
      setPaymentError('يرجى إدخال مبلغ صحيح أكبر من صفر');
      return;
    }
    setSavingPayment(true);
    setPaymentError('');
    // موجب = دفع للمورد، سالب = استرداد من المورد
    const result = await addSourcePayment({
      sourceId,
      amount: paymentDirection === 'in' ? -value : value,
      custodyId: paymentCustodyId,
      notes: paymentNotes,
    });
    setSavingPayment(false);
    if (!result.success) {
      setPaymentError(result.error);
      return;
    }
    setIsPaymentModalOpen(false);
  };

  const handleDeletePayment = async (payment) => {
    if (!confirm(`هل أنت متأكد من حذف هذه العملية بمبلغ ${formatPrice(Math.abs(payment.amount))} ج.م؟`)) return;
    setDeletingPaymentId(payment.id);
    setPaymentReportError('');
    const result = await deleteSourcePayment(payment.id);
    setDeletingPaymentId(null);
    if (!result.success) setPaymentReportError(result.error);
  };

  // Invoice detail / edit / delete
  const closeInvoiceDetail = () => {
    setSelectedInvoice(null);
    setIsEditingInvoice(false);
    setConfirmDeleteInvoice(null);
  };

  const startEditInvoice = () => {
    setEditInvoiceLines(linesFromInvoice(selectedInvoice));
    setEditInvoiceError('');
    setIsEditingInvoice(true);
  };

  const editInvoiceTotal = linesTotal(editInvoiceLines, 'wholesalePrice');

  const handleSaveEditedInvoice = async () => {
    setSavingEditInvoice(true);
    setEditInvoiceError('');
    const result = await updateSourceInvoice(selectedInvoice.id, { lines: editInvoiceLines });
    setSavingEditInvoice(false);
    if (!result.success) {
      setEditInvoiceError(result.error);
      return;
    }
    closeInvoiceDetail();
  };

  const confirmDeleteInvoiceAction = async () => {
    if (!confirmDeleteInvoice) return;
    setDeletingInvoice(true);
    setDeleteError('');
    const result = await deleteSourceInvoice(confirmDeleteInvoice.id);
    setDeletingInvoice(false);
    if (!result.success) {
      setDeleteError(result.error);
      return;
    }
    closeInvoiceDetail();
  };

  const handleDeleteSelected = async () => {
    if (selectedInvoiceIds.length === 0) return;
    if (!confirm(`هل أنت متأكد من حذف ${selectedInvoiceIds.length} فاتورة؟`)) return;
    setIsDeletingSelected(true);
    let deleted = 0;
    const errors = [];
    for (const id of selectedInvoiceIds) {
      const result = await deleteSourceInvoice(id);
      if (result.success) deleted++;
      else errors.push(result.error);
    }
    setIsDeletingSelected(false);
    setSelectedInvoiceIds([]);
    alert(`تم حذف ${deleted} فاتورة${errors.length ? `\nلم يتم حذف ${errors.length}:\n${errors.slice(0, 5).join('\n')}` : ''}`);
  };

  const getInvoiceRef = (invoiceId) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    return inv ? `${formatDate(inv.date)} - ${formatPrice(inv.totalCost)} ج.م` : 'فاتورة';
  };

  // فاتورة PDF احترافية: mode = 'share' (واتساب) أو 'download'
  const exportInvoice = (inv, mode) => {
    const partyInfo = { name: source?.name || '', phone: source?.phone || '' };
    const safeName = partyInfo.name.replace(/[\\/:*?"<>|]/g, '').trim();
    let paid = 0;
    return share.generate(`${mode}-${inv.id}`, async () => {
      const res = await fetchSourceInvoicePayments(inv.id);
      const linked = res.success ? res.payments : [];
      paid = linked.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      return <InvoiceDocument kind="purchase" invoice={inv} party={partyInfo} payments={linked} partyBalance={safeMoney(source?.balance)} />;
    }, {
      filename: `فاتورة شراء-${invoiceLabel(inv).slice(1)}-${safeName}.pdf`,
      phone: partyInfo.phone,
      recipient: partyInfo.name,
      get message() {
        return [
          `مرحباً ${partyInfo.name}`,
          `مرفق فاتورة شراء رقم ${invoiceLabel(inv)} بتاريخ ${fmtDate(inv.date)}`,
          `الإجمالي: ${fmtCurrency(inv.totalCost)}`,
          `المدفوع: ${fmtCurrency(paid)}`,
          `المتبقي: ${fmtCurrency(Math.max(0, (Number(inv.totalCost) || 0) - paid))}`,
          `إجمالي رصيد الحساب: ${fmtCurrency(Math.abs(safeMoney(source?.balance)))}`,
          'Mado Smoking',
        ].join('\n');
      },
    }, mode);
  };

  const invColumns = [
    {
      key: 'select',
      label: (
        <input
          type="checkbox"
          checked={invoices.length > 0 && selectedInvoiceIds.length === invoices.length}
          onChange={() => {
            setSelectedInvoiceIds(selectedInvoiceIds.length === invoices.length ? [] : invoices.map((inv) => inv.id));
          }}
        />
      ),
    },
    { key: 'number', label: 'رقم' },
    { key: 'date', label: 'التاريخ' },
    { key: 'items', label: 'عدد الأصناف' },
    { key: 'total', label: 'الإجمالي' },
    { key: 'actions', label: '' },
  ];

  const invTableData = invoices.map((inv) => ({
    id: inv.id,
    select: (
      <input
        type="checkbox"
        checked={selectedInvoiceIds.includes(inv.id)}
        onChange={() => {
          setSelectedInvoiceIds((prev) => (prev.includes(inv.id) ? prev.filter((id) => id !== inv.id) : [...prev, inv.id]));
        }}
      />
    ),
    number: invoiceLabel(inv),
    date: formatDate(inv.date),
    items: inv.totalItems || 0,
    total: `${formatPrice(inv.totalCost)} ج.م`,
    actions: (
      <button className={styles.viewBtn} onClick={(e) => { e.stopPropagation(); setSelectedInvoice(inv); setIsEditingInvoice(false); }} title="عرض الفاتورة">
        <HiEye size={16} />
      </button>
    ),
  }));
  invTableData.forEach((row) => {
    const inv = invoices.find((i) => i.id === row.id);
    const busy = share.generating === `share-${inv.id}`;
    row.actions = (
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        {row.actions}
        <button
          className={styles.viewBtn}
          onClick={(e) => { e.stopPropagation(); exportInvoice(inv, 'share'); }}
          disabled={!!share.generating}
          title="إرسال الفاتورة PDF على واتساب"
          style={{ color: '#25D366', opacity: share.generating && !busy ? 0.5 : 1 }}
        >
          {busy ? <span style={{ fontSize: '11px' }}>...</span> : <FaWhatsapp size={17} />}
        </button>
      </div>
    );
  });

  const custodyOptions = custodies.map((c) => (
    <option key={c.id} value={c.id}>
      {c.name} ({formatPrice(c.amount)} ج.م)
    </option>
  ));

  return (
    <>
      <div className={styles.container}>
        <div className={styles.header}>
          <button className={styles.backButton} onClick={() => router.push('/sources')}>
            <HiArrowRight size={18} />
            العودة إلى المصادر
          </button>
          <div className={styles.headerRow}>
            <h1 className={styles.sourceTitle}>
              <HiTruck style={{ color: 'var(--primary-color)' }} />
              {source?.name || 'المصدر'}
            </h1>
            <div className={styles.headerActionsDesktop}>
              <button className={`${styles.actionBtn} ${styles.secondaryBtn}`} onClick={() => setIsStatementOpen(true)}>
                <HiDocumentText size={18} />
                كشف حساب
              </button>
              <button className={`${styles.actionBtn} ${styles.primaryBtn}`} onClick={openInvoiceModal}>
                <HiPlus size={18} />
                إضافة فاتورة
              </button>
              <button className={`${styles.actionBtn} ${styles.secondaryBtn}`} onClick={openPaymentModal}>
                <HiCash size={18} />
                سداد
              </button>
              <button className={`${styles.actionBtn} ${styles.warningBtn}`} onClick={() => setIsPaymentReportOpen(true)}>
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
                  <button className={styles.dropdownItem} onClick={() => { setIsMenuOpen(false); setIsStatementOpen(true); }}>
                    <HiDocumentText size={16} /> كشف حساب
                  </button>
                  <button className={styles.dropdownItem} onClick={() => { setIsMenuOpen(false); openInvoiceModal(); }}>
                    <HiPlus size={16} /> إضافة فاتورة
                  </button>
                  <button className={styles.dropdownItem} onClick={() => { setIsMenuOpen(false); openPaymentModal(); }}>
                    <HiCash size={16} /> سداد
                  </button>
                  <button className={styles.dropdownItem} onClick={() => { setIsMenuOpen(false); setIsPaymentReportOpen(true); }}>
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
          {isFiltered && (
            <button className={styles.clearFilterBtn} onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}>
              إلغاء الفلتر
            </button>
          )}
        </div>

        {(loadError || share.error) && <div className={styles.errorMessage}>{loadError || share.error}</div>}

        {loading ? (
          <div className={styles.loading}>جاري التحميل...</div>
        ) : (
          <>
            <div className={styles.cardsGrid}>
              {isFiltered ? (
                <>
                  <SummaryCard title="توريد الفترة" value={`${invoices.length} فاتورة - ${formatPrice(periodInvoicesTotal)} ج.م`} icon={HiClipboardList} />
                  <SummaryCard title="مدفوعات الفترة (صافي)" value={`${formatPrice(periodPayments.net)} ج.م`} icon={HiCash} />
                </>
              ) : (
                <>
                  <SummaryCard title="إجمالي التوريد" value={`${formatPrice(source?.totalInvoiced)} ج.م`} icon={HiCurrencyDollar} />
                  <SummaryCard title="صافي المدفوع" value={`${formatPrice(source?.totalPaid)} ج.م`} icon={HiCash} />
                </>
              )}
              <SummaryCard
                title={allTimeRemaining < 0 ? 'رصيد لنا عند المورد' : 'المتبقي (مستحقات المورد)'}
                value={`${formatPrice(Math.abs(allTimeRemaining))} ج.م`}
                icon={HiDocumentReport}
              />
            </div>

            {invoices.length === 0 ? (
              <Card>
                <div className={styles.emptyState}>
                  <p>لا توجد فواتير{isFiltered ? ' في هذا النطاق' : ' لهذا المصدر'}.</p>
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
                {!isFiltered && invoices.length >= pageSize && (
                  <div style={{ textAlign: 'center', marginTop: '12px' }}>
                    <button className={styles.clearFilterBtn} onClick={() => setPageSize((n) => n + PAGE_SIZE)}>تحميل المزيد</button>
                  </div>
                )}
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
          <InvoiceLinesEditor
            mode="purchase"
            lines={invoiceLines}
            onChange={setInvoiceLines}
            stores={stores}
            products={products}
            priceField="wholesalePrice"
            priceLabel="سعر التوريد"
            styles={styles}
            idPrefix="source"
          />
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>المدفوع</label>
            <input type="number" min="0" className={styles.formInput} placeholder="0" value={invoicePaid} onChange={(e) => setInvoicePaid(e.target.value)} style={{ maxWidth: '250px' }} />
          </div>
          {Number(invoicePaid) > 0 && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>خصم من عهدة</label>
              <select className={styles.formSelect} value={invoiceCustodyId} onChange={(e) => setInvoiceCustodyId(e.target.value)} style={{ maxWidth: '250px' }}>
                {custodyOptions}
              </select>
            </div>
          )}
          <div className={styles.invoiceTotal}>
            <div>إجمالي الفاتورة: {formatPrice(invoiceTotal)} ج.م</div>
            <div>المدفوع: {formatPrice(Number(invoicePaid) || 0)} ج.م</div>
            <div>المتبقي من الفاتورة: {formatPrice(invoiceTotal - (Number(invoicePaid) || 0))} ج.م</div>
          </div>
        </div>
      </Modal>

      {/* Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="سداد للمورد"
        footer={
          <div className={styles.formActions}>
            <Button variant="secondary" onClick={() => setIsPaymentModalOpen(false)} disabled={savingPayment}>إلغاء</Button>
            <Button variant="primary" onClick={handleSavePayment} loading={savingPayment}>تسجيل</Button>
          </div>
        }
      >
        {paymentError && <div className={styles.errorMessage}>{paymentError}</div>}
        <div className={styles.form}>
          <div>
            <label className={styles.formLabel}>نوع العملية</label>
            <select className={styles.formSelect} value={paymentDirection} onChange={(e) => setPaymentDirection(e.target.value)}>
              <option value="out">دفع للمورد (يقلل المستحقات ويخصم من العهدة)</option>
              <option value="in">استرداد من المورد (يزود المستحقات ويزود العهدة)</option>
            </select>
          </div>
          <div>
            <label className={styles.formLabel}>
              <HiClipboardList size={14} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
              العهدة
            </label>
            <select className={styles.formSelect} value={paymentCustodyId} onChange={(e) => setPaymentCustodyId(e.target.value)}>
              {custodyOptions}
            </select>
          </div>
          <div>
            <label className={styles.formLabel}>المبلغ</label>
            <input type="number" min="0" className={styles.formInput} placeholder="أدخل المبلغ" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
          </div>
          <div>
            <label className={styles.formLabel}>ملاحظة</label>
            <input type="text" className={styles.formInput} placeholder="اختياري" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} />
          </div>
        </div>
      </Modal>

      {/* Invoice Detail Modal */}
      <Modal
        isOpen={!!selectedInvoice}
        onClose={closeInvoiceDetail}
        title={isEditingInvoice ? 'تعديل الفاتورة' : 'بيانات الفاتورة'}
        size="large"
        footer={
          !isEditingInvoice ? (
            <div className={styles.formActions}>
              <Button variant="secondary" onClick={closeInvoiceDetail}>إغلاق</Button>
              <Button variant="secondary" onClick={() => exportInvoice(selectedInvoice, 'download')} loading={share.generating === `download-${selectedInvoice?.id}`} disabled={!!share.generating}>
                <HiDownload size={16} style={{ marginLeft: '4px' }} /> PDF
              </Button>
              <Button variant="primary" onClick={() => exportInvoice(selectedInvoice, 'share')} loading={share.generating === `share-${selectedInvoice?.id}`} disabled={!!share.generating} style={{ background: '#25D366', borderColor: '#25D366' }}>
                <FaWhatsapp size={16} style={{ marginLeft: '4px' }} /> واتساب
              </Button>
              <Button variant="primary" onClick={startEditInvoice}><HiPencil size={16} style={{ marginLeft: '4px' }} /> تعديل</Button>
              <Button variant="danger" onClick={() => { setDeleteError(''); setConfirmDeleteInvoice(selectedInvoice); }}><HiTrash size={16} style={{ marginLeft: '4px' }} /> حذف</Button>
            </div>
          ) : (
            <div className={styles.formActions}>
              <Button variant="secondary" onClick={() => setIsEditingInvoice(false)} disabled={savingEditInvoice}>إلغاء التعديل</Button>
              <Button variant="primary" onClick={handleSaveEditedInvoice} loading={savingEditInvoice}>حفظ التعديلات</Button>
            </div>
          )
        }
      >
        {selectedInvoice && !isEditingInvoice && (
          <div>
            <div style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>فاتورة {invoiceLabel(selectedInvoice)} | التاريخ: {formatDate(selectedInvoice.date)}</div>
            {(selectedInvoice.products || []).map((line, idx) => (
              <div key={idx} className={styles.detailProductRow}>
                <span className={styles.detailProductName}>{line.productName}</span>
                <span className={styles.detailProductInfo}>
                  {formatPrice(line.wholesalePrice)} ج.م × {line.quantity} | {line.storeName}
                </span>
              </div>
            ))}
            <div className={styles.invoiceTotal}>
              <div>الإجمالي: {formatPrice(selectedInvoice.totalCost)} ج.م</div>
            </div>
          </div>
        )}

        {selectedInvoice && isEditingInvoice && (
          <div className={styles.form}>
            {editInvoiceError && <div className={styles.errorMessage}>{editInvoiceError}</div>}
            <InvoiceLinesEditor
              mode="purchase"
              lines={editInvoiceLines}
              onChange={setEditInvoiceLines}
              stores={stores}
              products={products}
              priceField="wholesalePrice"
              priceLabel="سعر التوريد"
              styles={styles}
              idPrefix="edit-source"
            />
            <div className={styles.invoiceTotal}>
              <div>الإجمالي: {formatPrice(editInvoiceTotal)} ج.م</div>
            </div>
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
        {deleteError && <div className={styles.errorMessage}>{deleteError}</div>}
        <p style={{ textAlign: 'center', color: 'var(--text-primary)' }}>
          هل أنت متأكد من حذف هذه الفاتورة؟ سيتم خصم الأصناف من المخزن وحذف عمليات السداد المرتبطة بها وإرجاع مبالغها للعهدة.
        </p>
      </Modal>

      {/* Payment Reports Popup */}
      <Modal
        isOpen={isPaymentReportOpen}
        onClose={() => setIsPaymentReportOpen(false)}
        title="تقارير السداد"
        size="large"
        footer={null}
      >
        {paymentReportError && <div className={styles.errorMessage}>{paymentReportError}</div>}
        {payments.length === 0 ? (
          <div className={styles.emptyState}>
            <p>لا توجد عمليات سداد{isFiltered ? ' في هذا النطاق' : ''}.</p>
          </div>
        ) : (
          <>
            {payments.map((p) => {
              const isRefund = Number(p.amount) < 0;
              return (
                <div key={p.id} className={styles.paymentRow}>
                  <div>
                    <div className={styles.paymentAmount} style={isRefund ? { color: '#10b981' } : undefined}>
                      {isRefund ? 'استرداد من المورد: ' : 'دفع: '}{formatPrice(Math.abs(p.amount))} ج.م
                    </div>
                    <div className={styles.paymentDate}>
                      {formatDate(p.date)}{p.custodyName ? ` | ${p.custodyName}` : ''}{p.notes ? ` | ${p.notes}` : ''}
                    </div>
                    {p.invoiceId && <div className={styles.paymentInvoiceRef}>الفاتورة: {getInvoiceRef(p.invoiceId)}</div>}
                  </div>
                  <button className={styles.removeBtn} onClick={() => handleDeletePayment(p)} disabled={deletingPaymentId === p.id} title="حذف">
                    <HiTrash size={16} />
                  </button>
                </div>
              );
            })}
            <div style={{ marginTop: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.9 }}>
              <div>إجمالي المدفوع: {formatPrice(periodPayments.received)} ج.م</div>
              {periodPayments.refunded > 0 && <div>إجمالي المسترد: {formatPrice(periodPayments.refunded)} ج.م</div>}
              <div>الصافي: {formatPrice(periodPayments.net)} ج.م</div>
            </div>
            {!isFiltered && payments.length >= pageSize && (
              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <button className={styles.clearFilterBtn} onClick={() => setPageSize((n) => n + PAGE_SIZE)}>تحميل المزيد</button>
              </div>
            )}
          </>
        )}
      </Modal>
      <PartyStatement kind="purchase" party={source} isOpen={isStatementOpen} onClose={() => setIsStatementOpen(false)} />
      <SharePdfDialog pdf={share.pdf} onClose={share.close} />
    </>
  );
}
