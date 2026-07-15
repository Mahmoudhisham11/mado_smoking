'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '../../components/auth/AuthGuard';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/layout/PageHeader';
import SummaryCard from '../../components/dashboard/SummaryCard';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { subscribeToProducts, addProduct, updateProduct, deleteProduct } from '../../lib/firebase/firestore';
import { HiCube, HiCurrencyDollar } from 'react-icons/hi';
import styles from './page.module.css';

export default function ItemsPage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({ name: '', price: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToProducts((data) => {
      setProducts(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (p.name || '').toLowerCase().includes(q);
  });

  const totalItems = products.length;
  const totalPrice = products.reduce((sum, p) => sum + (Number(p.price) || 0), 0);

  const tableColumns = [
    { key: 'select', label: (
      <input
        type="checkbox"
        checked={filteredProducts.length > 0 && selectedIds.length === filteredProducts.length}
        onChange={() => {
          if (selectedIds.length === filteredProducts.length) {
            setSelectedIds([]);
          } else {
            setSelectedIds(filteredProducts.map(p => p.id));
          }
        }}
      />
    )},
    { key: 'name', label: 'اسم الصنف' },
    { key: 'price', label: 'السعر' },
  ];

  const formatPrice = (val) => {
    const num = Number(val);
    return isNaN(num) ? '0' : num.toLocaleString();
  };

  const tableData = filteredProducts.map((p) => ({
    id: p.id,
    select: (
      <input
        type="checkbox"
        checked={selectedIds.includes(p.id)}
        onChange={() => {
          setSelectedIds(prev =>
            prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
          );
        }}
      />
    ),
    name: p.name || 'بدون اسم',
    price: formatPrice(p.price),
    _raw: p,
  }));

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({ name: '', price: '' });
    setFormError('');
    setIsFormModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      price: product.price || '',
    });
    setFormError('');
    setIsFormModalOpen(true);
  };

  const closeFormModal = () => {
    setIsFormModalOpen(false);
    setEditingProduct(null);
    setFormError('');
  };

  const handleInputChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setFormError('يرجى إدخال اسم الصنف');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      if (editingProduct) {
        const result = await updateProduct(editingProduct.id, formData);
        if (!result.success) {
          setFormError(result.error || 'فشل في تعديل الصنف');
          setSaving(false);
          return;
        }
      } else {
        const result = await addProduct(formData);
        if (!result.success) {
          setFormError(result.error || 'فشل في إضافة الصنف');
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

  const openDeleteModal = (product) => {
    setProductToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;
    setDeleteLoading(true);
    try {
      await deleteProduct(productToDelete.id);
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
    } catch (err) {
      console.error('Error deleting product:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleTableAction = (action, row) => {
    const product = row._raw;
    if (!product) return;
    if (action === 'تقارير') {
      router.push(`/items/${product.id}`);
    } else if (action === 'تعديل') {
      openEditModal(product);
    } else if (action === 'حذف') {
      openDeleteModal(product);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`هل أنت متأكد من حذف ${selectedIds.length} صنف؟`)) return;
    setIsDeletingSelected(true);
    let deleted = 0;
    for (const id of selectedIds) {
      const result = await deleteProduct(id);
      if (result.success) deleted++;
    }
    setIsDeletingSelected(false);
    setSelectedIds([]);
    alert(`تم حذف ${deleted} صنف بنجاح`);
  };

  return (
    <AuthGuard>
      <MainLayout>
        <div className={styles.container}>
          <PageHeader
            title="الأصناف"
            action="addItem"
            actionLabel="+ إضافة صنف"
            onAction={openAddModal}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            showSearch={products.length > 0}
          />

          {loading ? (
            <div className={styles.loading}>جاري التحميل...</div>
          ) : (
            <>
              <div className={styles.cardsGrid}>
                <SummaryCard
                  title="إجمالي الأصناف"
                  value={totalItems}
                  icon={HiCube}
                />
                <SummaryCard
                  title="إجمالي سعر الأصناف"
                  value={`${formatPrice(totalPrice)} ج.م`}
                  icon={HiCurrencyDollar}
                />
              </div>

              {products.length === 0 ? (
                <Card>
                  <div className={styles.emptyState}>
                    <p>لا توجد أصناف. أضف صنف جديد باستخدام الزر أعلاه.</p>
                  </div>
                </Card>
              ) : filteredProducts.length === 0 ? (
                <Card>
                  <div className={styles.emptyState}>
                    <p>لا توجد نتائج للبحث.</p>
                  </div>
                </Card>
              ) : (
                <>
                  {selectedIds.length > 0 && (
                    <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        تم اختيار {selectedIds.length} صنف
                      </span>
                      <Button variant="danger" onClick={handleDeleteSelected} loading={isDeletingSelected}>
                        حذف المحدد
                      </Button>
                    </div>
                  )}
                  <Table
                    columns={tableColumns}
                    data={tableData}
                    actions={['تقارير', 'تعديل', 'حذف']}
                    onAction={handleTableAction}
                  />
                </>
              )}
            </>
          )}
        </div>

        <Modal
          isOpen={isFormModalOpen}
          onClose={closeFormModal}
          title={editingProduct ? 'تعديل صنف' : 'إضافة صنف جديد'}
          footer={
            <div className={styles.formActions}>
              <Button variant="secondary" onClick={closeFormModal} disabled={saving}>
                إلغاء
              </Button>
              <Button variant="primary" onClick={handleSave} loading={saving}>
                {editingProduct ? 'حفظ التعديلات' : 'إضافة'}
              </Button>
            </div>
          }
        >
          {formError && <div className={styles.errorMessage}>{formError}</div>}
          <div className={styles.form}>
            <div>
              <label className={styles.formLabel}>اسم الصنف</label>
              <input
                type="text"
                placeholder="أدخل اسم الصنف"
                value={formData.name}
                onChange={handleInputChange('name')}
                className={styles.formInput}
              />
            </div>
            <div>
              <label className={styles.formLabel}>السعر</label>
              <input
                type="number"
                placeholder="أدخل سعر الصنف"
                value={formData.price}
                onChange={handleInputChange('price')}
                className={styles.formInput}
              />
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => { setIsDeleteModalOpen(false); setProductToDelete(null); }}
          title="تأكيد الحذف"
          footer={
            <div className={styles.formActions}>
              <Button
                variant="secondary"
                onClick={() => { setIsDeleteModalOpen(false); setProductToDelete(null); }}
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
          <p>هل أنت متأكد أنك تريد حذف الصنف <strong>{productToDelete?.name}</strong>؟</p>
          <p style={{ color: '#ef4444', marginTop: '10px' }}>لا يمكن التراجع عن هذا الإجراء.</p>
        </Modal>
      </MainLayout>
    </AuthGuard>
  );
}
