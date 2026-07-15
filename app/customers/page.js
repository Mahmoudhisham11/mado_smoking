'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '../../components/auth/AuthGuard';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { subscribeToCustomers, addCustomer, updateCustomer, deleteCustomer } from '../../lib/firebase/firestore';
import { getUserFromLocalStorage } from '../../lib/auth';
import { HiUserGroup, HiPencil, HiTrash, HiDocumentReport } from 'react-icons/hi';
import styles from './page.module.css';

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', creditLimit: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const userData = getUserFromLocalStorage();
  const userRole = userData?.role || 'user';
  const isOwner = userRole === 'owner';

  useEffect(() => {
    const unsubscribe = subscribeToCustomers((data) => {
      setCustomers(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q);
  });

  const openAddModal = () => {
    if (!isOwner) return;
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', creditLimit: '' });
    setFormError('');
    setIsFormModalOpen(true);
  };

  const openEditModal = (customer) => {
    if (!isOwner) return;
    setEditingCustomer(customer);
    setFormData({ name: customer.name || '', phone: customer.phone || '', creditLimit: customer.creditLimit ? String(customer.creditLimit) : '' });
    setFormError('');
    setIsFormModalOpen(true);
  };

  const closeFormModal = () => {
    setIsFormModalOpen(false);
    setEditingCustomer(null);
    setFormError('');
  };

  const handleNameChange = (e) => {
    setFormData((prev) => ({ ...prev, name: e.target.value }));
  };

  const handlePhoneChange = (e) => {
    setFormData((prev) => ({ ...prev, phone: e.target.value }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setFormError('يرجى إدخال اسم العميل');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      if (editingCustomer) {
        const result = await updateCustomer(editingCustomer.id, formData);
        if (!result.success) {
          setFormError(result.error || 'فشل في تعديل العميل');
          setSaving(false);
          return;
        }
      } else {
        const result = await addCustomer(formData);
        if (!result.success) {
          setFormError(result.error || 'فشل في إضافة العميل');
          setSaving(false);
          return;
        }
      }
      closeFormModal();
    } catch (err) {
      setFormError('حدث خطأ. يرجى المحاولة مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (customer) => {
    if (!isOwner) return;
    setCustomerToDelete(customer);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return;
    setDeleteLoading(true);
    try {
      const result = await deleteCustomer(customerToDelete.id);
      if (!result.success) {
        setDeleteLoading(false);
        return;
      }
      setIsDeleteModalOpen(false);
      setCustomerToDelete(null);
    } catch (err) {
      console.error('Error deleting customer:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const goToCustomerReports = (customerId) => {
    router.push(`/customers/${customerId}`);
  };

  return (
    <AuthGuard>
      <MainLayout>
        <div className={styles.container}>
          <PageHeader
            title="العملاء"
            action={isOwner ? "addCustomer" : null}
            actionLabel={isOwner ? "+ إضافة عميل" : null}
            onAction={isOwner ? openAddModal : null}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            showSearch={customers.length > 0}
          />

          {loading ? (
            <div className={styles.loading}>جاري التحميل...</div>
          ) : customers.length === 0 ? (
            <Card>
              <div className={styles.emptyState}>
                <p>{isOwner ? 'لا يوجد عملاء. أضف عميل جديد باستخدام الزر أعلاه.' : 'لا يوجد عملاء.'}</p>
              </div>
            </Card>
          ) : filteredCustomers.length === 0 ? (
            <Card>
              <div className={styles.emptyState}>
                <p>لا توجد نتائج للبحث.</p>
              </div>
            </Card>
          ) : (
            filteredCustomers.map((customer) => (
              <div key={customer.id} className={styles.customerCard}>
                <div className={styles.customerInfo}>
                  <div className={styles.customerName}>
                    <HiUserGroup style={{ marginLeft: '8px', verticalAlign: 'middle', color: 'var(--primary-color)' }} />
                    {customer.name}
                  </div>
                  {customer.phone && <div className={styles.customerPhone}>{customer.phone}</div>}
                  <div className={styles.customerActions}>
                    <button
                      className={styles.reportButton}
                      onClick={() => goToCustomerReports(customer.id)}
                    >
                      <HiDocumentReport size={16} />
                      تقارير العميل
                    </button>
                    {isOwner && (
                      <>
                        <button
                          className={styles.editButton}
                          onClick={() => openEditModal(customer)}
                          title="تعديل"
                        >
                          <HiPencil />
                        </button>
                        <button
                          className={styles.deleteButton}
                          onClick={() => openDeleteModal(customer)}
                          title="حذف"
                        >
                          <HiTrash />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <Modal
          isOpen={isFormModalOpen}
          onClose={closeFormModal}
          title={editingCustomer ? 'تعديل عميل' : 'إضافة عميل جديد'}
          footer={
            <div className={styles.formActions}>
              <Button variant="secondary" onClick={closeFormModal} disabled={saving}>
                إلغاء
              </Button>
              <Button variant="primary" onClick={handleSave} loading={saving}>
                {editingCustomer ? 'حفظ التعديلات' : 'إضافة'}
              </Button>
            </div>
          }
        >
          {formError && <div className={styles.errorMessage}>{formError}</div>}
          <div className={styles.form}>
            <div>
              <label className={styles.formLabel}>اسم العميل</label>
              <input
                type="text"
                placeholder="أدخل اسم العميل"
                value={formData.name}
                onChange={handleNameChange}
                className={styles.formInput}
              />
            </div>
            <div>
              <label className={styles.formLabel}>رقم الهاتف (اختياري)</label>
              <input
                type="text"
                placeholder="أدخل رقم الهاتف"
                value={formData.phone}
                onChange={handlePhoneChange}
                className={styles.formInput}
              />
            </div>
            <div>
              <label className={styles.formLabel}>حد الائتمان (اختياري)</label>
              <input
                type="number"
                placeholder="أدخل حد الائتمان"
                value={formData.creditLimit}
                onChange={(e) => setFormData((prev) => ({ ...prev, creditLimit: e.target.value }))}
                className={styles.formInput}
              />
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => { setIsDeleteModalOpen(false); setCustomerToDelete(null); }}
          title="تأكيد الحذف"
          footer={
            <div className={styles.formActions}>
              <Button
                variant="secondary"
                onClick={() => { setIsDeleteModalOpen(false); setCustomerToDelete(null); }}
                disabled={deleteLoading}
              >
                إلغاء
              </Button>
              <Button variant="danger" onClick={handleDeleteConfirm} loading={deleteLoading}>
                حذف
              </Button>
            </div>
          }
        >
          <p>هل أنت متأكد أنك تريد حذف العميل <strong>{customerToDelete?.name}</strong>؟</p>
          <p style={{ color: '#ef4444', marginTop: '10px' }}>لا يمكن التراجع عن هذا الإجراء.</p>
        </Modal>
      </MainLayout>
    </AuthGuard>
  );
}
