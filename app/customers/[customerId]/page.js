'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import AuthGuard from '../../../components/auth/AuthGuard';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/layout/PageHeader';
import Table from '../../../components/ui/Table';
import Modal from '../../../components/ui/Modal';
import Card from '../../../components/ui/Card';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import CustomerInvoiceForm from '../../../components/customers/CustomerInvoiceForm';
import { 
  subscribeToCustomer,
  subscribeToCustomerInvoices,
  subscribeToCustomerPayments,
  subscribeToCashRegisters,
  addCustomerInvoice,
  updateCustomerInvoice,
  getStores, 
  getProducts,
  addCustomerPayment,
  getCustomerPayments,
  updateCustomerPayment,
  deleteCustomerPayment,
  returnCustomerInvoice,
  returnCustomerInvoiceProduct,
  getUsersByOwner
} from '../../../lib/firebase/firestore';
import { getUserFromLocalStorage } from '../../../lib/auth';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { HiCurrencyDollar, HiDocumentText } from 'react-icons/hi';
import styles from './page.module.css';

export default function CustomerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = params.customerId;
  const { user, userData } = useAuth();
  const { showSuccess, showError } = useToast();
  const [customer, setCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isEditInvoiceModalOpen, setIsEditInvoiceModalOpen] = useState(false);
  const [isViewInvoiceModalOpen, setIsViewInvoiceModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [returnType, setReturnType] = useState('full');
  const [selectedProductIndex, setSelectedProductIndex] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [selectedCashRegisterId, setSelectedCashRegisterId] = useState('');
  const [cashRegisters, setCashRegisters] = useState([]);
  const [users, setUsers] = useState([]);
  const [returnError, setReturnError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [addingInvoice, setAddingInvoice] = useState(false);
  const [updatingInvoice, setUpdatingInvoice] = useState(false);
  const [addingPayment, setAddingPayment] = useState(false);
  const [returningInvoice, setReturningInvoice] = useState(false);
  const [payments, setPayments] = useState([]);
  const [isPaymentsReportModalOpen, setIsPaymentsReportModalOpen] = useState(false);
  const [isEditPaymentModalOpen, setIsEditPaymentModalOpen] = useState(false);
  const [isDeletePaymentModalOpen, setIsDeletePaymentModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [paymentToDelete, setPaymentToDelete] = useState(null);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [editPaymentAmount, setEditPaymentAmount] = useState('');
  const [editPaymentError, setEditPaymentError] = useState('');

  const localUserData = getUserFromLocalStorage();
  const userRole = localUserData?.role || userData?.role || 'user';
  const isOwner = userRole === 'owner';

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

  useEffect(() => {
    if (!customerId) return;

    setLoading(true);
    loadStores();

    // Subscribe to customer data
    const unsubscribeCustomer = subscribeToCustomer(customerId, (customerData) => {
      setCustomer(customerData);
      if (customerData) {
        setLoading(false);
      }
    });

    // Subscribe to customer invoices
    const unsubscribeInvoices = subscribeToCustomerInvoices(customerId, (invoicesData) => {
      setInvoices(invoicesData);
      setLoading(false);
    });

    // Subscribe to customer payments
    const unsubscribePayments = subscribeToCustomerPayments(customerId, (paymentsData) => {
      setPayments(paymentsData);
    });

    return () => {
      unsubscribeCustomer();
      unsubscribeInvoices();
      unsubscribePayments();
    };
  }, [customerId]);

  // Check for invoiceId in query params and open invoice modal
  useEffect(() => {
    const invoiceId = searchParams.get('invoiceId');
    if (invoiceId && invoices.length > 0) {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (invoice) {
        setSelectedInvoice(invoice);
        setIsViewInvoiceModalOpen(true);
        // Remove query param from URL
        router.replace(`/customers/${customerId}`, { scroll: false });
      }
    }
  }, [searchParams, invoices, customerId, router]);

  const loadStores = async () => {
    try {
      const storesData = await getStores();
      setStores(storesData);
      
      // Load products for all stores
      const allProducts = await getProducts();
      setProducts(allProducts);
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setIsViewInvoiceModalOpen(true);
  };

  const handleAddInvoice = async (invoiceData) => {
    setAddingInvoice(true);
    try {
      const result = await addCustomerInvoice({
        ...invoiceData,
        customerId,
      });
      
      if (result.success) {
        setIsInvoiceModalOpen(false);
        showSuccess('تم إضافة الفاتورة بنجاح');
      } else {
        showError(result.error || 'فشل في إضافة الفاتورة');
      }
    } catch (error) {
      console.error('Error adding invoice:', error);
      showError('حدث خطأ أثناء إضافة الفاتورة');
    } finally {
      setAddingInvoice(false);
    }
  };

  const handleEditInvoice = (invoice) => {
    setEditingInvoice(invoice);
    setIsEditInvoiceModalOpen(true);
  };

  const handleUpdateInvoice = async (invoiceData) => {
    if (!editingInvoice) return;
    
    setUpdatingInvoice(true);
    try {
      const result = await updateCustomerInvoice(editingInvoice.id, {
        ...invoiceData,
        customerId,
      });
      
      if (result.success) {
        setIsEditInvoiceModalOpen(false);
        setEditingInvoice(null);
        showSuccess('تم تحديث الفاتورة بنجاح');
      } else {
        showError(result.error || 'فشل في تحديث الفاتورة');
      }
    } catch (error) {
      console.error('Error updating invoice:', error);
      showError('حدث خطأ أثناء تحديث الفاتورة');
    } finally {
      setUpdatingInvoice(false);
    }
  };

  const handlePaymentClick = () => {
    setPaymentAmount('');
    setPaymentError('');
    setSelectedCashRegisterId('');
    setIsPaymentModalOpen(true);
  };

  const handleAddPayment = async () => {
    if (!paymentAmount.trim()) {
      setPaymentError('يجب إدخال مبلغ السداد');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setPaymentError('المبلغ يجب أن يكون رقماً موجباً');
      return;
    }

    // Check if payment amount exceeds total remaining
    const totalRemaining = invoices
      .filter(inv => inv.status !== 'returned')
      .reduce((sum, inv) => sum + (inv.remainingAmount || 0), 0);
    
    if (amount > totalRemaining) {
      setPaymentError(`المبلغ أكبر من المتبقي الإجمالي (${totalRemaining.toFixed(2)})`);
      return;
    }

    setPaymentError('');
    setAddingPayment(true);
    try {
      if (!selectedCashRegisterId) {
        setPaymentError('يرجى اختيار العهدة');
        setAddingPayment(false);
        return;
      }

      const result = await addCustomerPayment(customerId, amount, selectedCashRegisterId);
      if (result.success) {
        setIsPaymentModalOpen(false);
        setPaymentAmount('');
        setSelectedCashRegisterId('');
        showSuccess('تم إضافة السداد بنجاح');
      } else {
        setPaymentError(result.error || 'فشل في إضافة السداد');
      }
    } catch (error) {
      console.error('Error adding payment:', error);
      setPaymentError('حدث خطأ أثناء إضافة السداد');
    } finally {
      setAddingPayment(false);
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

    setReturnError('');
    setReturningInvoice(true);
    try {
      let result;
      if (returnType === 'full') {
        result = await returnCustomerInvoice(selectedInvoice.id);
      } else {
        result = await returnCustomerInvoiceProduct(selectedInvoice.id, selectedProductIndex);
      }

      if (result.success) {
        setIsReturnModalOpen(false);
        
        // إذا تم حذف الفاتورة، أغلق modal العرض
        if (result.deleted) {
          setIsViewInvoiceModalOpen(false);
          setSelectedInvoice(null);
        } else {
          // تحديث selectedInvoice بالبيانات الجديدة من invoices state
          const updatedInvoice = invoices.find(inv => inv.id === selectedInvoice.id);
          if (updatedInvoice) {
            setSelectedInvoice(updatedInvoice);
          } else {
            // إذا لم تعد موجودة (تم حذفها)، أغلق modal
            setIsViewInvoiceModalOpen(false);
            setSelectedInvoice(null);
          }
        }
        
        showSuccess('تم إجراء المرتجع بنجاح');
      } else {
        setReturnError(result.error || 'فشل في إجراء المرتجع');
      }
    } catch (error) {
      console.error('Error returning invoice:', error);
      setReturnError('حدث خطأ أثناء إجراء المرتجع');
    } finally {
      setReturningInvoice(false);
    }
  };

  // Filter invoices based on search query
  const filteredInvoices = invoices.filter((invoice) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      invoice.id.toLowerCase().includes(searchLower) ||
      (invoice.products && invoice.products.some(p => 
        (p.name || '').toLowerCase().includes(searchLower)
      ))
    );
  });

  // Prepare table data
  const tableData = filteredInvoices.map((invoice) => ({
    id: invoice.id,
    date: invoice.date ? new Date(invoice.date).toLocaleDateString('ar-EG') : '-',
    totalItems: invoice.totalItems || 0,
    totalCost: (invoice.totalCost || 0).toFixed(2),
    paidAmount: (invoice.paidAmount || 0).toFixed(2),
    remainingAmount: (invoice.remainingAmount || 0).toFixed(2),
    status: invoice.status === 'pending' ? 'معلقة' : invoice.status === 'returned' ? 'مرتجعة' : 'نشطة',
    originalInvoice: invoice,
  }));

  const columns = [
    { key: 'date', label: 'التاريخ' },
    { key: 'totalItems', label: 'عدد القطع' },
    { key: 'totalCost', label: 'الإجمالي' },
    { key: 'paidAmount', label: 'المدفوع' },
    { key: 'remainingAmount', label: 'المتبقي' },
    { key: 'status', label: 'الحالة' },
  ];

  const handleAction = (action, row) => {
    if (action === 'عرض') {
      handleViewInvoice(row.originalInvoice);
    } else if (action === 'تعديل') {
      handleEditInvoice(row.originalInvoice);
    }
  };

  // Calculate customer statistics
  const totalRemaining = invoices
    .filter(inv => inv.status !== 'returned')
    .reduce((sum, inv) => sum + (inv.remainingAmount || 0), 0);
  const totalInvoices = invoices.length;
  const activeInvoices = invoices.filter(inv => inv.status === 'active').length;
  const pendingInvoices = invoices.filter(inv => inv.status === 'pending').length;

  // Payment report handlers
  const handlePaymentsReport = () => {
    setIsPaymentsReportModalOpen(true);
  };

  const handleEditPayment = (payment) => {
    setEditingPayment(payment);
    setEditPaymentAmount(payment.amount.toString());
    setEditPaymentError('');
    setIsEditPaymentModalOpen(true);
  };

  const handleDeletePayment = (payment) => {
    setPaymentToDelete(payment);
    setIsDeletePaymentModalOpen(true);
  };

  const confirmEditPayment = async () => {
    if (!editingPayment) return;

    if (!editPaymentAmount.trim()) {
      setEditPaymentError('يجب إدخال مبلغ السداد');
      return;
    }

    const amount = parseFloat(editPaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setEditPaymentError('المبلغ يجب أن يكون رقماً موجباً');
      return;
    }

    setEditPaymentError('');
    setUpdatingPayment(true);
    try {
      const result = await updateCustomerPayment(editingPayment.id, amount);
      if (result.success) {
        setIsEditPaymentModalOpen(false);
        setEditingPayment(null);
        setEditPaymentAmount('');
        showSuccess('تم تحديث السداد بنجاح');
      } else {
        setEditPaymentError(result.error || 'فشل في تحديث السداد');
      }
    } catch (error) {
      console.error('Error updating payment:', error);
      setEditPaymentError('حدث خطأ أثناء تحديث السداد');
    } finally {
      setUpdatingPayment(false);
    }
  };

  const confirmDeletePayment = async () => {
    if (!paymentToDelete) return;

    setDeletingPayment(true);
    try {
      const result = await deleteCustomerPayment(paymentToDelete.id);
      if (result.success) {
        setIsDeletePaymentModalOpen(false);
        setPaymentToDelete(null);
        showSuccess('تم حذف السداد بنجاح');
      } else {
        showError(result.error || 'فشل في حذف السداد');
      }
    } catch (error) {
      console.error('Error deleting payment:', error);
      showError('حدث خطأ أثناء حذف السداد');
    } finally {
      setDeletingPayment(false);
    }
  };

  // Prepare payments table data
  const paymentsTableData = payments.map((payment) => ({
    id: payment.id,
    date: payment.date ? new Date(payment.date).toLocaleDateString('ar-EG') : '-',
    amount: (payment.amount || 0).toFixed(2),
    originalPayment: payment,
  }));

  const paymentsColumns = [
    { key: 'date', label: 'التاريخ' },
    { key: 'amount', label: 'المبلغ' },
  ];

  if (loading) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className={styles.loading}>جاري التحميل...</div>
        </MainLayout>
      </AuthGuard>
    );
  }

  if (!customer) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className={styles.error}>العميل غير موجود</div>
        </MainLayout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className={styles.container}>
          <PageHeader
            title={`العميل: ${customer.name}`}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            showSearch={invoices.length > 0}
            customActions={
              <div className={styles.headerActions}>
                {isOwner && (
                  <>
                    <button
                      onClick={handlePaymentsReport}
                      className={styles.tableActionButton}
                    >
                      تقارير السداد
                    </button>
                    <button
                      onClick={handlePaymentClick}
                      className={styles.tableActionButton}
                    >
                      سداد
                    </button>
                  </>
                )}
                <button
                  onClick={() => setIsInvoiceModalOpen(true)}
                  className={styles.tableActionButton}
                  disabled={addingInvoice}
                >
                  {addingInvoice ? 'جاري الإضافة...' : '+ إضافة فاتورة'}
                </button>
              </div>
            }
          />

          <div className={styles.statsGrid}>
            <Card className={styles.statCard}>
              <div className={styles.statLabel}>إجمالي الفواتير</div>
              <div className={styles.statValue}>{totalInvoices}</div>
            </Card>
            <Card className={styles.statCard}>
              <div className={styles.statLabel}>فواتير نشطة</div>
              <div className={styles.statValue}>{activeInvoices}</div>
            </Card>
            <Card className={styles.statCard}>
              <div className={styles.statLabel}>فواتير معلقة</div>
              <div className={styles.statValue}>{pendingInvoices}</div>
            </Card>
            <Card className={styles.statCard}>
              <div className={styles.statLabel}>المتبقي</div>
              <div className={styles.statValue}>{totalRemaining.toFixed(2)}</div>
            </Card>
          </div>

          {invoices.length === 0 ? (
            <div className={styles.emptyState}>
              <p>لا توجد فواتير لهذا العميل</p>
            </div>
          ) : (
            <Table
              columns={columns}
              data={tableData}
              actions={['عرض', 'تعديل']}
              onAction={handleAction}
              rowClassName={(row) => {
                if (row.originalInvoice.status === 'pending') return styles.pendingRow;
                if (row.originalInvoice.status === 'returned') return styles.returnedRow;
                return '';
              }}
            />
          )}

          {/* Add Invoice Modal */}
          <Modal
            isOpen={isInvoiceModalOpen}
            onClose={() => setIsInvoiceModalOpen(false)}
            title="إضافة فاتورة للعميل"
            footer={null}
          >
            <CustomerInvoiceForm
              customer={customer}
              stores={stores}
              products={products}
              onSave={handleAddInvoice}
              onCancel={() => setIsInvoiceModalOpen(false)}
              loading={addingInvoice}
            />
          </Modal>

          {/* Edit Invoice Modal */}
          <Modal
            isOpen={isEditInvoiceModalOpen}
            onClose={() => {
              setIsEditInvoiceModalOpen(false);
              setEditingInvoice(null);
            }}
            title="تعديل فاتورة العميل"
            footer={null}
          >
            {editingInvoice && (
              <CustomerInvoiceForm
                customer={customer}
                stores={stores}
                products={products}
                invoice={editingInvoice}
                onSave={handleUpdateInvoice}
                onCancel={() => {
                  setIsEditInvoiceModalOpen(false);
                  setEditingInvoice(null);
                }}
                loading={updatingInvoice}
              />
            )}
          </Modal>

          {/* View Invoice Modal */}
          <Modal
            isOpen={isViewInvoiceModalOpen}
            onClose={() => {
              setIsViewInvoiceModalOpen(false);
              setSelectedInvoice(null);
            }}
            title="تفاصيل الفاتورة"
            footer={
              selectedInvoice && selectedInvoice.status !== 'returned' ? (
                <div className={styles.modalFooter}>
                  <Button
                    variant="danger"
                    onClick={handleReturnInvoice}
                    loading={returningInvoice}
                  >
                    مرتجع كامل
                  </Button>
                </div>
              ) : null
            }
          >
            {selectedInvoice && (
              <div className={styles.invoiceDetails}>
                <div className={styles.invoiceInfo}>
                  <div className={styles.infoRow}>
                    <span>التاريخ:</span>
                    <span>{selectedInvoice.date ? new Date(selectedInvoice.date).toLocaleDateString('ar-EG') : '-'}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span>الحالة:</span>
                    <span className={
                      selectedInvoice.status === 'pending' ? styles.pendingStatus :
                      selectedInvoice.status === 'returned' ? styles.returnedStatus :
                      styles.activeStatus
                    }>
                      {selectedInvoice.status === 'pending' ? 'معلقة' : 
                       selectedInvoice.status === 'returned' ? 'مرتجعة' : 'نشطة'}
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <span>إجمالي القطع:</span>
                    <span>{selectedInvoice.totalItems || 0}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span>إجمالي الفاتورة:</span>
                    <span>{(selectedInvoice.totalCost || 0).toFixed(2)}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span>المدفوع:</span>
                    <span>{(selectedInvoice.paidAmount || 0).toFixed(2)}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span>المتبقي:</span>
                    <span>{(selectedInvoice.remainingAmount || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className={styles.productsList}>
                  <h3>المنتجات</h3>
                  <div className={styles.productsTable}>
                    <div className={styles.productsHeader}>
                      <span>المنتج</span>
                      <span>الكمية</span>
                      <span>السعر</span>
                      <span>الإجمالي</span>
                      {selectedInvoice.status !== 'returned' && <span>الإجراءات</span>}
                    </div>
                    {selectedInvoice.products?.map((product, index) => {
                      const productTotal = (product.finalPrice || 0) * (product.quantity || 0);
                      return (
                        <div key={index} className={styles.productRow}>
                          <span>{product.name}</span>
                          <span>{product.quantity}</span>
                          <span>{product.finalPrice}</span>
                          <span>{productTotal.toFixed(2)}</span>
                          {selectedInvoice.status !== 'returned' && (
                            <button
                              onClick={() => handleReturnProduct(index)}
                              className={styles.returnButton}
                            >
                              مرتجع
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </Modal>

          {/* Payment Modal */}
          <Modal
            isOpen={isPaymentModalOpen}
            onClose={() => {
              setIsPaymentModalOpen(false);
              setPaymentAmount('');
              setPaymentError('');
              setSelectedCashRegisterId('');
            }}
            title="سداد للعميل"
            footer={
              <div className={styles.modalFooter}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsPaymentModalOpen(false);
                    setPaymentAmount('');
                    setPaymentError('');
                  }}
                >
                  إلغاء
                </Button>
                <Button
                  variant="primary"
                  onClick={handleAddPayment}
                  loading={addingPayment}
                >
                  إضافة سداد
                </Button>
              </div>
            }
          >
            <div>
              <div className={styles.paymentInfo}>
                <p><strong>إجمالي المتبقي:</strong> {totalRemaining.toFixed(2)}</p>
              </div>
              <Input
                label="مبلغ السداد"
                type="number"
                placeholder="أدخل مبلغ السداد"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                icon={HiCurrencyDollar}
                min="0"
                step="0.01"
                max={totalRemaining}
                required
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
              {paymentError && (
                <div className={styles.errorMessage}>
                  {paymentError}
                </div>
              )}
            </div>
          </Modal>

          {/* Payments Report Modal */}
          <Modal
            isOpen={isPaymentsReportModalOpen}
            onClose={() => setIsPaymentsReportModalOpen(false)}
            title="تقارير السداد"
            footer={null}
          >
            {payments.length === 0 ? (
              <div className={styles.emptyState}>
                <p>لا توجد سداد مسجلة</p>
              </div>
            ) : (
              <Table
                columns={paymentsColumns}
                data={paymentsTableData}
                actions={isOwner ? ['تعديل', 'حذف'] : []}
                onAction={(action, row) => {
                  if (action === 'تعديل') {
                    handleEditPayment(row.originalPayment);
                  } else if (action === 'حذف') {
                    handleDeletePayment(row.originalPayment);
                  }
                }}
              />
            )}
          </Modal>

          {/* Edit Payment Modal */}
          <Modal
            isOpen={isEditPaymentModalOpen}
            onClose={() => {
              setIsEditPaymentModalOpen(false);
              setEditingPayment(null);
              setEditPaymentAmount('');
              setEditPaymentError('');
            }}
            title="تعديل السداد"
            footer={
              <div className={styles.modalFooter}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsEditPaymentModalOpen(false);
                    setEditingPayment(null);
                    setEditPaymentAmount('');
                    setEditPaymentError('');
                  }}
                >
                  إلغاء
                </Button>
                <Button
                  variant="primary"
                  onClick={confirmEditPayment}
                  loading={updatingPayment}
                >
                  تحديث السداد
                </Button>
              </div>
            }
          >
            <div>
              <Input
                label="مبلغ السداد"
                type="number"
                placeholder="أدخل مبلغ السداد"
                value={editPaymentAmount}
                onChange={(e) => setEditPaymentAmount(e.target.value)}
                icon={HiCurrencyDollar}
                min="0"
                step="0.01"
                required
              />
              {editPaymentError && (
                <div className={styles.errorMessage}>
                  {editPaymentError}
                </div>
              )}
            </div>
          </Modal>

          {/* Delete Payment Modal */}
          <Modal
            isOpen={isDeletePaymentModalOpen}
            onClose={() => {
              setIsDeletePaymentModalOpen(false);
              setPaymentToDelete(null);
            }}
            title="تأكيد الحذف"
            footer={
              <div className={styles.modalFooter}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsDeletePaymentModalOpen(false);
                    setPaymentToDelete(null);
                  }}
                >
                  إلغاء
                </Button>
                <Button
                  variant="danger"
                  onClick={confirmDeletePayment}
                  loading={deletingPayment}
                >
                  حذف السداد
                </Button>
              </div>
            }
          >
            <div>
              {paymentToDelete && (
                <p>هل أنت متأكد من حذف السداد بقيمة {paymentToDelete.amount.toFixed(2)}؟</p>
              )}
            </div>
          </Modal>

          {/* Return Modal */}
          <Modal
            isOpen={isReturnModalOpen}
            onClose={() => {
              setIsReturnModalOpen(false);
              setReturnError('');
            }}
            title={returnType === 'full' ? 'تأكيد المرتجع الكامل' : 'تأكيد المرتجع الجزئي'}
            footer={
              <div className={styles.modalFooter}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsReturnModalOpen(false);
                    setReturnError('');
                  }}
                >
                  إلغاء
                </Button>
                <Button
                  variant="danger"
                  onClick={confirmReturn}
                  loading={returningInvoice}
                >
                  تأكيد المرتجع
                </Button>
              </div>
            }
          >
            <div>
              {returnType === 'full' ? (
                <p>هل أنت متأكد من إرجاع الفاتورة بالكامل؟ سيتم إرجاع جميع المنتجات للمخزن.</p>
              ) : (
                <p>هل أنت متأكد من إرجاع هذا المنتج؟ سيتم إرجاعه للمخزن.</p>
              )}
              {returnError && (
                <div className={styles.errorMessage}>
                  {returnError}
                </div>
              )}
            </div>
          </Modal>
        </div>
      </MainLayout>
    </AuthGuard>
  );
}

