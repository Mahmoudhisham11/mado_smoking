'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AuthGuard from '../../../components/auth/AuthGuard';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/layout/PageHeader';
import Table from '../../../components/ui/Table';
import Modal from '../../../components/ui/Modal';
import Card from '../../../components/ui/Card';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import { getSource, getInvoices, addInvoice, addProduct, getStores, getNextProductCode, returnInvoice, returnProduct, addPayment, getPayments, deletePayment, updatePayment, subscribeToSource, subscribeToInvoices, subscribeToCashRegisters, getUsersByOwner } from '../../../lib/firebase/firestore';
import SummaryCard from '../../../components/dashboard/SummaryCard';
import { HiTrash, HiDocumentText, HiCube, HiCurrencyDollar, HiPencil, HiDocumentReport } from 'react-icons/hi';
import { useToast } from '../../../contexts/ToastContext';
import styles from './page.module.css';
import { getUserFromLocalStorage } from '../../../lib/auth';
import { useAuth } from '../../../contexts/AuthContext';

export default function SourceDetailsPage() {
  const params = useParams();
  const sourceId = params.sourceId;
  const { showToast } = useToast();
  const { user, userData } = useAuth();
  const localUserData = getUserFromLocalStorage();
  const userRole = localUserData?.role || userData?.role || 'user';
  const isOwner = userRole === 'owner';
  const [source, setSource] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isViewInvoiceModalOpen, setIsViewInvoiceModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPaymentsReportModalOpen, setIsPaymentsReportModalOpen] = useState(false);
  const [paymentsReport, setPaymentsReport] = useState([]);
  const [paymentsReportLoading, setPaymentsReportLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [returnType, setReturnType] = useState('full'); // 'full' or 'product'
  const [selectedProductIndex, setSelectedProductIndex] = useState(null);
  const [returnError, setReturnError] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [selectedCashRegisterId, setSelectedCashRegisterId] = useState('');
  const [cashRegisters, setCashRegisters] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingInvoice, setAddingInvoice] = useState(false);
  const [addingPayment, setAddingPayment] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [returningInvoice, setReturningInvoice] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [paymentToDelete, setPaymentToDelete] = useState(null);
  const [isEditPaymentModalOpen, setIsEditPaymentModalOpen] = useState(false);
  const [isDeletePaymentModalOpen, setIsDeletePaymentModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState({
    productName: '',
    wholesalePrice: '',
    sellPrice: '',
    finalPrice: '',
    quantity: '',
    category: '',
    storeId: '',
  });
  const [productsList, setProductsList] = useState([]);
  const [productCode, setProductCode] = useState(1000);

  const categories = [
    { value: 'مستورد', label: 'مستورد' },
    { value: 'شركة', label: 'شركة' },
    { value: 'فحم', label: 'فحم' },
    { value: 'بفرة', label: 'بفرة' },
    { value: 'ولاعات', label: 'ولاعات' },
    { value: 'معسل', label: 'معسل' },
  ];

  useEffect(() => {
    if (sourceId) {
      loadNextProductCode();
      loadStores();
      
      // Subscribe to source with real-time updates
      setLoading(true);
      const unsubscribeSource = subscribeToSource(sourceId, (sourceData) => {
        setSource(sourceData);
        setLoading(false);
      });
      
      // Subscribe to invoices with real-time updates
      const unsubscribeInvoices = subscribeToInvoices(sourceId, (invoicesData) => {
        setInvoices(invoicesData);
      });
      
      return () => {
        if (unsubscribeSource) unsubscribeSource();
        if (unsubscribeInvoices) unsubscribeInvoices();
      };
    }
  }, [sourceId]);

  // Load cash registers + users (owner-only actions)
  useEffect(() => {
    if (!isOwner) return;

    const ownerId = localUserData?.ownerId || localUserData?.uid || user?.uid;
    if (ownerId) {
      getUsersByOwner(ownerId)
        .then((usersList) => setUsers(usersList || []))
        .catch((e) => console.error('Error loading users:', e));
    }

    const unsubscribe = subscribeToCashRegisters((registers) => {
      setCashRegisters(registers || []);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOwner, localUserData, user]);

  const getRegisterName = (register) => {
    if (!register) return 'غير معروف';
    if (register.userId === null) return 'العهدة الرئيسية';
    const u = users.find(x => x.uid === register.userId);
    return u ? `${u.name || u.email} - عهدة` : 'عهدة مستخدم';
  };

  const loadStores = async () => {
    try {
      const storesData = await getStores();
      setStores(storesData);
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setIsViewInvoiceModalOpen(true);
  };

  const loadNextProductCode = async () => {
    try {
      const nextCode = await getNextProductCode();
      setProductCode(nextCode);
    } catch (error) {
      console.error('Error loading next product code:', error);
      setProductCode(1000);
    }
  };

  const handleAddProductToList = async () => {
    if (!currentProduct.productName || !currentProduct.quantity || !currentProduct.storeId) {
      return;
    }

    // الحصول على كود جديد - استخدام الكود الحالي أولاً
    let nextCode = productCode;
    
    // التحقق من أن الكود غير مستخدم في القائمة الحالية
    const usedCodes = productsList.map(p => p.code);
    while (usedCodes.includes(nextCode)) {
      nextCode = await getNextProductCode();
    }

    const newProduct = {
      ...currentProduct,
      code: nextCode,
    };

    setProductsList([...productsList, newProduct]);
    setProductCode(nextCode + 1); // تحديث الكود التالي
    
    // Reset current product form
    setCurrentProduct({
      productName: '',
      wholesalePrice: '',
      sellPrice: '',
      finalPrice: '',
      quantity: '',
      category: '',
      storeId: '',
    });
  };

  const handleRemoveProduct = (index) => {
    setProductsList(productsList.filter((_, i) => i !== index));
  };

  const handleAddInvoice = async () => {
    if (productsList.length === 0) return;

    setAddingInvoice(true);
    try {
      // Calculate totals
      const totalItems = productsList.reduce((sum, p) => sum + (parseInt(p.quantity) || 0), 0);
      const totalCost = productsList.reduce((sum, p) => sum + ((parseFloat(p.finalPrice) || 0) * (parseInt(p.quantity) || 0)), 0);
      
      // Get storeId from first product (assuming all products go to same store)
      const storeId = productsList[0].storeId;

      // Use the codes already assigned to products in the list
      const products = productsList.map((p) => ({
        code: p.code,
        name: p.productName,
        wholesalePrice: parseFloat(p.wholesalePrice) || 0,
        sellPrice: parseFloat(p.sellPrice) || 0,
        finalPrice: parseFloat(p.finalPrice) || 0,
        quantity: parseInt(p.quantity) || 0,
        category: p.category,
        storeId: p.storeId,
      }));

      // Get payment amount from state (if exists)
      const paidAmount = parseFloat(paymentAmount) || 0;
      const remainingAmount = totalCost - paidAmount;
      const overpaid = paidAmount > totalCost;

      const invoiceData = {
        sourceId,
        date: new Date(),
        products,
        totalItems,
        totalCost,
        paidAmount,
        remainingAmount,
        overpaid,
        storeId,
      };

      const invoiceResult = await addInvoice(invoiceData);
      
      if (invoiceResult.success) {
        // Add all products to Firestore
        for (const product of products) {
          await addProduct(product);
        }

        // Reset everything and get next code
        setCurrentProduct({
          productName: '',
          wholesalePrice: '',
          sellPrice: '',
          finalPrice: '',
          quantity: '',
          category: '',
          storeId: '',
        });
        setProductsList([]);
        setPaymentAmount('');
        await loadNextProductCode();
        setIsInvoiceModalOpen(false);
      } else {
        console.error('Failed to add invoice:', invoiceResult.error);
      }
    } catch (error) {
      console.error('Error adding invoice:', error);
    } finally {
      setAddingInvoice(false);
    }
  };

  const handleReturnInvoice = () => {
    if (!selectedInvoice) return;
    setReturnType('full');
    setSelectedProductIndex(null);
    setIsReturnModalOpen(true);
    setReturnError('');
  };

  const handleReturnProduct = (productIndex) => {
    if (!selectedInvoice) return;
    setReturnType('product');
    setSelectedProductIndex(productIndex);
    setIsReturnModalOpen(true);
    setReturnError('');
  };

  const confirmReturn = async () => {
    if (!selectedInvoice) return;

    setReturningInvoice(true);
    setReturnError('');
    try {
      let result;
      if (returnType === 'full') {
        result = await returnInvoice(selectedInvoice.id);
      } else {
        result = await returnProduct(selectedInvoice.id, selectedProductIndex);
      }

      if (result.success) {
        setIsReturnModalOpen(false);
        
        // إذا تم حذف الفاتورة، أغلق modal العرض
        if (result.deleted) {
          setIsViewInvoiceModalOpen(false);
          setSelectedInvoice(null);
        } else {
          // إذا لم يتم حذفها، حدث بيانات الفاتورة
        // The invoices will be updated automatically via subscription
        // Just update the selected invoice if it still exists
        const updatedInvoices = await getInvoices(sourceId);
        const updatedInvoice = updatedInvoices.find(inv => inv.id === selectedInvoice.id);
        if (updatedInvoice) {
          setSelectedInvoice(updatedInvoice);
        } else {
          // إذا لم تعد موجودة (تم حذفها)، أغلق modal
          setIsViewInvoiceModalOpen(false);
          setSelectedInvoice(null);
        }
        }
      } else {
        setReturnError(result.error || 'حدث خطأ أثناء عمل المرتجع');
      }
    } catch (error) {
      console.error('Error returning invoice/product:', error);
      setReturnError('حدث خطأ أثناء عمل المرتجع');
    } finally {
      setReturningInvoice(false);
    }
  };

  const handleAddPayment = () => {
    setPaymentAmount('');
    setPaymentError('');
    setSelectedCashRegisterId('');
    setIsPaymentModalOpen(true);
  };

  const handlePaymentsReport = async () => {
    setIsPaymentsReportModalOpen(true);
    setPaymentsReportLoading(true);
    try {
      const payments = await getPayments(sourceId);
      setPaymentsReport(payments);
    } catch (error) {
      console.error('Error loading payments report:', error);
    } finally {
      setPaymentsReportLoading(false);
    }
  };

  const confirmPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      setPaymentError('يرجى إدخال مبلغ صحيح');
      return;
    }

    const totalRemaining = invoices.reduce((sum, inv) => sum + (inv.remainingAmount || 0), 0);
    if (parseFloat(paymentAmount) > totalRemaining) {
      setPaymentError('المبلغ أكبر من إجمالي المتبقي');
      return;
    }

    setAddingPayment(true);
    setPaymentError('');
    try {
      if (!selectedCashRegisterId) {
        setPaymentError('يرجى اختيار العهدة');
        setAddingPayment(false);
        return;
      }

      const result = await addPayment(sourceId, parseFloat(paymentAmount), selectedCashRegisterId);
      
      if (result.success) {
        setIsPaymentModalOpen(false);
        setPaymentAmount('');
        setSelectedCashRegisterId('');
        // The invoices will be updated automatically via subscription
      } else {
        setPaymentError(result.error || 'حدث خطأ أثناء إضافة السداد');
      }
    } catch (error) {
      console.error('Error adding payment:', error);
      setPaymentError('حدث خطأ أثناء إضافة السداد');
    } finally {
      setAddingPayment(false);
    }
  };

  const handleEditPayment = (payment) => {
    setEditingPayment(payment);
    setPaymentAmount(payment.amount.toString());
    setPaymentError('');
    setIsEditPaymentModalOpen(true);
  };

  const handleDeletePayment = (payment) => {
    setPaymentToDelete(payment);
    setIsDeletePaymentModalOpen(true);
  };

  const confirmUpdatePayment = async () => {
    if (!editingPayment || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      setPaymentError('يرجى إدخال مبلغ صحيح');
      return;
    }

    setUpdatingPayment(true);
    setPaymentError('');
    try {
      // keep the same cash register unless changed in the future
      const result = await updatePayment(editingPayment.id, parseFloat(paymentAmount));
      
      if (result.success) {
        setIsEditPaymentModalOpen(false);
        setEditingPayment(null);
        setPaymentAmount('');
        // Reload payments report
        const payments = await getPayments(sourceId);
        setPaymentsReport(payments);
      } else {
        setPaymentError(result.error || 'حدث خطأ أثناء تعديل السداد');
      }
    } catch (error) {
      console.error('Error updating payment:', error);
      setPaymentError('حدث خطأ أثناء تعديل السداد');
    } finally {
      setUpdatingPayment(false);
    }
  };

  const confirmDeletePayment = async () => {
    if (!paymentToDelete) return;

    setDeletingPayment(true);
    try {
      const result = await deletePayment(paymentToDelete.id);
      
      if (result.success) {
        setIsDeletePaymentModalOpen(false);
        setPaymentToDelete(null);
        showToast('تم حذف السداد بنجاح', 'success');
        // Reload payments report
        const payments = await getPayments(sourceId);
        setPaymentsReport(payments);
      } else {
        showToast(result.error || 'حدث خطأ أثناء حذف السداد', 'error');
      }
    } catch (error) {
      console.error('Error deleting payment:', error);
      showToast('حدث خطأ أثناء حذف السداد', 'error');
    } finally {
      setDeletingPayment(false);
    }
  };

  const columns = [
    { key: 'date', label: 'التاريخ' },
    { key: 'totalItems', label: 'إجمالي العناصر' },
    { key: 'totalCost', label: 'إجمالي التكلفة' },
    { key: 'paidAmount', label: 'المسدد' },
    { key: 'remainingAmount', label: 'المتبقي' },
    { key: 'store', label: 'المتجر' },
  ];

  // Calculate stats
  const stats = {
    invoicesCount: invoices.length,
    totalItems: invoices.reduce((sum, inv) => sum + (inv.totalItems || 0), 0),
    totalCost: invoices.reduce((sum, inv) => sum + (inv.totalCost || 0), 0),
    totalRemaining: invoices.reduce((sum, inv) => sum + (inv.remainingAmount || 0), 0),
  };

  const modalFooter = (
    <div className={styles.modalFooter}>
      <Button variant="secondary" onClick={() => setIsInvoiceModalOpen(false)} disabled={addingInvoice}>
        إلغاء
      </Button>
      <Button variant="primary" onClick={handleAddInvoice} loading={addingInvoice}>
        إضافة فاتورة
      </Button>
    </div>
  );

  if (loading) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className={styles.container}>
            <div className={styles.loading}>
              جاري التحميل...
            </div>
          </div>
        </MainLayout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className={styles.container}>
          <PageHeader
            title={source?.sourceName || 'تفاصيل المصدر'}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            showSearch={true}
            customActions={
              <div className={styles.headerActions}>
                {isOwner && (
                  <>
                    <button
                      className={styles.headerActionButton}
                      onClick={handleAddPayment}
                      disabled={addingPayment}
                    >
                      <HiCurrencyDollar size={16} />
                      <span>سداد</span>
                    </button>
                    <button
                      className={styles.headerActionButton}
                      onClick={handlePaymentsReport}
                      disabled={paymentsReportLoading}
                    >
                      <HiDocumentReport size={16} />
                      <span>تقارير السداد</span>
                    </button>
                  </>
                )}
                <button
                  className={styles.headerActionButton}
                  onClick={() => setIsInvoiceModalOpen(true)}
                  disabled={addingInvoice}
                >
                  <HiDocumentText size={16} />
                  <span>+ إضافة فاتورة</span>
                </button>
              </div>
            }
          />

          <div className={styles.cardsGrid}>
            <SummaryCard
              title="عدد الفواتير"
              value={stats.invoicesCount}
              icon={HiDocumentText}
            />
            <SummaryCard
              title="إجمالي العناصر"
              value={stats.totalItems}
              icon={HiCube}
            />
            <SummaryCard
              title="إجمالي التكلفة"
              value={`$${stats.totalCost.toLocaleString()}`}
              icon={HiCurrencyDollar}
            />
            <SummaryCard
              title="المتبقي"
              value={`$${stats.totalRemaining.toLocaleString()}`}
              icon={HiCurrencyDollar}
            />
          </div>

          <h2 className={styles.sectionTitle}>
            الفواتير
          </h2>
          <Table
            columns={columns}
            data={invoices.map((inv) => ({
              id: inv.id,
              date: inv.date?.toDate?.().toLocaleDateString() || new Date(inv.date).toLocaleDateString(),
              totalItems: inv.totalItems || 0,
              totalCost: `$${(inv.totalCost || 0).toLocaleString()}`,
              paidAmount: `$${(inv.paidAmount || 0).toLocaleString()}`,
              remainingAmount: `$${(inv.remainingAmount || 0).toLocaleString()}`,
              store: inv.storeName || 'N/A',
              overpaid: inv.overpaid || false,
            }))}
            actions={['عرض']}
            onAction={(action, row) => {
              if (action === 'عرض') {
                const invoice = invoices.find(inv => inv.id === row.id);
                if (invoice) {
                  handleViewInvoice(invoice);
                }
              }
            }}
            rowClassName={(row) => {
              if (row.overpaid) {
                return styles.overpaidRow;
              }
              return '';
            }}
          />

          <Modal
            isOpen={isInvoiceModalOpen}
            onClose={() => {
              setIsInvoiceModalOpen(false);
              setProductsList([]);
              setCurrentProduct({
                productName: '',
                wholesalePrice: '',
                sellPrice: '',
                finalPrice: '',
                quantity: '',
                category: '',
                storeId: '',
              });
            }}
            title="إضافة فاتورة"
            footer={modalFooter}
            size="large"
          >
            <div className={styles.invoiceFormContainer}>
              <h3 className={styles.formSectionTitle}>إضافة منتج</h3>
              <div className={styles.invoiceFormGrid}>
                <Input
                  label="اسم المنتج"
                  type="text"
                  placeholder="أدخل اسم المنتج"
                  value={currentProduct.productName}
                  onChange={(e) =>
                    setCurrentProduct({ ...currentProduct, productName: e.target.value })
                  }
                />
                <Input
                  label="كود المنتج"
                  type="text"
                  value={productCode}
                  disabled
                />
                <Input
                  label="سعر الجملة"
                  type="number"
                  placeholder="0.00"
                  value={currentProduct.wholesalePrice}
                  onChange={(e) =>
                    setCurrentProduct({ ...currentProduct, wholesalePrice: e.target.value })
                  }
                />
                <Input
                  label="سعر البيع"
                  type="number"
                  placeholder="0.00"
                  value={currentProduct.sellPrice}
                  onChange={(e) =>
                    setCurrentProduct({ ...currentProduct, sellPrice: e.target.value })
                  }
                />
                <Input
                  label="السعر النهائي"
                  type="number"
                  placeholder="0.00"
                  value={currentProduct.finalPrice}
                  onChange={(e) =>
                    setCurrentProduct({ ...currentProduct, finalPrice: e.target.value })
                  }
                />
                <Input
                  label="الكمية"
                  type="number"
                  placeholder="0"
                  value={currentProduct.quantity}
                  onChange={(e) =>
                    setCurrentProduct({ ...currentProduct, quantity: e.target.value })
                  }
                />
                <Select
                  label="الفئة"
                  placeholder="اختر الفئة"
                  value={currentProduct.category}
                  onChange={(e) =>
                    setCurrentProduct({ ...currentProduct, category: e.target.value })
                  }
                  options={categories}
                />
                <Select
                  label="المتجر"
                  placeholder="اختر المتجر"
                  value={currentProduct.storeId}
                  onChange={(e) =>
                    setCurrentProduct({ ...currentProduct, storeId: e.target.value })
                  }
                  options={stores.map(store => ({
                    value: store.id,
                    label: store.storeName || store.name || 'Unnamed Store'
                  }))}
                />
              </div>
              <Button
                variant="secondary"
                onClick={handleAddProductToList}
                className={styles.addProductButton}
              >
                + إضافة منتج إلى القائمة
              </Button>

              {productsList.length > 0 && (
                <div className={styles.productsListSection}>
                  <h3 className={styles.formSectionTitle}>المنتجات المضافة ({productsList.length})</h3>
                  <div className={styles.productsTable}>
                    <table>
                      <thead>
                        <tr>
                          <th>اسم المنتج</th>
                          <th>الفئة</th>
                          <th>الكمية</th>
                          <th>السعر النهائي</th>
                          <th>الإجمالي</th>
                          <th>إجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productsList.map((product, index) => (
                          <tr key={index}>
                            <td>{product.productName}</td>
                            <td>{product.category || '-'}</td>
                            <td>{product.quantity}</td>
                            <td>${parseFloat(product.finalPrice) || 0}</td>
                            <td>${(parseFloat(product.finalPrice) || 0) * (parseInt(product.quantity) || 0)}</td>
                            <td>
                              <button
                                className={styles.deleteButton}
                                onClick={() => handleRemoveProduct(index)}
                              >
                                <HiTrash size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className={styles.paymentSection}>
                    <h3 className={styles.formSectionTitle}>معلومات السداد</h3>
                    <div className={styles.invoiceFormGrid}>
                      <Input
                        label="إجمالي الفاتورة"
                        type="text"
                        value={`$${productsList.reduce((sum, p) => sum + ((parseFloat(p.finalPrice) || 0) * (parseInt(p.quantity) || 0)), 0).toLocaleString()}`}
                        disabled
                      />
                      <Input
                        label="المسدد"
                        type="number"
                        placeholder="0.00"
                        value={paymentAmount}
                        onChange={(e) => {
                          setPaymentAmount(e.target.value);
                        }}
                      />
                      <Input
                        label="المتبقي"
                        type="text"
                        value={`$${(productsList.reduce((sum, p) => sum + ((parseFloat(p.finalPrice) || 0) * (parseInt(p.quantity) || 0)), 0) - (parseFloat(paymentAmount) || 0)).toLocaleString()}`}
                        disabled
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Modal>

          <Modal
            isOpen={isViewInvoiceModalOpen}
            onClose={() => {
              setIsViewInvoiceModalOpen(false);
              setSelectedInvoice(null);
            }}
            title="تفاصيل الفاتورة"
            size="large"
            footer={
              selectedInvoice && !selectedInvoice.returned ? (
                <div className={styles.modalFooter}>
                  <Button variant="secondary" onClick={() => {
                    setIsViewInvoiceModalOpen(false);
                    setSelectedInvoice(null);
                  }}>
                    إغلاق
                  </Button>
                  <Button variant="primary" onClick={handleReturnInvoice} loading={returningInvoice}>
                    مرتجع فاتورة كاملة
                  </Button>
                </div>
              ) : (
                <div className={styles.modalFooter}>
                  <Button variant="secondary" onClick={() => {
                    setIsViewInvoiceModalOpen(false);
                    setSelectedInvoice(null);
                  }}>
                    إغلاق
                  </Button>
                </div>
              )
            }
          >
            {selectedInvoice && (
              <div className={styles.invoiceDetails}>
                {selectedInvoice.returned && (
                  <div className={styles.returnedBadge}>
                    تم عمل مرتجع لهذه الفاتورة
                  </div>
                )}
                {selectedInvoice.overpaid && (
                  <div className={styles.overpaidBadge}>
                    تم سداد مبلغ أكثر من إجمالي الفاتورة - يوجد رصيد للمصدر
                  </div>
                )}
                <div className={styles.invoiceInfo}>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>التاريخ:</span>
                    <span className={styles.infoValue}>
                      {selectedInvoice.date?.toDate?.().toLocaleDateString() || new Date(selectedInvoice.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>المتجر:</span>
                    <span className={styles.infoValue}>
                      {selectedInvoice.storeName || 'N/A'}
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>إجمالي العناصر:</span>
                    <span className={styles.infoValue}>
                      {selectedInvoice.totalItems || 0}
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>إجمالي التكلفة:</span>
                    <span className={styles.infoValue}>
                      ${selectedInvoice.totalCost || 0}
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>المسدد:</span>
                    <span className={styles.infoValue}>
                      ${(selectedInvoice.paidAmount || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>المتبقي:</span>
                    <span className={`${styles.infoValue} ${selectedInvoice.overpaid ? styles.overpaidAmount : ''}`}>
                      ${(selectedInvoice.remainingAmount || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
                
                <h3 className={styles.productsTitle}>المنتجات</h3>
                <div className={styles.productsTable}>
                  <table>
                    <thead>
                      <tr>
                        <th>كود المنتج</th>
                        <th>اسم المنتج</th>
                        <th>الفئة</th>
                        <th>الكمية</th>
                        <th>سعر الجملة</th>
                        <th>سعر البيع</th>
                        <th>السعر النهائي</th>
                        <th>الإجمالي</th>
                        {!selectedInvoice.returned && <th>إجراءات</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.products && selectedInvoice.products.length > 0 ? (
                        selectedInvoice.products.map((product, index) => (
                          <tr key={index}>
                            <td>{product.code || '-'}</td>
                            <td>{product.name || '-'}</td>
                            <td>{product.category || '-'}</td>
                            <td>{product.quantity || 0}</td>
                            <td>${product.wholesalePrice || 0}</td>
                            <td>${product.sellPrice || 0}</td>
                            <td>${product.finalPrice || 0}</td>
                            <td>${(product.finalPrice || 0) * (product.quantity || 0)}</td>
                            {!selectedInvoice.returned && (
                              <td>
                                <button
                                  className={styles.returnButton}
                                  onClick={() => handleReturnProduct(index)}
                                  disabled={returningInvoice}
                                >
                                  {returningInvoice ? 'جاري...' : 'مرتجع'}
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={selectedInvoice.returned ? "8" : "9"} style={{ textAlign: 'center', padding: '20px' }}>
                            لا توجد منتجات
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Modal>

          <Modal
            isOpen={isPaymentModalOpen}
            onClose={() => {
              setIsPaymentModalOpen(false);
              setPaymentAmount('');
              setPaymentError('');
              setSelectedCashRegisterId('');
            }}
            title="إضافة سداد"
            footer={
              <div className={styles.modalFooter}>
                <Button variant="secondary" onClick={() => {
                  setIsPaymentModalOpen(false);
                  setPaymentAmount('');
                  setPaymentError('');
                }}>
                  إلغاء
                </Button>
                <Button variant="primary" onClick={confirmPayment} loading={addingPayment}>
                  تأكيد السداد
                </Button>
              </div>
            }
          >
            <div className={styles.paymentModalContent}>
              <div className={styles.paymentInfo}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>إجمالي المتبقي على المصدر:</span>
                  <span className={styles.infoValue}>
                    ${stats.totalRemaining.toLocaleString()}
                  </span>
                </div>
              </div>
              <Input
                label="مبلغ السداد"
                type="number"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => {
                  setPaymentAmount(e.target.value);
                  setPaymentError('');
                }}
                error={paymentError}
              />
              <Select
                label="السداد من العهدة"
                placeholder="اختر العهدة"
                value={selectedCashRegisterId}
                onChange={(e) => setSelectedCashRegisterId(e.target.value)}
                options={cashRegisters.map((cr) => ({
                  value: cr.id,
                  label: `${getRegisterName(cr)} (الرصيد: ${(cr.balance || 0).toFixed(2)})`,
                }))}
              />
            </div>
          </Modal>

          <Modal
            isOpen={isReturnModalOpen}
            onClose={() => {
              setIsReturnModalOpen(false);
              setReturnError('');
            }}
            title={returnType === 'full' ? 'تأكيد مرتجع الفاتورة' : 'تأكيد مرتجع المنتج'}
            footer={
              <div className={styles.modalFooter}>
                <Button variant="secondary" onClick={() => {
                  setIsReturnModalOpen(false);
                  setReturnError('');
                }}>
                  إلغاء
                </Button>
                <Button variant="primary" onClick={confirmReturn} loading={returningInvoice}>
                  تأكيد المرتجع
                </Button>
              </div>
            }
          >
            <div className={styles.returnModalContent}>
              {returnType === 'full' ? (
                <>
                  <p>هل أنت متأكد من عمل مرتجع للفاتورة كاملة؟</p>
                  <p className={styles.returnWarning}>
                    سيتم حذف جميع المنتجات من الفاتورة من المخزن.
                  </p>
                </>
              ) : (
                <>
                  <p>هل أنت متأكد من عمل مرتجع للمنتج التالي؟</p>
                  {selectedInvoice && selectedInvoice.products && selectedProductIndex !== null && (
                    <div className={styles.returnProductInfo}>
                      <p><strong>اسم المنتج:</strong> {selectedInvoice.products[selectedProductIndex]?.name}</p>
                      <p><strong>الكمية:</strong> {selectedInvoice.products[selectedProductIndex]?.quantity}</p>
                    </div>
                  )}
                  <p className={styles.returnWarning}>
                    سيتم حذف هذا المنتج من المخزن.
                  </p>
                </>
              )}
            </div>
            {returnError && (
              <div className={styles.returnError}>
                {returnError}
              </div>
            )}
          </Modal>

          <Modal
            isOpen={isPaymentsReportModalOpen}
            onClose={() => {
              setIsPaymentsReportModalOpen(false);
              setPaymentsReport([]);
            }}
            title="تقارير السداد"
            size="large"
          >
            {paymentsReportLoading ? (
              <div className={styles.loading}>
                جاري التحميل...
              </div>
            ) : (
              <div className={styles.paymentsReportContainer}>
                {paymentsReport.length > 0 ? (
                  <Table
                    columns={[
                      { key: 'date', label: 'التاريخ' },
                      { key: 'amount', label: 'المبلغ' },
                    ]}
                    data={paymentsReport.map((payment) => ({
                      id: payment.id,
                      date: payment.date?.toLocaleDateString() || new Date(payment.date).toLocaleDateString(),
                      amount: `$${(payment.amount || 0).toLocaleString()}`,
                    }))}
                    actions={['تعديل', 'حذف']}
                    onAction={(action, row) => {
                      const payment = paymentsReport.find(p => p.id === row.id);
                      if (payment) {
                        if (action === 'تعديل') {
                          handleEditPayment(payment);
                        } else if (action === 'حذف') {
                          handleDeletePayment(payment);
                        }
                      }
                    }}
                  />
                ) : (
                  <div className={styles.emptyReport}>
                    لا توجد عمليات سداد
                  </div>
                )}
              </div>
            )}
          </Modal>

          <Modal
            isOpen={isEditPaymentModalOpen}
            onClose={() => {
              setIsEditPaymentModalOpen(false);
              setEditingPayment(null);
              setPaymentAmount('');
              setPaymentError('');
            }}
            title="تعديل السداد"
            footer={
              <div className={styles.modalFooter}>
                <Button variant="secondary" onClick={() => {
                  setIsEditPaymentModalOpen(false);
                  setEditingPayment(null);
                  setPaymentAmount('');
                  setPaymentError('');
                }}>
                  إلغاء
                </Button>
                <Button variant="primary" onClick={confirmUpdatePayment} loading={updatingPayment}>
                  تأكيد التعديل
                </Button>
              </div>
            }
          >
            <div className={styles.paymentModalContent}>
              {editingPayment && (
                <div className={styles.paymentInfo}>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>المبلغ الحالي:</span>
                    <span className={styles.infoValue}>
                      ${(editingPayment.amount || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
              <Input
                label="المبلغ الجديد"
                type="number"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => {
                  setPaymentAmount(e.target.value);
                  setPaymentError('');
                }}
                error={paymentError}
              />
            </div>
          </Modal>

          <Modal
            isOpen={isDeletePaymentModalOpen}
            onClose={() => {
              setIsDeletePaymentModalOpen(false);
              setPaymentToDelete(null);
            }}
            title="تأكيد حذف السداد"
            footer={
              <div className={styles.modalFooter}>
                <Button variant="secondary" onClick={() => {
                  setIsDeletePaymentModalOpen(false);
                  setPaymentToDelete(null);
                }}>
                  إلغاء
                </Button>
                <Button variant="primary" onClick={confirmDeletePayment} loading={deletingPayment}>
                  تأكيد الحذف
                </Button>
              </div>
            }
          >
            <div className={styles.returnModalContent}>
              {paymentToDelete && (
                <>
                  <p>هل أنت متأكد من حذف هذا السداد؟</p>
                  <div className={styles.paymentInfo}>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>التاريخ:</span>
                      <span className={styles.infoValue}>
                        {paymentToDelete.date?.toLocaleDateString() || new Date(paymentToDelete.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>المبلغ:</span>
                      <span className={styles.infoValue}>
                        ${(paymentToDelete.amount || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <p className={styles.returnWarning}>
                    سيتم إعادة المبلغ للفواتير وتحديث المتبقي.
                  </p>
                </>
              )}
            </div>
          </Modal>
        </div>
      </MainLayout>
    </AuthGuard>
  );
}

