'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '../../components/auth/AuthGuard';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/layout/PageHeader';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import SourceForm from '../../components/sources/SourceForm';
import { subscribeToSources, addSource, updateSource, deleteSource, getInvoices, getUsersByOwner } from '../../lib/firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { getUserFromLocalStorage } from '../../lib/auth';
import { useToast } from '../../contexts/ToastContext';
import SummaryCard from '../../components/dashboard/SummaryCard';
import { HiUserGroup, HiDocumentText } from 'react-icons/hi';
import styles from './page.module.css';

export default function SourcesPage() {
  const { user, userData } = useAuth();
  const localUserData = getUserFromLocalStorage();
  const { showSuccess, showError } = useToast();
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [sourceToDelete, setSourceToDelete] = useState(null);
  const [deletingSource, setDeletingSource] = useState(false);
  const [addingSource, setAddingSource] = useState(false);
  const [updatingSource, setUpdatingSource] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [allInvoices, setAllInvoices] = useState([]);
  const [stats, setStats] = useState({
    totalSources: 0,
    totalInvoices: 0,
  });
  const router = useRouter();

  const userRole = localUserData?.role || userData?.role || 'user';
  const isOwner = userRole === 'owner';
  const ownerId = localUserData?.ownerId || localUserData?.uid || user?.uid;

  const updateSourcesData = useCallback((sourcesData) => {
    try {
      // Use invoices from state instead of fetching every time
      // Calculate invoice count for each source
      const transformedData = sourcesData.map((source) => {
        // Count invoices for this source from state
        const sourceInvoices = allInvoices.filter(
          (invoice) => invoice.sourceId === source.id
        );
        const invoicesCount = sourceInvoices.length;
        
        return {
          id: source.id,
          sourceName: source.sourceName || source.name || 'Unnamed Source',
          invoicesCount,
          originalSource: source, // Keep original source data for editing
        };
      });
      
      setSources(transformedData);
      
      // Calculate stats
      const totalSources = sourcesData.length;
      const totalInvoices = allInvoices.length;
      
      setStats({
        totalSources,
        totalInvoices,
      });
    } catch (error) {
      console.error('Error updating sources data:', error);
    }
  }, [allInvoices]);

  useEffect(() => {
    // Load users for owner
    if (isOwner && ownerId) {
      loadUsers();
    }
    
    // Load invoices once and keep in state
    const loadInvoices = async () => {
      try {
        const invoices = await getInvoices();
        setAllInvoices(invoices);
      } catch (error) {
        console.error('Error loading invoices:', error);
      }
    };
    loadInvoices();
    
    // Subscribe to sources with real-time updates
    setLoading(true);
    const unsubscribe = subscribeToSources((sourcesData) => {
      updateSourcesData(sourcesData);
      setLoading(false);
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOwner, ownerId, updateSourcesData]);

  const loadUsers = async () => {
    try {
      if (ownerId) {
        const usersList = await getUsersByOwner(ownerId);
        setUsers(usersList);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  // Filter sources based on search query
  const filteredSources = sources.filter((source) =>
    source.sourceName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddSource = async (formData) => {
    setAddingSource(true);
    try {
      const result = await addSource(formData);
      setAddingSource(false); // Remove loading immediately after operation
      if (result.success) {
        setIsModalOpen(false);
        showSuccess('تم إضافة المصدر بنجاح');
        // Refresh invoices to update source counts
        const invoices = await getInvoices();
        setAllInvoices(invoices);
      } else {
        showError(result.error || 'فشل في إضافة المصدر');
      }
    } catch (error) {
      setAddingSource(false);
      console.error('Error adding source:', error);
      showError('حدث خطأ أثناء إضافة المصدر');
    }
  };

  const handleUpdateSource = async (formData) => {
    if (!editingSource) return;
    
    setUpdatingSource(true);
    try {
      const result = await updateSource(editingSource.id, formData);
      setUpdatingSource(false); // Remove loading immediately after operation
      if (result.success) {
        setIsEditModalOpen(false);
        setEditingSource(null);
        showSuccess('تم تحديث المصدر بنجاح');
        // Refresh invoices to update source counts
        const invoices = await getInvoices();
        setAllInvoices(invoices);
      } else {
        showError(result.error || 'فشل في تحديث المصدر');
      }
    } catch (error) {
      setUpdatingSource(false);
      console.error('Error updating source:', error);
      showError('حدث خطأ أثناء تحديث المصدر');
    }
  };

  const handleDeleteSource = async () => {
    if (!sourceToDelete) return;
    
    setDeletingSource(true);
    try {
      const result = await deleteSource(sourceToDelete.id);
      setDeletingSource(false); // Remove loading immediately after operation
      if (result.success) {
        setIsDeleteModalOpen(false);
        setSourceToDelete(null);
        showSuccess('تم حذف المصدر بنجاح');
        // Refresh invoices to update source counts
        const invoices = await getInvoices();
        setAllInvoices(invoices);
      } else {
        showError(result.error || 'فشل في حذف المصدر');
      }
    } catch (error) {
      setDeletingSource(false);
      console.error('Error deleting source:', error);
      showError('حدث خطأ أثناء حذف المصدر');
    }
  };

  const handleAction = (action, row) => {
    if (action === 'عرض') {
      router.push(`/sources/${row.id}`);
    } else if (action === 'تعديل' && isOwner) {
      setEditingSource(row.originalSource);
      setIsEditModalOpen(true);
    } else if (action === 'حذف' && isOwner) {
      setSourceToDelete(row.originalSource);
      setIsDeleteModalOpen(true);
    }
  };

  const columns = [
    { key: 'sourceName', label: 'اسم المصدر' },
    { key: 'invoicesCount', label: 'عدد الفواتير' },
  ];

  const actions = isOwner ? ['عرض', 'تعديل', 'حذف'] : ['عرض'];

  return (
    <AuthGuard>
      <MainLayout>
        <div className={styles.container}>
          <PageHeader
            title="المصادر"
            action={isOwner ? "addSource" : undefined}
            actionLabel={isOwner ? "+ إضافة مصدر" : undefined}
            onAction={isOwner ? () => setIsModalOpen(true) : undefined}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            showSearch={true}
          />

          <div className={styles.cardsGrid}>
            <SummaryCard
              title="إجمالي المصادر"
              value={stats.totalSources}
              icon={HiUserGroup}
            />
            <SummaryCard
              title="إجمالي الفواتير"
              value={stats.totalInvoices}
              icon={HiDocumentText}
            />
          </div>

          {loading ? (
            <div className={styles.loading}>
              جاري التحميل...
            </div>
          ) : (
            <Table
              columns={columns}
              data={filteredSources}
              actions={actions}
              onAction={handleAction}
            />
          )}

          {/* Add Source Modal */}
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title="إضافة مصدر جديد"
            footer={null}
          >
            <SourceForm
              users={users}
              onSave={handleAddSource}
              onCancel={() => setIsModalOpen(false)}
              loading={addingSource}
            />
          </Modal>

          {/* Edit Source Modal */}
          <Modal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setEditingSource(null);
            }}
            title="تعديل المصدر"
            footer={null}
          >
            <SourceForm
              source={editingSource}
              users={users}
              onSave={handleUpdateSource}
              onCancel={() => {
                setIsEditModalOpen(false);
                setEditingSource(null);
              }}
              loading={updatingSource}
            />
          </Modal>

          {/* Delete Source Modal */}
          <Modal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false);
              setSourceToDelete(null);
            }}
            title="حذف المصدر"
            footer={
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setSourceToDelete(null);
                  }}
                  disabled={deletingSource}
                >
                  إلغاء
                </Button>
                <Button
                  variant="primary"
                  onClick={handleDeleteSource}
                  loading={deletingSource}
                >
                  حذف
                </Button>
              </div>
            }
          >
            <p>هل أنت متأكد من حذف هذا المصدر؟ سيتم حذف جميع الفواتير والمنتجات المرتبطة به.</p>
          </Modal>
        </div>
      </MainLayout>
    </AuthGuard>
  );
}

