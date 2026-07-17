'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '../../components/auth/AuthGuard';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { subscribeToSources, addSource, updateSource, deleteSource } from '../../lib/firebase/firestore';
import { getUserFromLocalStorage } from '../../lib/auth';
import { HiTruck, HiPencil, HiTrash, HiDocumentReport } from 'react-icons/hi';
import styles from './page.module.css';

export default function SourcesPage() {
  const router = useRouter();
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [formData, setFormData] = useState({ name: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const userData = getUserFromLocalStorage();
  const userRole = userData?.role || 'user';
  const isOwner = userRole === 'owner';

  if (!isOwner) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className={styles.container}>
            <Modal isOpen={true} onClose={() => router.push('/')} title="تنبيه" size="small" footer={
              <Button variant="primary" onClick={() => router.push('/')}>العودة للرئيسية</Button>
            }>
              <p style={{ textAlign: 'center', padding: '16px 0' }}>ليس لديك الصلاحية للوصول الى هذه البيانات</p>
            </Modal>
          </div>
        </MainLayout>
      </AuthGuard>
    );
  }

  useEffect(() => {
    const unsubscribe = subscribeToSources((data) => {
      setSources(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredSources = sources.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (s.name || '').toLowerCase().includes(q);
  });

  const openAddModal = () => {
    if (!isOwner) return;
    setEditingSource(null);
    setFormData({ name: '' });
    setFormError('');
    setIsFormModalOpen(true);
  };

  const openEditModal = (source) => {
    if (!isOwner) return;
    setEditingSource(source);
    setFormData({ name: source.name || '' });
    setFormError('');
    setIsFormModalOpen(true);
  };

  const closeFormModal = () => {
    setIsFormModalOpen(false);
    setEditingSource(null);
    setFormError('');
  };

  const handleInputChange = (e) => {
    setFormData({ name: e.target.value });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setFormError('يرجى إدخال اسم المصدر');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      if (editingSource) {
        const result = await updateSource(editingSource.id, formData);
        if (!result.success) {
          setFormError(result.error || 'فشل في تعديل المصدر');
          setSaving(false);
          return;
        }
      } else {
        const result = await addSource(formData);
        if (!result.success) {
          setFormError(result.error || 'فشل في إضافة المصدر');
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

  const openDeleteModal = (source) => {
    if (!isOwner) return;
    setSourceToDelete(source);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!sourceToDelete) return;
    setDeleteLoading(true);
    try {
      const result = await deleteSource(sourceToDelete.id);
      if (!result.success) {
        setDeleteLoading(false);
        return;
      }
      setIsDeleteModalOpen(false);
      setSourceToDelete(null);
    } catch (err) {
      console.error('Error deleting source:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const goToSourceReports = (sourceId) => {
    router.push(`/sources/${sourceId}`);
  };

  return (
    <AuthGuard>
      <MainLayout>
        <div className={styles.container}>
          <PageHeader
            title="المصادر"
            action={isOwner ? "addSource" : null}
            actionLabel={isOwner ? "+ إضافة مصدر" : null}
            onAction={isOwner ? openAddModal : null}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            showSearch={sources.length > 0}
          />

          {loading ? (
            <div className={styles.loading}>جاري التحميل...</div>
          ) : sources.length === 0 ? (
            <Card>
              <div className={styles.emptyState}>
                <p>{isOwner ? 'لا توجد مصادر. أضف مصدر جديد باستخدام الزر أعلاه.' : 'لا توجد مصادر.'}</p>
              </div>
            </Card>
          ) : filteredSources.length === 0 ? (
            <Card>
              <div className={styles.emptyState}>
                <p>لا توجد نتائج للبحث.</p>
              </div>
            </Card>
          ) : (
            filteredSources.map((source) => (
              <div key={source.id} className={styles.sourceCard}>
                <div className={styles.sourceInfo}>
                  <div className={styles.sourceName}>
                    <HiTruck style={{ marginLeft: '8px', verticalAlign: 'middle', color: 'var(--primary-color)' }} />
                    {source.name}
                  </div>
                  <div className={styles.sourceActions}>
                    <button
                      className={styles.reportButton}
                      onClick={() => goToSourceReports(source.id)}
                    >
                      <HiDocumentReport size={16} />
                      تقارير المصدر
                    </button>
                    {isOwner && (
                      <>
                        <button
                          className={styles.editButton}
                          onClick={() => openEditModal(source)}
                          title="تعديل"
                        >
                          <HiPencil />
                        </button>
                        <button
                          className={styles.deleteButton}
                          onClick={() => openDeleteModal(source)}
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
          title={editingSource ? 'تعديل مصدر' : 'إضافة مصدر جديد'}
          footer={
            <div className={styles.formActions}>
              <Button variant="secondary" onClick={closeFormModal} disabled={saving}>
                إلغاء
              </Button>
              <Button variant="primary" onClick={handleSave} loading={saving}>
                {editingSource ? 'حفظ التعديلات' : 'إضافة'}
              </Button>
            </div>
          }
        >
          {formError && <div className={styles.errorMessage}>{formError}</div>}
          <div className={styles.form}>
            <div>
              <label className={styles.formLabel}>اسم المصدر</label>
              <input
                type="text"
                placeholder="أدخل اسم المصدر"
                value={formData.name}
                onChange={handleInputChange}
                className={styles.formInput}
              />
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => { setIsDeleteModalOpen(false); setSourceToDelete(null); }}
          title="تأكيد الحذف"
          footer={
            <div className={styles.formActions}>
              <Button
                variant="secondary"
                onClick={() => { setIsDeleteModalOpen(false); setSourceToDelete(null); }}
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
          <p>هل أنت متأكد أنك تريد حذف المصدر <strong>{sourceToDelete?.name}</strong>؟</p>
          <p style={{ color: '#ef4444', marginTop: '10px' }}>لا يمكن التراجع عن هذا الإجراء.</p>
        </Modal>
      </MainLayout>
    </AuthGuard>
  );
}
